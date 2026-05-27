const MESSAGE_TYPES = Object.freeze({
  STICKY: 'sticky',
  TRANSIENT: 'transient',
});

const MESSAGE_STATUSES = Object.freeze({
  PENDING: 'pending',
  SHOWING: 'showing',
  SHOWN: 'shown',
  EXPIRED: 'expired',
});

const ENDED_REASONS = Object.freeze({
  TTL_EXPIRED: 'ttl_expired',
  DISMISSED: 'dismissed',
  CLEARED: 'cleared',
  REPLACED: 'replaced',
  SHOWN: 'shown',
  SHOWING_TIMEOUT: 'showing_timeout',
});

function displayState(message) {
  if (!message) return null;
  if (message.endedReason === ENDED_REASONS.DISMISSED) return 'dismissed';
  if (message.endedReason === ENDED_REASONS.CLEARED) return 'cleared';
  if (message.endedReason === ENDED_REASONS.REPLACED) return 'replaced';
  if (message.status === MESSAGE_STATUSES.SHOWN) return 'shown';
  if (message.status === MESSAGE_STATUSES.EXPIRED) return 'expired';
  if (message.status === MESSAGE_STATUSES.SHOWING) return 'showing';
  return 'active';
}

function publicMessage(message) {
  if (!message) return null;
  return {
    id: message.id,
    type: message.type,
    text: message.text,
    status: message.status,
    displaySeconds: message.displaySeconds,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    expiresAt: message.expiresAt || null,
    showingDeadlineAt: message.showingDeadlineAt || null,
    shownAt: message.shownAt || null,
    lastDisplayedAt: message.lastDisplayedAt || null,
    endedAt: message.endedAt || null,
    endedReason: message.endedReason || null,
    displayState: displayState(message),
  };
}

module.exports = {
  ENDED_REASONS,
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
  displayState,
  publicMessage,
};
