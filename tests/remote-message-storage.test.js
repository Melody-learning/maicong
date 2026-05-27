import { describe, it, expect } from 'vitest';
import storageModule from '../lib/remote-message/redis-storage.js';
import configModule from '../lib/remote-message/config.js';

const { RemoteMessageStore } = storageModule;
const { DEFAULTS } = configModule;

class MemoryRedis {
  constructor() {
    this.values = new Map();
    this.zsets = new Map();
    this.sets = new Map();
  }

  async get(key) {
    return this.values.get(key) || null;
  }

  async set(key, value) {
    this.values.set(key, value);
  }

  async del(key) {
    this.values.delete(key);
    this.zsets.delete(key);
    this.sets.delete(key);
  }

  async incr(key) {
    const next = Number(this.values.get(key) || 0) + 1;
    this.values.set(key, next);
    return next;
  }

  async expire() {}

  async zadd(key, entry) {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    this.zsets.get(key).set(entry.member, entry.score);
  }

  async zrange(key, start, stop) {
    const entries = Array.from((this.zsets.get(key) || new Map()).entries())
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
    const end = stop < 0 ? entries.length : stop + 1;
    return entries.slice(start, end);
  }

  async zrem(key, member) {
    const zset = this.zsets.get(key);
    if (zset) zset.delete(member);
  }

  async zcard(key) {
    return (this.zsets.get(key) || new Map()).size;
  }

  async sadd(key, member) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key).add(member);
  }

  async srem(key, member) {
    const set = this.sets.get(key);
    if (set) set.delete(member);
  }

  async smembers(key) {
    return Array.from(this.sets.get(key) || []);
  }
}

function makeStore(overrides = {}) {
  let now = overrides.now || Date.parse('2026-05-27T10:00:00.000Z');
  let nextId = 1;
  const redis = new MemoryRedis();
  const config = {
    ...DEFAULTS,
    sendToken: 'send-secret',
    receiverToken: 'receiver-secret',
    redisUrl: 'https://redis.example',
    redisToken: 'redis-secret',
    keyPrefix: `test:${Math.random()}`,
    ...overrides.config,
  };
  const store = new RemoteMessageStore({
    redis,
    config,
    now: () => now,
    idFactory: () => `msg_${nextId++}`,
  });
  return {
    store,
    redis,
    config,
    advance: (seconds) => {
      now += seconds * 1000;
    },
  };
}

describe('RemoteMessageStore sticky semantics', () => {
  it('creates, replaces, clears, and keeps acked sticky active', async () => {
    const { store } = makeStore();
    const first = await store.createMessage({ type: 'sticky', text: 'hello', displaySeconds: 20 });
    expect(first.status).toBe('pending');

    const nextFirst = await store.nextMessage();
    expect(nextFirst.id).toBe(first.id);
    expect(nextFirst.status).toBe('showing');

    const acked = await store.ackMessage(first.id);
    expect(acked.acknowledged).toBe(true);
    expect(acked.message.status).toBe('showing');

    const second = await store.createMessage({ type: 'sticky', text: 'new note', displaySeconds: 20 });
    const old = await store.getMessage(first.id);
    expect(old.status).toBe('expired');

    const nextSecond = await store.nextMessage();
    expect(nextSecond.id).toBe(second.id);
    expect(nextSecond.text).toBe('new note');

    const cleared = await store.clearSticky();
    expect(cleared.id).toBe(second.id);
    expect((await store.nextMessage())).toBeNull();
  });

  it('expires a sticky with ttl before scheduling it', async () => {
    const { store, advance } = makeStore();
    const sticky = await store.createMessage({ type: 'sticky', text: 'short', ttlSeconds: 1, displaySeconds: 20 });
    advance(2);
    expect(await store.nextMessage()).toBeNull();
    expect((await store.getMessage(sticky.id)).status).toBe('expired');
  });
});

describe('RemoteMessageStore transient semantics', () => {
  it('schedules pending transients FIFO before sticky and marks acked transient shown', async () => {
    const { store, advance } = makeStore();
    await store.createMessage({ type: 'sticky', text: 'sticky', displaySeconds: 20 });
    const first = await store.createMessage({ type: 'transient', text: 'one', displaySeconds: 20 });
    advance(1);
    const second = await store.createMessage({ type: 'transient', text: 'two', displaySeconds: 20 });

    const nextOne = await store.nextMessage();
    expect(nextOne.id).toBe(first.id);
    expect(nextOne.status).toBe('showing');

    const nextTwo = await store.nextMessage();
    expect(nextTwo.id).toBe(second.id);

    const acked = await store.ackMessage(first.id);
    expect(acked.acknowledged).toBe(true);
    expect(acked.message.status).toBe('shown');

    const sticky = await store.nextMessage();
    expect(sticky.type).toBe('sticky');
  });

  it('does not repeat a showing transient before ack', async () => {
    const { store } = makeStore();
    const message = await store.createMessage({ type: 'transient', text: 'once', displaySeconds: 20 });
    expect((await store.nextMessage()).id).toBe(message.id);
    expect(await store.nextMessage()).toBeNull();
  });

  it('rejects transient creation when the pending queue limit is reached', async () => {
    const { store } = makeStore({ config: { transientQueueLimit: 1 } });
    await store.createMessage({ type: 'transient', text: 'one', displaySeconds: 20 });
    await expect(store.createMessage({ type: 'transient', text: 'two', displaySeconds: 20 })).rejects.toMatchObject({
      code: 'QUEUE_FULL',
    });
  });

  it('expires pending and showing transients', async () => {
    const pendingCase = makeStore();
    const pending = await pendingCase.store.createMessage({
      type: 'transient',
      text: 'pending',
      ttlSeconds: 1,
      displaySeconds: 20,
    });
    pendingCase.advance(2);
    expect(await pendingCase.store.nextMessage()).toBeNull();
    expect((await pendingCase.store.getMessage(pending.id)).status).toBe('expired');

    const showingCase = makeStore();
    const showing = await showingCase.store.createMessage({
      type: 'transient',
      text: 'showing',
      ttlSeconds: 100,
      displaySeconds: 1,
    });
    expect((await showingCase.store.nextMessage()).id).toBe(showing.id);
    showingCase.advance(2);
    expect(await showingCase.store.nextMessage()).toBeNull();
    expect((await showingCase.store.getMessage(showing.id)).status).toBe('expired');
  });
});

describe('RemoteMessageStore guardrails', () => {
  it('applies sender rate limits', async () => {
    const { store } = makeStore({ config: { senderRateLimitCount: 1 } });
    expect((await store.checkSenderRateLimit()).allowed).toBe(true);
    expect((await store.checkSenderRateLimit()).allowed).toBe(false);
  });
});
