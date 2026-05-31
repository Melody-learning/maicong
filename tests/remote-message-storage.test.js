import { describe, it, expect } from 'vitest';
import storageModule from '../lib/remote-message/redis-storage.js';
import configModule from '../lib/remote-message/config.js';

const { RemoteMessageStore } = storageModule;
const { DEFAULTS } = configModule;

class MemoryRedis {
  constructor() {
    this.values = new Map();
  }

  async get(key) {
    return this.values.get(key) || null;
  }

  async set(key, value) {
    this.values.set(key, value);
  }

  async del(key) {
    this.values.delete(key);
  }

  async incr(key) {
    const next = Number(this.values.get(key) || 0) + 1;
    this.values.set(key, next);
    return next;
  }

  async expire() {}

  async zadd(key, entry) {
    const set = this.values.get(key) || [];
    const filtered = set.filter((item) => item.member !== entry.member);
    filtered.push({ score: entry.score, member: entry.member });
    this.values.set(key, filtered);
    return 1;
  }

  async zrange(key, start, stop, options = {}) {
    const set = [...(this.values.get(key) || [])].sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return String(a.member).localeCompare(String(b.member));
    });
    if (options.rev) set.reverse();
    const normalizedStop = stop < 0 ? set.length + stop : stop;
    return set.slice(start, normalizedStop + 1).map((item) => item.member);
  }

  async zremrangebyrank(key, start, stop) {
    const set = [...(this.values.get(key) || [])].sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return String(a.member).localeCompare(String(b.member));
    });
    const normalizedStop = stop < 0 ? set.length + stop : stop;
    if (normalizedStop < start) return 0;
    const removed = set.slice(start, normalizedStop + 1);
    const removedMembers = new Set(removed.map((item) => item.member));
    this.values.set(
      key,
      set.filter((item) => !removedMembers.has(item.member))
    );
    return removed.length;
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
    idFactory: () => `board_${nextId++}`,
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

