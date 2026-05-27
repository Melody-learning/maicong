const { Redis } = require('@upstash/redis');
const crypto = require('crypto');
const { MESSAGE_TYPES, MESSAGE_STATUSES } = require('./model');

function createRedisClient(config) {
  return new Redis({
    url: config.redisUrl,
    token: config.redisToken,
  });
}

class RemoteMessageStore {
  constructor({ redis, config, now = () => Date.now(), idFactory = () => crypto.randomUUID() }) {
    this.redis = redis;
    this.config = config;
    this.now = now;
    this.idFactory = idFactory;
  }

  key(name) {
    return `${this.config.keyPrefix}:${name}`;
  }

  messageKey(id) {
    return this.key(`message:${id}`);
  }

  async getMessage(id) {
    if (!id) return null;
    return this.redis.get(this.messageKey(id));
  }

  async saveMessage(message) {
    await this.redis.set(this.messageKey(message.id), message);
    return message;
  }

  async markExpired(message, now = this.now()) {
    if (!message || message.status === MESSAGE_STATUSES.EXPIRED) return message;
    const updated = {
      ...message,
      status: MESSAGE_STATUSES.EXPIRED,
      updatedAt: new Date(now).toISOString(),
    };
    await this.saveMessage(updated);
    if (updated.type === MESSAGE_TYPES.STICKY) {
      const currentStickyId = await this.redis.get(this.key('currentSticky'));
      if (currentStickyId === updated.id) await this.redis.del(this.key('currentSticky'));
    }
    return updated;
  }

  isExpired(message, now = this.now()) {
    return Boolean(message.expiresAt && Date.parse(message.expiresAt) <= now);
  }

  isTimedOutShowingTransient(message, now = this.now()) {
    return (
      message.type === MESSAGE_TYPES.TRANSIENT &&
      message.status === MESSAGE_STATUSES.SHOWING &&
      message.showingDeadlineAt &&
      Date.parse(message.showingDeadlineAt) <= now
    );
  }

