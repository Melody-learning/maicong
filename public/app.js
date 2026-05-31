(function () {
  const tokenInput = document.querySelector('#send-token');
  const rememberInput = document.querySelector('#remember-token');
  const textInput = document.querySelector('#message-text');
  const form = document.querySelector('#sender-form');
  const sendButton = document.querySelector('#send-button');
  const clearButton = document.querySelector('#clear-button');
  const refreshStatusButton = document.querySelector('#refresh-status-button');
  const statusEl = document.querySelector('#status');
  const receiverStateEl = document.querySelector('#receiver-state');
  const dndStateEl = document.querySelector('#dnd-state');
  const boardStateEl = document.querySelector('#board-state');
  const expiresStateEl = document.querySelector('#expires-state');
  const statusDetailEl = document.querySelector('#status-detail');
  const historyStateEl = document.querySelector('#history-state');
  const historyListEl = document.querySelector('#history-list');
  const storageKey = 'k20gt.sendToken';

  function getSendToken() {
    return tokenInput.value.trim();
  }

  function selectedDurationSeconds() {
    const checked = document.querySelector('input[name="duration"]:checked');
    return checked ? Number(checked.value) : 30;
  }

  function setBusy(isBusy) {
    sendButton.disabled = isBusy;
    clearButton.disabled = isBusy;
    refreshStatusButton.disabled = isBusy;
    tokenInput.disabled = isBusy;
    textInput.disabled = isBusy;
    rememberInput.disabled = isBusy;
    for (const input of document.querySelectorAll('input[name="duration"]')) {
      input.disabled = isBusy;
    }
  }

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = kind ? `status ${kind}` : 'status';
  }

  function rememberTokenIfNeeded() {
    if (rememberInput.checked) {
      localStorage.setItem(storageKey, getSendToken());
    } else {
      localStorage.removeItem(storageKey);
    }
  }

  async function parseResponse(response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      return { error: 'invalid_response', raw: text };
    }
  }

  function formatError(data, fallback) {
    const code = data && data.error ? data.error : fallback;
    if (code === 'validation_failed' && Array.isArray(data.details)) {
      return `${code}: ${data.details.join(', ')}`;
    }
    if (code === 'rate_limited' && data.rate && data.rate.resetAt) {
      return `${code}: 请稍后再试`;
    }
    return code || 'request_failed';
  }

  async function apiRequest(path, body, options) {
    const token = getSendToken();
    if (!token) {
      throw new Error('missing_send_token');
    }

    const method = options && options.method ? options.method : 'POST';
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    if (body) headers['Content-Type'] = 'application/json';

    const response = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await parseResponse(response);
    if (!response.ok) {
      throw new Error(formatError(data, `http_${response.status}`));
    }
    return data;
  }

  async function createBoard(text, durationSeconds) {
    return apiRequest('/api/board', { text, durationSeconds });
  }

  async function clearBoard() {
    return apiRequest('/api/board', null, { method: 'DELETE' });
  }

  async function fetchDisplayStatus() {
    return apiRequest('/api/display/status', null, { method: 'GET' });
  }

  async function fetchBoardHistory() {
    return apiRequest('/api/board/history', null, { method: 'GET' });
  }

  function formatTime(iso) {
    if (!iso) return '未知';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatRemaining(iso) {
    if (!iso) return '未知';
    const ms = new Date(iso).getTime() - Date.now();
    if (!Number.isFinite(ms)) return '未知';
    if (ms <= 0) return '已到期';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `约 ${seconds} 秒后`;
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `约 ${minutes} 分钟后`;
    return `约 ${Math.ceil(minutes / 60)} 小时后`;
  }

  function setDisplayStatus(data) {
    const receiver = (data && data.receiver) || {};
    receiverStateEl.textContent = receiver.online ? '最近在线' : '离线或未上报';
    dndStateEl.textContent = receiver.dnd ? '勿扰中' : '未勿扰';

    const board = data && data.currentBoard;
    boardStateEl.textContent = board ? board.text : '小黑板是空的';
    expiresStateEl.textContent = board ? `${formatRemaining(board.expiresAt)}，${formatTime(board.expiresAt)}` : '无';

    const current = data && data.currentDisplay;
    if (current) {
      statusDetailEl.textContent = `receiver 上次显示：${current.text}。勿扰由 receiver 本地控制。`;
    } else if (receiver.remoteDisplayActive) {
      statusDetailEl.textContent = 'receiver 报告远程显示仍在占用，但小黑板摘要暂不可用。勿扰由 receiver 本地控制。';
    } else {
      statusDetailEl.textContent = '当前没有 receiver 上报的远程显示占用。勿扰由 receiver 本地控制。';
    }
  }

  function setHistoryState(message, kind) {
    historyStateEl.textContent = message;
    historyStateEl.className = kind ? `history-state ${kind}` : 'history-state';
  }

  function renderBoardHistory(data) {
    const boards = data && Array.isArray(data.boards) ? data.boards : [];
    historyListEl.replaceChildren();

    if (boards.length === 0) {
      setHistoryState('还没有最近小黑板。', '');
      return;
    }

    setHistoryState('', '');
    for (const board of boards) {
      const item = document.createElement('article');
      item.className = board.isCurrent ? 'history-item current' : 'history-item';

      const meta = document.createElement('div');
      meta.className = 'history-meta';

      const time = document.createElement('span');
      time.textContent = formatTime(board.createdAt);
      meta.appendChild(time);

      if (board.isCurrent) {
        const marker = document.createElement('span');
        marker.className = 'history-current';
        marker.textContent = '当前';
        meta.appendChild(marker);
      }

      const text = document.createElement('p');
      text.className = 'history-text';
      text.textContent = board.text || '';

      item.appendChild(meta);
      item.appendChild(text);
      historyListEl.appendChild(item);
    }
  }

  async function refreshDisplayStatus(options) {
    if (!getSendToken()) {
      if (!options || !options.silent) setStatus('请输入 SEND_TOKEN 后刷新状态。', 'error');
      return;
    }

    refreshStatusButton.disabled = true;
    try {
      rememberTokenIfNeeded();
      const data = await fetchDisplayStatus();
      setDisplayStatus(data);
      if (!options || !options.silent) setStatus('状态已刷新。', 'success');
    } catch (error) {
      if (!options || !options.silent) setStatus(`刷新状态失败：${error.message}`, 'error');
    } finally {
      refreshStatusButton.disabled = false;
    }
  }

  async function refreshBoardHistory(options) {
    if (!getSendToken()) {
      setHistoryState('输入 SEND_TOKEN 后会显示最近小黑板。', '');
      historyListEl.replaceChildren();
      return;
    }

    try {
      rememberTokenIfNeeded();
      const data = await fetchBoardHistory();
      renderBoardHistory(data);
    } catch (error) {
      historyListEl.replaceChildren();
      setHistoryState('最近记录加载失败，请稍后再试。', 'error');
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const text = textInput.value.trim();
    const durationSeconds = selectedDurationSeconds();
    if (!getSendToken()) {
      setStatus('请输入 SEND_TOKEN。', 'error');
      tokenInput.focus();
      return;
    }
    if (!text) {
      setStatus('请输入要显示的文字。', 'error');
      textInput.focus();
      return;
    }

    setBusy(true);
    setStatus('正在发送...', '');
    try {
      rememberTokenIfNeeded();
      await createBoard(text, durationSeconds);
      setStatus('已经写到小黑板。', 'success');
      await Promise.all([refreshDisplayStatus({ silent: true }), refreshBoardHistory({ silent: true })]);
    } catch (error) {
      setStatus(`发送失败：${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!getSendToken()) {
      setStatus('请输入 SEND_TOKEN。', 'error');
      tokenInput.focus();
      return;
    }

    setBusy(true);
    setStatus('正在清空...', '');
    try {
      rememberTokenIfNeeded();
      const result = await clearBoard();
      setStatus(result.cleared ? '小黑板已清空。' : '小黑板本来就是空的。', 'success');
      await Promise.all([refreshDisplayStatus({ silent: true }), refreshBoardHistory({ silent: true })]);
    } catch (error) {
      setStatus(`清空失败：${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  function hydrateToken() {
    const saved = localStorage.getItem(storageKey);
    if (saved) tokenInput.value = saved;
  }

  window.getSendToken = getSendToken;
  window.createBoard = createBoard;
  window.clearBoard = clearBoard;
  window.fetchDisplayStatus = fetchDisplayStatus;
  window.fetchBoardHistory = fetchBoardHistory;
  window.setDisplayStatus = setDisplayStatus;
  window.renderBoardHistory = renderBoardHistory;
  window.refreshBoardHistory = refreshBoardHistory;

  hydrateToken();
  form.addEventListener('submit', handleSubmit);
  clearButton.addEventListener('click', handleClear);
  refreshStatusButton.addEventListener('click', async () => {
    await refreshDisplayStatus();
    await refreshBoardHistory({ silent: true });
  });
  if (getSendToken()) {
    refreshDisplayStatus({ silent: true });
    refreshBoardHistory({ silent: true });
  }
})();
