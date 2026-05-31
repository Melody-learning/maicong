function countCharacters(text) {
  return Array.from(text).length;
}

function validateDuration(value, config, errors) {
  if (
    !Number.isInteger(value) ||
    value < config.minBoardDurationSeconds ||
    value > config.maxBoardDurationSeconds
  ) {
    errors.push(
      `durationSeconds must be an integer between ${config.minBoardDurationSeconds} and ${config.maxBoardDurationSeconds}`
    );
  }
}

function validateCreateBoardPayload(payload, config) {
  const errors = [];
  const body = payload && typeof payload === 'object' ? payload : {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (body.type !== undefined || body.ttlSeconds !== undefined || body.displaySeconds !== undefined) {
    errors.push('legacy sticky/transient fields are not supported; provide durationSeconds');
  }

  if (!text) {
    errors.push('text is required');
  } else if (countCharacters(text) > config.maxMessageChars) {
    errors.push(`text must be ${config.maxMessageChars} characters or fewer`);
  }

  validateDuration(body.durationSeconds, config, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      text,
      durationSeconds: body.durationSeconds,
    },
  };
}

module.exports = {
  countCharacters,
  validateCreateBoardPayload,
  validateCreatePayload: validateCreateBoardPayload,
};
