const { getConfig, assertRequiredConfig } = require('./config');
const { publicBoard } = require('./model');
const { validateCreateBoardPayload } = require('./validation');
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

async function handleBoard(req, res, options = {}) {
  const config = options.config || getConfig();
  try {
    assertRequiredConfig(config);
    const store = createStore(config, options);

    if (req.method === 'GET') {
      if (!authorize(req, config, [config.sendToken, config.receiverToken])) {
        return json(res, 401, { error: 'unauthorized' });
      }
      const board = await store.currentBoard();
      return json(res, 200, { board: publicBoard(board) });
    }

    if (req.method === 'DELETE') {
      if (!authorize(req, config, [config.sendToken])) return json(res, 401, { error: 'unauthorized' });
      const board = await store.clearBoard();
      return json(res, 200, { cleared: Boolean(board), board: publicBoard(board) });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    if (!authorize(req, config, [config.sendToken])) return json(res, 401, { error: 'unauthorized' });

    const payload = await readJson(req);
    const validated = validateCreateBoardPayload(payload, config);
    if (!validated.ok) return json(res, 400, { error: 'validation_failed', details: validated.errors });

    const rate = await store.checkSenderRateLimit();
    if (!rate.allowed) return json(res, 429, { error: 'rate_limited', rate });

    const board = await store.createBoard(validated.value);
    return json(res, 201, { board: publicBoard(board) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleBoardDisplayed(req, res, options = {}) {
  const config = options.config || getConfig();
  try {
    assertRequiredConfig(config);
    if (!authorize(req, config, [config.receiverToken])) return json(res, 401, { error: 'unauthorized' });
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    const id = req.query && req.query.id;
    const result = await createStore(config, options).reportBoardDisplayed(Array.isArray(id) ? id[0] : id);
    return json(res, 200, {
      displayed: result.displayed,
      board: publicBoard(result.board),
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleBoardHistory(req, res, options = {}) {
  const config = options.config || getConfig();
  try {
    assertRequiredConfig(config);
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
    if (!authorize(req, config, [config.sendToken])) return json(res, 401, { error: 'unauthorized' });
    const boards = await createStore(config, options).listBoardHistory();
    return json(res, 200, { boards });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleBoardDismiss(req, res, options = {}) {
  const config = options.config || getConfig();
  try {
    assertRequiredConfig(config);
    if (!authorize(req, config, [config.receiverToken])) return json(res, 401, { error: 'unauthorized' });
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
    const id = req.query && req.query.id;
    const result = await createStore(config, options).dismissBoard(Array.isArray(id) ? id[0] : id);
    return json(res, 200, {
      dismissed: result.dismissed,
      board: publicBoard(result.board),
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function handleLegacyMessages(req, res) {
  return json(res, 410, { error: 'messages_api_retired', replacement: '/api/board' });
}

async function handleCreateMessage(req, res) {
  return handleLegacyMessages(req, res);
}

async function handleNextMessage(req, res) {
  return handleLegacyMessages(req, res);
}

async function handleAckMessage(req, res) {
  return handleLegacyMessages(req, res);
}

async function handleDismissMessage(req, res) {
  return handleLegacyMessages(req, res);
}

async function handleClearSticky(req, res) {
  return handleLegacyMessages(req, res);
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
  handleBoard,
  handleBoardHistory,
  handleBoardDisplayed,
  handleBoardDismiss,
  handleCreateMessage,
  handleNextMessage,
  handleAckMessage,
  handleDismissMessage,
  handleClearSticky,
  handleDisplayStatus,
};
