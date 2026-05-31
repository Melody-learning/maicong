const DEFAULTS = {
  maxMessageChars: 32,
  senderRateLimitCount: 10,
  senderRateLimitWindowSeconds: 60,
  minBoardDurationSeconds: 1,
  maxBoardDurationSeconds: 86400,
  boardHistoryLimit: 20,
  receiverStatusTtlSeconds: 30,
  keyPrefix: 'k20gt:remote-board',
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
    minBoardDurationSeconds: readInteger('MIN_BOARD_DURATION_SECONDS', DEFAULTS.minBoardDurationSeconds, env),
    maxBoardDurationSeconds: readInteger('MAX_BOARD_DURATION_SECONDS', DEFAULTS.maxBoardDurationSeconds, env),
    boardHistoryLimit: readInteger('BOARD_HISTORY_LIMIT', DEFAULTS.boardHistoryLimit, env),
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
