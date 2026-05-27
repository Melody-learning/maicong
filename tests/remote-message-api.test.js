import { describe, it, expect, vi } from 'vitest';
import apiModule from '../lib/remote-message/api.js';
import configModule from '../lib/remote-message/config.js';

const { handleDisplayStatus } = apiModule;
const { DEFAULTS } = configModule;

function makeReq({ method = 'GET', token = 'send-secret', body } = {}) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
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

describe('display status API', () => {
  it('allows sender token to read display status', async () => {
    const store = {
      getDisplayStatus: vi.fn(async () => ({ receiver: { online: true }, pendingTransientCount: 0 })),
    };
    const res = makeRes();

    await handleDisplayStatus(makeReq({ method: 'GET', token: 'send-secret' }), res, { config, store });

    expect(res.statusCode).toBe(200);
    expect(parseBody(res)).toEqual({ receiver: { online: true }, pendingTransientCount: 0 });
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