describe('RemoteMessageStore board semantics', () => {
  it('creates, replaces, reads, and clears a single current board', async () => {
    const { store } = makeStore();
    const first = await store.createBoard({ text: 'hello', durationSeconds: 30 });

    expect(first.id).toBe('board_1');
    expect(first.durationSeconds).toBe(30);
    expect(first.expiresAt).toBe('2026-05-27T10:00:30.000Z');
    expect((await store.currentBoard()).id).toBe(first.id);

    const second = await store.createBoard({ text: 'new note', durationSeconds: 60 });
    const old = await store.getBoard(first.id);
    expect(old.endedReason).toBe('replaced');
    expect((await store.currentBoard()).id).toBe(second.id);

    const cleared = await store.clearBoard();
    expect(cleared.id).toBe(second.id);
    expect(cleared.endedReason).toBe('cleared');
    expect(await store.currentBoard()).toBeNull();
  });

  it('expires current boards and clears the pointer on read', async () => {
    const { store, advance } = makeStore();
    const board = await store.createBoard({ text: 'short', durationSeconds: 1 });

    advance(2);

    expect(await store.currentBoard()).toBeNull();
    const expired = await store.getBoard(board.id);
    expect(expired.endedReason).toBe('expired');
    expect(expired.endedAt).toBe('2026-05-27T10:00:02.000Z');
  });

  it('marks an expired previous board as expired before creating a replacement', async () => {
    const { store, advance } = makeStore();
    const old = await store.createBoard({ text: 'short', durationSeconds: 1 });

    advance(2);
    const next = await store.createBoard({ text: 'new', durationSeconds: 30 });

    const expired = await store.getBoard(old.id);
    expect(expired.endedReason).toBe('expired');
    expect((await store.currentBoard()).id).toBe(next.id);
  });

  it('records displayed timing without ending the board', async () => {
    const { store, advance } = makeStore();
    const board = await store.createBoard({ text: 'hello', durationSeconds: 30 });

    advance(1);
    const first = await store.reportBoardDisplayed(board.id);
    expect(first.displayed).toBe(true);
    expect(first.board.displayedAt).toBe('2026-05-27T10:00:01.000Z');
    expect(first.board.lastDisplayedAt).toBe('2026-05-27T10:00:01.000Z');
    expect(first.board.endedAt).toBeNull();

    advance(1);
    const second = await store.reportBoardDisplayed(board.id);
    expect(second.displayed).toBe(true);
    expect(second.board.displayedAt).toBe('2026-05-27T10:00:01.000Z');
    expect(second.board.lastDisplayedAt).toBe('2026-05-27T10:00:02.000Z');
    expect((await store.currentBoard()).id).toBe(board.id);
  });

  it('safely ignores displayed reports for missing, expired, or non-current boards', async () => {
    const missingCase = makeStore();
    expect(await missingCase.store.reportBoardDisplayed('missing')).toEqual({ displayed: false, board: null });

    const expiredCase = makeStore();
    const expired = await expiredCase.store.createBoard({ text: 'short', durationSeconds: 1 });
    expiredCase.advance(2);
    expect(await expiredCase.store.reportBoardDisplayed(expired.id)).toEqual({ displayed: false, board: null });

    const replacedCase = makeStore();
    const old = await replacedCase.store.createBoard({ text: 'old', durationSeconds: 30 });
    await replacedCase.store.createBoard({ text: 'new', durationSeconds: 30 });
    expect(await replacedCase.store.reportBoardDisplayed(old.id)).toEqual({ displayed: false, board: null });
  });

  it('dismisses only the current board', async () => {
    const { store } = makeStore();
    expect(await store.dismissBoard('missing')).toEqual({ dismissed: false, board: null });

    const first = await store.createBoard({ text: 'old', durationSeconds: 30 });
    const second = await store.createBoard({ text: 'new', durationSeconds: 30 });

    const oldDismiss = await store.dismissBoard(first.id);
    expect(oldDismiss.dismissed).toBe(false);
    expect(oldDismiss.board.endedReason).toBe('replaced');

    const dismissed = await store.dismissBoard(second.id);
    expect(dismissed.dismissed).toBe(true);
    expect(dismissed.board.endedReason).toBe('dismissed');
    expect(await store.currentBoard()).toBeNull();
  });

  it('keeps a bounded newest-first board history with current markers and missing records skipped', async () => {
    const { store, redis, config, advance } = makeStore({ config: { boardHistoryLimit: 3 } });

    const first = await store.createBoard({ text: 'one', durationSeconds: 30 });
    advance(1);
    const second = await store.createBoard({ text: 'two', durationSeconds: 30 });
    advance(1);
    const third = await store.createBoard({ text: 'three', durationSeconds: 30 });
    advance(1);
    const fourth = await store.createBoard({ text: 'four', durationSeconds: 30 });

    let history = await store.listBoardHistory();
    expect(history.map((item) => item.id)).toEqual([fourth.id, third.id, second.id]);
    expect(history[0]).toEqual({
      id: fourth.id,
      text: 'four',
      createdAt: '2026-05-27T10:00:03.000Z',
      isCurrent: true,
    });
    expect(history[1].isCurrent).toBeUndefined();
    expect(history.some((item) => item.id === first.id)).toBe(false);

    await redis.del(store.boardKey(third.id));
    history = await store.listBoardHistory();
    expect(history.map((item) => item.id)).toEqual([fourth.id, second.id]);

    await store.clearBoard();
    history = await store.listBoardHistory();
    expect(history.find((item) => item.id === fourth.id).isCurrent).toBeUndefined();
    expect(redis.values.get(`${config.keyPrefix}:boardHistory`).map((item) => item.member)).toHaveLength(3);
  });
});

describe('RemoteMessageStore display status', () => {
  it('stores receiver status and returns board summaries', async () => {
    const { store } = makeStore();
    const board = await store.createBoard({ text: 'hello', durationSeconds: 30 });
    await store.reportBoardDisplayed(board.id);
    await store.updateReceiverStatus({
      dnd: true,
      lastStatus: 'displaying',
      lastDisplayBoardId: board.id,
      remoteDisplayActive: true,
    });

    const status = await store.getDisplayStatus();
    expect(status.receiver.online).toBe(true);
    expect(status.receiver.dnd).toBe(true);
    expect(status.receiver.lastStatus).toBe('displaying');
    expect(status.receiver.lastDisplayBoardId).toBe(board.id);
    expect(status.currentBoard.id).toBe(board.id);
    expect(status.currentDisplay.id).toBe(board.id);
    expect(status.pendingTransientCount).toBeUndefined();
    expect(status.currentSticky).toBeUndefined();
  });

  it('marks receiver offline-ish when status is stale', async () => {
    const { store, advance } = makeStore({ config: { receiverStatusTtlSeconds: 5 } });
    await store.updateReceiverStatus({ lastStatus: 'ok' });
    advance(6);

    const status = await store.getDisplayStatus();
    expect(status.receiver.online).toBe(false);
  });
});

describe('RemoteMessageStore guardrails', () => {
  it('applies sender rate limits', async () => {
    const { store } = makeStore({ config: { senderRateLimitCount: 1 } });
    expect((await store.checkSenderRateLimit()).allowed).toBe(true);
    expect((await store.checkSenderRateLimit()).allowed).toBe(false);
  });
});
