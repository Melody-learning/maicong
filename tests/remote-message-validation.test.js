import { describe, it, expect } from 'vitest';
import configModule from '../lib/remote-message/config.js';
import apiModule from '../lib/remote-message/api.js';
import validationModule from '../lib/remote-message/validation.js';

const { DEFAULTS } = configModule;
const { authorize } = apiModule;
const { validateCreateBoardPayload } = validationModule;

const config = {
  ...DEFAULTS,
  sendToken: 'send-secret',
  receiverToken: 'receiver-secret',
};

describe('board validation', () => {
  it('accepts valid board payloads', () => {
    const result = validateCreateBoardPayload({ text: '今天别熬夜', durationSeconds: 30 }, config);
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({ text: '今天别熬夜', durationSeconds: 30 });
  });

  it('rejects empty text, long text, invalid duration, and legacy message fields', () => {
    expect(validateCreateBoardPayload({ text: '   ', durationSeconds: 30 }, config).ok).toBe(false);
    expect(validateCreateBoardPayload({ text: 'x'.repeat(33), durationSeconds: 30 }, config).ok).toBe(false);
    expect(validateCreateBoardPayload({ text: 'x' }, config).ok).toBe(false);
    expect(validateCreateBoardPayload({ text: 'x', durationSeconds: 0 }, config).ok).toBe(false);
    expect(validateCreateBoardPayload({ text: 'x', durationSeconds: 86401 }, config).ok).toBe(false);
    expect(validateCreateBoardPayload({ type: 'sticky', text: 'x', durationSeconds: 30 }, config).ok).toBe(false);
    expect(validateCreateBoardPayload({ text: 'x', durationSeconds: 30, displaySeconds: 20 }, config).ok).toBe(false);
  });
});

describe('token authorization', () => {
  it('requires matching bearer tokens', () => {
    const req = { headers: { authorization: 'Bearer send-secret' } };
    expect(authorize(req, config, [config.sendToken])).toBe(true);
    expect(authorize(req, config, [config.receiverToken])).toBe(false);
    expect(authorize({ headers: {} }, config, [config.sendToken])).toBe('');
  });

  it('allows board reads to accept either configured token', () => {
    const sendReq = { headers: { authorization: 'Bearer send-secret' } };
    const receiverReq = { headers: { authorization: 'Bearer receiver-secret' } };
    expect(authorize(sendReq, config, [config.sendToken, config.receiverToken])).toBe(true);
    expect(authorize(receiverReq, config, [config.sendToken, config.receiverToken])).toBe(true);
  });

  it('allows dismiss-style endpoints to accept only the receiver token', () => {
    const sendReq = { headers: { authorization: 'Bearer send-secret' } };
    const receiverReq = { headers: { authorization: 'Bearer receiver-secret' } };
    expect(authorize(sendReq, config, [config.receiverToken])).toBe(false);
    expect(authorize(receiverReq, config, [config.receiverToken])).toBe(true);
  });
});
