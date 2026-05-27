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
  };
}

module.exports = {
  MESSAGE_TYPES,
  MESSAGE_STATUSES,
  publicMessage,
};
