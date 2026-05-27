const { getConfig, assertRequiredConfig } = require('./config');
const { publicMessage } = require('./model');
const { validateCreatePayload } = require('./validation');
const { RemoteMessageStore, createRedisClient } = require('./redis-storage');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : '';
}

function authorize(req, config, allowedTokens) {
  const token = getBearerToken(req);
  return token && allowedTokens.includes(token);
}

async function readJson(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    if (Buffer.isBuffer(req.body)) {
      const body = req.body.toString('utf8');
      return body ? JSON.parse(body) : {};
    }
    return req.body || {};
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function createStore(config, options = {}) {
  assertRequiredConfig(config);
  if (options.store) return options.store;
  return new RemoteMessageStore({
    redis: createRedisClient(config),
    config,
  });
}

function handleError(res, error) {
  if (error.code === 'MISSING_CONFIG') {
    return json(res, 503, { error: 'missing_config', missing: error.missing });
  }
  if (error instanceof SyntaxError) {
    return json(res, 400, { error: 'invalid_json' });
  }
  console.error(error);
  return json(res, 500, { error: 'internal_error' });
}

async function handleCreateMessage(req, res) {
  const config = getConfig();
  try {
    assertRequiredConfig(config);
    if (!authorize(req, config, [config.sendToken])) return json(res, 401, { error: 'unauthorized' });
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

    const payload = await readJson(req);
    const validated = validateCreatePayload(payload, config);
    if (!validated.ok) return json(res, 400, { error: 'validation_failed', details: validated.errors });

    const store = createStore(config);
    const rate = await store.checkSenderRateLimit();
    if (!rate.allowed) return json(res, 429, { error: 'rate_limited', rate });

    try {
      const message = await store.createMessage(validated.value);
      return json(res, 201, { message: publicMessage(message) });
    } catch (error) {
      if (error.code === 'QUEUE_FULL') return json(res, 409, { error: 'queue_full' });
      throw error;
    }
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleNextMessage(req, res) {
  const config = getConfig();
  try {
    assertRequiredConfig(config);
    if (!authorize(req, config, [config.receiverToken])) return json(res, 401, { error: 'unauthorized' });
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
    const message = await createStore(config).nextMessage();
    return json(res, 200, { message: publicMessage(message) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleAckMessage(req, res) {
  const config = getConfig();
  try {
    assertRequiredConfig(config);
    if (!authorize(req, config, [config.receiverToken])) return json(res, 401, { error: 'unauthorized' });
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    const id = req.query && req.query.id;
    const result = await createStore(config).ackMessage(Array.isArray(id) ? id[0] : id);
    return json(res, 200, {
      acknowledged: result.acknowledged,
      message: publicMessage(result.message),
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleDismissMessage(req, res) {
  const config = getConfig();
  try {
    assertRequiredConfig(config);
    if (!authorize(req, config, [config.receiverToken])) return json(res, 401, { error: 'unauthorized' });
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    const id = req.query && req.query.id;
    const result = await createStore(config).dismissMessage(Array.isArray(id) ? id[0] : id);
    return json(res, 200, {
      dismissed: result.dismissed,
      message: publicMessage(result.message),
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleClearSticky(req, res) {
  const config = getConfig();
  try {
    assertRequiredConfig(config);
    if (!authorize(req, config, [config.sendToken, config.receiverToken])) {
      return json(res, 401, { error: 'unauthorized' });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    const message = await createStore(config).clearSticky();
    return json(res, 200, { cleared: Boolean(message), message: publicMessage(message) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleDisplayStatus(req, res, options = {}) {
  const config = options.config || getConfig();
  try {
    assertRequiredConfig(config);
    const store = createStore(config, options);

    if (req.method === 'GET') {
      if (!authorize(req, config, [config.sendToken])) return json(res, 401, { error: 'unauthorized' });
      const status = await store.getDisplayStatus();
      return json(res, 200, status);
    }

    if (req.method === 'POST') {
      if (!authorize(req, config, [config.receiverToken])) return json(res, 401, { error: 'unauthorized' });
      const payload = await readJson(req);
      const receiver = await store.updateReceiverStatus(payload || {});
      return json(res, 200, { receiver });
    }

    return json(res, 405, { error: 'method_not_allowed' });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  json,
  getBearerToken,
  authorize,
  readJson,
  handleCreateMessage,
  handleNextMessage,
  handleAckMessage,
  handleDismissMessage,
  handleClearSticky,
  handleDisplayStatus,
};
