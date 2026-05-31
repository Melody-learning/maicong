const ENDED_REASONS = Object.freeze({
  EXPIRED: 'expired',
  DISMISSED: 'dismissed',
  CLEARED: 'cleared',
  REPLACED: 'replaced',
});

function publicBoard(board) {
  if (!board) return null;
  return {
    id: board.id,
    text: board.text,
    durationSeconds: board.durationSeconds,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    expiresAt: board.expiresAt,
    displayedAt: board.displayedAt || null,
    lastDisplayedAt: board.lastDisplayedAt || null,
    endedAt: board.endedAt || null,
    endedReason: board.endedReason || null,
  };
}

function publicBoardHistoryItem(board, isCurrent = false) {
  if (!board) return null;
  const item = {
    id: board.id,
    text: board.text,
    createdAt: board.createdAt,
  };
  if (isCurrent) item.isCurrent = true;
  return item;
}

module.exports = {
  ENDED_REASONS,
  publicBoard,
  publicBoardHistoryItem,
};
