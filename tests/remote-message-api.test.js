import { describe, it, expect, vi } from 'vitest';
import apiModule from '../lib/remote-message/api.js';
import configModule from '../lib/remote-message/config.js';

const {
  handleBoard,
  handleBoardHistory,
  handleBoardDisplayed,
  handleBoardDismiss,
  handleCreateMessage,
  handleDisplayStatus,
} = apiModule;
const { DEFAULTS } = configModule;

function makeReq({ method = 'GET', token = 'send-secret', body, query } = {}) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
    query,
  };
}

function makeRes() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end: vi.fn(function end(body) {
      this.body = body;
    }),
  };
}

function parseBody(res) {
  return res.body ? JSON.parse(res.body) : {};
}

const config = {
  ...DEFAULTS,
  sendToken: 'send-secret',
  receiverToken: 'receiver-secret',
  redisUrl: 'https://redis.example',
  redisToken: 'redis-secret',
};

describe('board API', () => {
  it('allows sender token to create, read, and clear boards', async () => {
    const board = { id: 'board_1', text: 'hello', durationSeconds: 30, expiresAt: 'later' };
    const store = {
      checkSenderRateLimit: vi.fn(async () => ({ allowed: true })),
      createBoard: vi.fn(async () => board),
      currentBoard: vi.fn(async () => board),
      clearBoard: vi.fn(async () => board),
    };

    const createRes = makeRes();
    await handleBoard(makeReq({ method: 'POST', body: { text: 'hello', durationSeconds: 30 } }), createRes, {
      config,
      store,
    });
    expect(createRes.statusCode).toBe(201);
    expect(parseBody(createRes).board.id).toBe('board_1');
    expect(store.createBoard).toHaveBeenCalledWith({ text: 'hello', durationSeconds: 30 });

    const getRes = makeRes();
    await handleBoard(makeReq({ method: 'GET', token: 'receiver-secret' }), getRes, { config, store });
    expect(getRes.statusCode).toBe(200);
    expect(parseBody(getRes).board.id).toBe('board_1');

    const deleteRes = makeRes();
    await handleBoard(makeReq({ method: 'DELETE' }), deleteRes, { config, store });
    expect(deleteRes.statusCode).toBe(200);
    expect(parseBody(deleteRes).cleared).toBe(true);
  });

  it('rejects unauthorized and invalid board creation', async () => {
    const store = { checkSenderRateLimit: vi.fn(), createBoard: vi.fn() };

    const unauthorized = makeRes();
    await handleBoard(makeReq({ method: 'POST', token: 'bad', body: { text: 'hello', durationSeconds: 30 } }), unauthorized, {
      config,
      store,
    });
    expect(unauthorized.statusCode).toBe(401);

    const invalid = makeRes();
    await handleBoard(makeReq({ method: 'POST', body: { type: 'sticky', text: 'hello' } }), invalid, { config, store });
    expect(invalid.statusCode).toBe(400);
    expect(parseBody(invalid).error).toBe('validation_failed');
    expect(store.createBoard).not.toHaveBeenCalled();
  });

  it('applies sender rate limits', async () => {
    const store = {
      checkSenderRateLimit: vi.fn(async () => ({ allowed: false, count: 11, limit: 10 })),
      createBoard: vi.fn(),
    };
    const res = makeRes();

    await handleBoard(makeReq({ method: 'POST', body: { text: 'hello', durationSeconds: 30 } }), res, {
      config,
      store,
    });

    expect(res.statusCode).toBe(429);
    expect(store.createBoard).not.toHaveBeenCalled();
  });

  it('allows receiver token to report displayed and dismiss by id', async () => {
    const board = { id: 'board/1', text: 'hello', durationSeconds: 30, expiresAt: 'later' };
    const store = {
      reportBoardDisplayed: vi.fn(async () => ({ displayed: true, board })),
      dismissBoard: vi.fn(async () => ({ dismissed: true, board })),
    };

    const displayedRes = makeRes();
    await handleBoardDisplayed(makeReq({ method: 'POST', token: 'receiver-secret', query: { id: 'board/1' } }), displayedRes, {
      config,
      store,
    });
    expect(displayedRes.statusCode).toBe(200);
    expect(parseBody(displayedRes).displayed).toBe(true);
    expect(store.reportBoardDisplayed).toHaveBeenCalledWith('board/1');

    const dismissRes = makeRes();
    await handleBoardDismiss(makeReq({ method: 'POST', token: 'receiver-secret', query: { id: 'board/1' } }), dismissRes, {
      config,
      store,
    });
    expect(dismissRes.statusCode).toBe(200);
    expect(parseBody(dismissRes).dismissed).toBe(true);
    expect(store.dismissBoard).toHaveBeenCalledWith('board/1');
  });

  it('rejects sender token for receiver-only board dismiss', async () => {
    const store = { dismissBoard: vi.fn() };
    const res = makeRes();

    await handleBoardDismiss(makeReq({ method: 'POST', token: 'send-secret', query: { id: 'board_1' } }), res, {
      config,
      store,
    });

    expect(res.statusCode).toBe(401);
    expect(store.dismissBoard).not.toHaveBeenCalled();
  });

  it('allows sender token only to read board history', async () => {
    const boards = [{ id: 'board_2', text: 'new', createdAt: '2026-05-29T00:00:00.000Z', isCurrent: true }];
    const store = {
      listBoardHistory: vi.fn(async () => boards),
    };

    const senderRes = makeRes();
    await handleBoardHistory(makeReq({ method: 'GET', token: 'send-secret' }), senderRes, { config, store });
    expect(senderRes.statusCode).toBe(200);
    expect(parseBody(senderRes)).toEqual({ boards });
    expect(store.listBoardHistory).toHaveBeenCalledTimes(1);

    const receiverRes = makeRes();
    await handleBoardHistory(makeReq({ method: 'GET', token: 'receiver-secret' }), receiverRes, { config, store });
    expect(receiverRes.statusCode).toBe(401);

    const missingRes = makeRes();
    await handleBoardHistory(makeReq({ method: 'GET', token: '' }), missingRes, { config, store });
    expect(missingRes.statusCode).toBe(401);
    expect(store.listBoardHistory).toHaveBeenCalledTimes(1);
  });

  it('retires legacy message endpoints', async () => {
    const res = makeRes();
    await handleCreateMessage(makeReq({ method: 'POST' }), res);
    expect(res.statusCode).toBe(410);
    expect(parseBody(res)).toEqual({ error: 'messages_api_retired', replacement: '/api/board' });
  });
});

