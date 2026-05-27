const { MESSAGE_TYPES } = require('./model');

function countCharacters(text) {
  return Array.from(text).length;
}

function validateTiming(name, value, min, max, errors) {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}`);
  }
}

function validateCreatePayload(payload, config) {
  const errors = [];
  const body = payload && typeof payload === 'object' ? payload : {};
  const type = body.type;
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (type !== MESSAGE_TYPES.STICKY && type !== MESSAGE_TYPES.TRANSIENT) {
    errors.push('type must be sticky or transient');
  }

  if (!text) {
    errors.push('text is required');
  } else if (countCharacters(text) > config.maxMessageChars) {
    errors.push(`text must be ${config.maxMessageChars} characters or fewer`);
  }

  validateTiming('ttlSeconds', body.ttlSeconds, config.minTtlSeconds, config.maxTtlSeconds, errors);
  validateTiming(
    'displaySeconds',
    body.displaySeconds,
    config.minDisplaySeconds,
    config.maxDisplaySeconds,
    errors,
  );

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      type,
      text,
      ttlSeconds: body.ttlSeconds,
      displaySeconds: body.displaySeconds || config.defaultDisplaySeconds,
    },
  };
}

module.exports = {
  countCharacters,
  validateCreatePayload,
};
