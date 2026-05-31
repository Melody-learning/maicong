const { Redis } = require('@upstash/redis');
const crypto = require('crypto');
const { ENDED_REASONS, publicBoard, publicBoardHistoryItem } = require('./model');

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
    return this.boardKey(id);
  }

  boardKey(id) {
    return this.key(`board:${id}`);
  }

  boardHistoryKey() {
    return this.key('boardHistory');
  }

  async getBoard(id) {
    if (!id) return null;
    return this.redis.get(this.boardKey(id));
  }

  async getMessage(id) {
    return this.getBoard(id);
  }

  async saveBoard(board) {
    await this.redis.set(this.boardKey(board.id), board);
    return board;
  }

  async saveMessage(message) {
    return this.saveBoard(message);
  }

  async addBoardToHistory(board, score = this.now()) {
    await this.redis.zadd(this.boardHistoryKey(), { score, member: board.id });
    await this.redis.zremrangebyrank(this.boardHistoryKey(), 0, -(this.config.boardHistoryLimit + 1));
  }

  async endBoard(board, now = this.now(), endedReason = ENDED_REASONS.EXPIRED) {
    if (!board || board.endedAt) return board;
    const endedAt = new Date(now).toISOString();
    const updated = {
      ...board,
      updatedAt: endedAt,
      endedAt,
      endedReason,
    };
    await this.saveBoard(updated);
    const currentBoardId = await this.redis.get(this.key('currentBoard'));
    if (currentBoardId === updated.id) await this.redis.del(this.key('currentBoard'));
    return updated;
  }

  async markExpired(board, now = this.now(), endedReason = ENDED_REASONS.EXPIRED) {
    return this.endBoard(board, now, endedReason);
  }

  isExpired(board, now = this.now()) {
    return Boolean(board && board.expiresAt && Date.parse(board.expiresAt) <= now);
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

  async createBoard(input) {
    const now = this.now();
    await this.cleanup(now);
    const createdAt = new Date(now).toISOString();
    const board = {
      id: this.idFactory(),
      text: input.text,
      durationSeconds: input.durationSeconds,
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(now + input.durationSeconds * 1000).toISOString(),
      displayedAt: null,
      lastDisplayedAt: null,
      endedAt: null,
      endedReason: null,
    };

    const previousBoardId = await this.redis.get(this.key('currentBoard'));
    if (previousBoardId) {
      const previous = await this.getBoard(previousBoardId);
      if (previous && !previous.endedAt) await this.endBoard(previous, now, ENDED_REASONS.REPLACED);
    }

    await this.saveBoard(board);
    await this.addBoardToHistory(board, now);
    await this.redis.set(this.key('currentBoard'), board.id);
    return board;
  }

  async createMessage(input) {
    return this.createBoard(input);
  }

  async cleanup(now = this.now()) {
    const boardId = await this.redis.get(this.key('currentBoard'));
    if (!boardId) return;
    const board = await this.getBoard(boardId);
    if (!board) {
      await this.redis.del(this.key('currentBoard'));
    } else if (board.endedAt) {
      await this.redis.del(this.key('currentBoard'));
    } else if (this.isExpired(board, now)) {
      await this.endBoard(board, now, ENDED_REASONS.EXPIRED);
    }
  }

  async currentBoard() {
    const now = this.now();
    await this.cleanup(now);
    const boardId = await this.redis.get(this.key('currentBoard'));
    if (!boardId) return null;
    const board = await this.getBoard(boardId);
    if (!board || board.endedAt || this.isExpired(board, now)) {
      if (board && this.isExpired(board, now)) await this.endBoard(board, now, ENDED_REASONS.EXPIRED);
      await this.redis.del(this.key('currentBoard'));
      return null;
    }
    return board;
  }

  async nextMessage() {
    return this.currentBoard();
  }

  async listBoardHistory() {
    const current = await this.currentBoard();
    const ids = await this.redis.zrange(this.boardHistoryKey(), 0, this.config.boardHistoryLimit - 1, { rev: true });
    const boards = [];
    for (const id of ids || []) {
      const board = await this.getBoard(id);
      if (!board) continue;
      boards.push(publicBoardHistoryItem(board, Boolean(current && current.id === board.id)));
    }
    return boards;
  }

  async reportBoardDisplayed(id) {
    const now = this.now();
    const board = await this.getBoard(id);
    const currentBoardId = await this.redis.get(this.key('currentBoard'));
    if (!board || board.endedAt || currentBoardId !== id || this.isExpired(board, now)) {
      if (board && this.isExpired(board, now)) await this.endBoard(board, now, ENDED_REASONS.EXPIRED);
      return { displayed: false, board: null };
    }
    const displayedAt = new Date(now).toISOString();
    const updated = {
      ...board,
      updatedAt: displayedAt,
      displayedAt: board.displayedAt || displayedAt,
      lastDisplayedAt: displayedAt,
    };
    await this.saveBoard(updated);
    return { displayed: true, board: updated };
  }

  async ackMessage(id) {
    const result = await this.reportBoardDisplayed(id);
    return { acknowledged: result.displayed, message: result.board };
  }

  async dismissBoard(id) {
    const now = this.now();
    const board = await this.getBoard(id);
    if (!board) return { dismissed: false, board: null };
    const currentBoardId = await this.redis.get(this.key('currentBoard'));
    if (board.endedAt || currentBoardId !== id) return { dismissed: false, board };
    if (this.isExpired(board, now)) {
      const expired = await this.endBoard(board, now, ENDED_REASONS.EXPIRED);
      return { dismissed: false, board: expired };
    }
    const dismissed = await this.endBoard(board, now, ENDED_REASONS.DISMISSED);
    return { dismissed: true, board: dismissed };
  }

  async dismissMessage(id) {
    const result = await this.dismissBoard(id);
    return { dismissed: result.dismissed, message: result.board };
  }

  async clearBoard() {
    const now = this.now();
    const boardId = await this.redis.get(this.key('currentBoard'));
    if (!boardId) return null;
    const board = await this.getBoard(boardId);
    await this.redis.del(this.key('currentBoard'));
    if (!board || board.endedAt) return null;
    return this.endBoard(board, now, ENDED_REASONS.CLEARED);
  }

  async clearSticky() {
    return this.clearBoard();
  }

  normalizeReceiverStatus(input = {}, now = this.now()) {
    const timestamp = new Date(now).toISOString();
    return {
      dnd: Boolean(input.dnd),
      lastSeenAt: input.lastSeenAt || timestamp,
      lastStatus: typeof input.lastStatus === 'string' ? input.lastStatus.slice(0, 80) : 'ok',
      lastDisplayBoardId: input.lastDisplayBoardId || input.lastDisplayMessageId || null,
      remoteDisplayActive: Boolean(input.remoteDisplayActive),
      updatedAt: timestamp,
    };
  }

  async updateReceiverStatus(input = {}) {
    const status = this.normalizeReceiverStatus(input);
    const key = this.key('receiverStatus');
    await this.redis.set(key, status);
    await this.redis.expire(key, this.config.receiverStatusTtlSeconds);
    return status;
  }

  async getReceiverStatus() {
    return this.redis.get(this.key('receiverStatus'));
  }

  async getDisplayStatus() {
    const now = this.now();
    await this.cleanup(now);

    const receiverStatus = await this.getReceiverStatus();
    const lastSeenMs = receiverStatus && receiverStatus.lastSeenAt ? Date.parse(receiverStatus.lastSeenAt) : NaN;
    const online = Number.isFinite(lastSeenMs)
      ? now - lastSeenMs <= this.config.receiverStatusTtlSeconds * 1000
      : false;

    const currentBoard = await this.currentBoard();
    const displayBoardId = receiverStatus && receiverStatus.lastDisplayBoardId;
    const displayBoard = displayBoardId ? await this.getBoard(displayBoardId) : null;

    return {
      receiver: {
        online,
        dnd: Boolean(receiverStatus && receiverStatus.dnd),
        lastSeenAt: receiverStatus ? receiverStatus.lastSeenAt || null : null,
        lastStatus: receiverStatus ? receiverStatus.lastStatus || null : null,
        lastDisplayBoardId: receiverStatus ? receiverStatus.lastDisplayBoardId || null : null,
        remoteDisplayActive: Boolean(receiverStatus && receiverStatus.remoteDisplayActive),
      },
      currentBoard: publicBoard(currentBoard),
      currentDisplay: publicBoard(displayBoard),
      generatedAt: new Date(now).toISOString(),
    };
  }
}

module.exports = {
  RemoteMessageStore,
  createRedisClient,
};