describe('display status API', () => {
  it('allows sender token to read board-oriented display status', async () => {
    const store = {
      getDisplayStatus: vi.fn(async () => ({ receiver: { online: true }, currentBoard: null })),
    };
    const res = makeRes();

    await handleDisplayStatus(makeReq({ method: 'GET', token: 'send-secret' }), res, { config, store });

    expect(res.statusCode).toBe(200);
    expect(parseBody(res)).toEqual({ receiver: { online: true }, currentBoard: null });
    expect(store.getDisplayStatus).toHaveBeenCalledTimes(1);
  });

  it('rejects receiver token for sender status reads', async () => {
    const store = { getDisplayStatus: vi.fn() };
    const res = makeRes();

    await handleDisplayStatus(makeReq({ method: 'GET', token: 'receiver-secret' }), res, { config, store });

    expect(res.statusCode).toBe(401);
    expect(store.getDisplayStatus).not.toHaveBeenCalled();
  });

  it('allows receiver token to update receiver status', async () => {
    const store = {
      updateReceiverStatus: vi.fn(async (payload) => ({ ...payload, updatedAt: '2026-05-28T00:00:00.000Z' })),
    };
    const res = makeRes();

    await handleDisplayStatus(
      makeReq({ method: 'POST', token: 'receiver-secret', body: { dnd: true, lastStatus: 'dnd' } }),
      res,
      { config, store }
    );

    expect(res.statusCode).toBe(200);
    expect(parseBody(res).receiver.dnd).toBe(true);
    expect(store.updateReceiverStatus).toHaveBeenCalledWith({ dnd: true, lastStatus: 'dnd' });
  });

  it('rejects sender token for receiver status updates', async () => {
    const store = { updateReceiverStatus: vi.fn() };
    const res = makeRes();

    await handleDisplayStatus(makeReq({ method: 'POST', token: 'send-secret', body: { dnd: true } }), res, {
      config,
      store,
    });

    expect(res.statusCode).toBe(401);
    expect(store.updateReceiverStatus).not.toHaveBeenCalled();
  });
});