  async checkSenderRateLimit() {
    const key = this.key('rate:sender');
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.config.senderRateLimitWindowSeconds);
    }
    return {
      allowed: count <= this.config.senderRateLimitCount,
      count,
      limit: this.config.senderRateLimitCount,
      windowSeconds: this.config.senderRateLimitWindowSeconds,
    };
  }

  async createMessage(input) {
    const now = this.now();
    const createdAt = new Date(now).toISOString();
    const ttlSeconds =
      input.type === MESSAGE_TYPES.TRANSIENT && !input.ttlSeconds
        ? this.config.defaultTransientTtlSeconds
        : input.ttlSeconds;
    const message = {
      id: this.idFactory(),
      type: input.type,
      text: input.text,
      status: MESSAGE_STATUSES.PENDING,
      createdAt,
      updatedAt: createdAt,
      expiresAt: ttlSeconds ? new Date(now + ttlSeconds * 1000).toISOString() : null,
      displaySeconds: input.displaySeconds || this.config.defaultDisplaySeconds,
      showingDeadlineAt: null,
      shownAt: null,
      lastDisplayedAt: null,
    };

    if (message.type === MESSAGE_TYPES.STICKY) {
      const previousStickyId = await this.redis.get(this.key('currentSticky'));
      if (previousStickyId) {
        const previous = await this.getMessage(previousStickyId);
        if (previous && previous.status !== MESSAGE_STATUSES.EXPIRED) {
          await this.markExpired(previous, now);
        }
      }
      await this.saveMessage(message);
      await this.redis.set(this.key('currentSticky'), message.id);
      return message;
    }

    await this.cleanup(now);
    const pendingCount = await this.redis.zcard(this.key('pendingTransients'));
    if (pendingCount >= this.config.transientQueueLimit) {
      const error = new Error('Transient queue is full');
      error.code = 'QUEUE_FULL';
      throw error;
    }
    await this.saveMessage(message);
    await this.redis.zadd(this.key('pendingTransients'), { score: now, member: message.id });
    return message;
  }

  async cleanup(now = this.now()) {
    const pendingIds = await this.redis.zrange(this.key('pendingTransients'), 0, -1);
    for (const id of pendingIds) {
      const message = await this.getMessage(id);
      if (!message || message.status !== MESSAGE_STATUSES.PENDING || this.isExpired(message, now)) {
        await this.redis.zrem(this.key('pendingTransients'), id);
        if (message && this.isExpired(message, now)) await this.markExpired(message, now);
      }
    }

    const showingIds = await this.redis.smembers(this.key('showingTransients'));
    for (const id of showingIds) {
      const message = await this.getMessage(id);
      if (
        !message ||
        message.status !== MESSAGE_STATUSES.SHOWING ||
        this.isExpired(message, now) ||
        this.isTimedOutShowingTransient(message, now)
      ) {
        await this.redis.srem(this.key('showingTransients'), id);
        if (message && message.status === MESSAGE_STATUSES.SHOWING) await this.markExpired(message, now);
      }
    }

    const stickyId = await this.redis.get(this.key('currentSticky'));
    if (stickyId) {
      const sticky = await this.getMessage(stickyId);
      if (!sticky || sticky.type !== MESSAGE_TYPES.STICKY || sticky.status === MESSAGE_STATUSES.EXPIRED) {
        await this.redis.del(this.key('currentSticky'));
      } else if (this.isExpired(sticky, now)) {
        await this.markExpired(sticky, now);
      }
    }
  }

  async nextMessage() {
    const now = this.now();
    await this.cleanup(now);

    while (true) {
      const ids = await this.redis.zrange(this.key('pendingTransients'), 0, 0);
      const id = ids[0];
      if (!id) break;
      const message = await this.getMessage(id);
      if (!message || message.status !== MESSAGE_STATUSES.PENDING || this.isExpired(message, now)) {
        await this.redis.zrem(this.key('pendingTransients'), id);
        if (message && this.isExpired(message, now)) await this.markExpired(message, now);
        continue;
      }
      const updated = {
        ...message,
        status: MESSAGE_STATUSES.SHOWING,
        updatedAt: new Date(now).toISOString(),
        lastDisplayedAt: new Date(now).toISOString(),
        showingDeadlineAt: new Date(now + message.displaySeconds * 1000).toISOString(),
      };
      await this.redis.zrem(this.key('pendingTransients'), id);
      await this.redis.sadd(this.key('showingTransients'), id);
      await this.saveMessage(updated);
      return updated;
    }

    const stickyId = await this.redis.get(this.key('currentSticky'));
    const sticky = await this.getMessage(stickyId);
    if (
      sticky &&
      sticky.type === MESSAGE_TYPES.STICKY &&
      sticky.status !== MESSAGE_STATUSES.EXPIRED &&
      !this.isExpired(sticky, now)
    ) {
      const updated = {
        ...sticky,
        status: MESSAGE_STATUSES.SHOWING,
        updatedAt: new Date(now).toISOString(),
        lastDisplayedAt: new Date(now).toISOString(),
        showingDeadlineAt: null,
      };
      await this.saveMessage(updated);
      return updated;
    }

    return null;
  }

  async ackMessage(id) {
    const now = this.now();
    const message = await this.getMessage(id);
    if (!message || message.status === MESSAGE_STATUSES.EXPIRED || this.isExpired(message, now)) {
      if (message && this.isExpired(message, now)) await this.markExpired(message, now);
      return { acknowledged: false, message: null };
    }

    if (message.type === MESSAGE_TYPES.TRANSIENT) {
      if (message.status !== MESSAGE_STATUSES.SHOWING) {
        return { acknowledged: false, message };
      }
      const updated = {
        ...message,
        status: MESSAGE_STATUSES.SHOWN,
        updatedAt: new Date(now).toISOString(),
        shownAt: new Date(now).toISOString(),
        showingDeadlineAt: null,
      };
      await this.redis.srem(this.key('showingTransients'), id);
      await this.saveMessage(updated);
      return { acknowledged: true, message: updated };
    }

    const currentStickyId = await this.redis.get(this.key('currentSticky'));
    if (currentStickyId !== id) {
      return { acknowledged: false, message };
    }
    const updated = {
      ...message,
      status: MESSAGE_STATUSES.SHOWING,
      updatedAt: new Date(now).toISOString(),
      lastDisplayedAt: new Date(now).toISOString(),
    };
    await this.saveMessage(updated);
    return { acknowledged: true, message: updated };
  }

  async clearSticky() {
    const now = this.now();
    const stickyId = await this.redis.get(this.key('currentSticky'));
    if (!stickyId) return null;
    const sticky = await this.getMessage(stickyId);
    await this.redis.del(this.key('currentSticky'));
    if (!sticky) return null;
    return this.markExpired(sticky, now);
  }
}

module.exports = {
  RemoteMessageStore,
  createRedisClient,
};
