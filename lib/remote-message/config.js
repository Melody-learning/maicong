const DEFAULTS = {
  maxMessageChars: 32,
  senderRateLimitCount: 10,
  senderRateLimitWindowSeconds: 60,
  transientQueueLimit: 5,
  defaultTransientTtlSeconds: 300,
  defaultDisplaySeconds: 20,
  minTtlSeconds: 1,
  maxTtlSeconds: 86400,
  minDisplaySeconds: 1,
  maxDisplaySeconds: 300,
  receiverStatusTtlSeconds: 30,
  keyPrefix: 'k20gt:remote-message',
};

function readInteger(name, fallback, env = process.env) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function getConfig(env = process.env) {
  return {
    sendToken: env.SEND_TOKEN || '',
    receiverToken: env.RECEIVER_TOKEN || '',
    redisUrl: env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '',
    redisToken: env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '',
    maxMessageChars: readInteger('MAX_MESSAGE_CHARS', DEFAULTS.maxMessageChars, env),
    senderRateLimitCount: readInteger('SENDER_RATE_LIMIT_COUNT', DEFAULTS.senderRateLimitCount, env),
    senderRateLimitWindowSeconds: readInteger('SENDER_RATE_LIMIT_WINDOW_SECONDS', DEFAULTS.senderRateLimitWindowSeconds, env),
    transientQueueLimit: readInteger('TRANSIENT_QUEUE_LIMIT', DEFAULTS.transientQueueLimit, env),
    defaultTransientTtlSeconds: readInteger('DEFAULT_TRANSIENT_TTL_SECONDS', DEFAULTS.defaultTransientTtlSeconds, env),
    defaultDisplaySeconds: readInteger('DEFAULT_DISPLAY_SECONDS', DEFAULTS.defaultDisplaySeconds, env),
    minTtlSeconds: readInteger('MIN_TTL_SECONDS', DEFAULTS.minTtlSeconds, env),
    maxTtlSeconds: readInteger('MAX_TTL_SECONDS', DEFAULTS.maxTtlSeconds, env),
    minDisplaySeconds: readInteger('MIN_DISPLAY_SECONDS', DEFAULTS.minDisplaySeconds, env),
    maxDisplaySeconds: readInteger('MAX_DISPLAY_SECONDS', DEFAULTS.maxDisplaySeconds, env),
    receiverStatusTtlSeconds: readInteger(
      'RECEIVER_STATUS_TTL_SECONDS',
      DEFAULTS.receiverStatusTtlSeconds,
      env
    ),
    keyPrefix: env.REDIS_KEY_PREFIX || DEFAULTS.keyPrefix,
  };
}

function assertRequiredConfig(config = getConfig()) {
  const missing = [];
  if (!config.sendToken) missing.push('SEND_TOKEN');
  if (!config.receiverToken) missing.push('RECEIVER_TOKEN');
  if (!config.redisUrl) missing.push('UPSTASH_REDIS_REST_URL or KV_REST_API_URL');
  if (!config.redisToken) missing.push('UPSTASH_REDIS_REST_TOKEN or KV_REST_API_TOKEN');
  if (missing.length > 0) {
    const error = new Error(`Missing required configuration: ${missing.join(', ')}`);
    error.code = 'MISSING_CONFIG';
    error.missing = missing;
    throw error;
  }
}

module.exports = {
  DEFAULTS,
  getConfig,
  assertRequiredConfig,
};
