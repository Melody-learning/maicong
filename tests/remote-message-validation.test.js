import { describe, it, expect } from 'vitest';
import configModule from '../lib/remote-message/config.js';
import apiModule from '../lib/remote-message/api.js';
import validationModule from '../lib/remote-message/validation.js';

const { DEFAULTS } = configModule;
const { authorize } = apiModule;
const { validateCreatePayload } = validationModule;

const config = {
  ...DEFAULTS,
  sendToken: 'send-secret',
  receiverToken: 'receiver-secret',
};

describe('message validation', () => {
  it('accepts valid sticky and transient payloads', () => {
    expect(validateCreatePayload({ type: 'sticky', text: '今天别熬夜' }, config).ok).toBe(true);
    const transient = validateCreatePayload({ type: 'transient', text: 'ping' }, config);
    expect(transient.ok).toBe(true);
    expect(transient.value.ttlSeconds).toBeUndefined();
    expect(transient.value.displaySeconds).toBe(DEFAULTS.defaultDisplaySeconds);
  });

  it('rejects invalid type, empty text, long text, and invalid timing', () => {
    expect(validateCreatePayload({ type: 'note', text: 'x' }, config).ok).toBe(false);
    expect(validateCreatePayload({ type: 'sticky', text: '   ' }, config).ok).toBe(false);
    expect(validateCreatePayload({ type: 'sticky', text: 'x'.repeat(33) }, config).ok).toBe(false);
    expect(validateCreatePayload({ type: 'transient', text: 'x', ttlSeconds: 0 }, config).ok).toBe(false);
    expect(validateCreatePayload({ type: 'transient', text: 'x', displaySeconds: 301 }, config).ok).toBe(false);
  });
});

describe('token authorization', () => {
  it('requires matching bearer tokens', () => {
    const req = { headers: { authorization: 'Bearer send-secret' } };
    expect(authorize(req, config, [config.sendToken])).toBe(true);
    expect(authorize(req, config, [config.receiverToken])).toBe(false);
    expect(authorize({ headers: {} }, config, [config.sendToken])).toBe('');
  });

  it('allows clear-style endpoints to accept either configured token', () => {
    const sendReq = { headers: { authorization: 'Bearer send-secret' } };
    const receiverReq = { headers: { authorization: 'Bearer receiver-secret' } };
    expect(authorize(sendReq, config, [config.sendToken, config.receiverToken])).toBe(true);
    expect(authorize(receiverReq, config, [config.sendToken, config.receiverToken])).toBe(true);
  });
});
