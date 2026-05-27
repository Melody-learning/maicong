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
  const stickyStateEl = document.querySelector('#sticky-state');
  const transientStateEl = document.querySelector('#transient-state');
  const statusDetailEl = document.querySelector('#status-detail');
  const storageKey = 'k20gt.sendToken';

  function getSendToken() {
    return tokenInput.value.trim();
  }

  function selectedType() {
    const checked = document.querySelector('input[name="intent"]:checked');
    return checked ? checked.value : 'sticky';
  }

  function typeLabel(type) {
    return type === 'sticky' ? '贴上去' : '显示一下';
  }

  function setBusy(isBusy) {
    sendButton.disabled = isBusy;
    clearButton.disabled = isBusy;
    refreshStatusButton.disabled = isBusy;
    tokenInput.disabled = isBusy;
    textInput.disabled = isBusy;
    rememberInput.disabled = isBusy;
    for (const input of document.querySelectorAll('input[name="intent"]')) {
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

  async function createMessage(type, text, options) {
    const payload = Object.assign({ type, text }, options || {});
    return apiRequest('/api/messages', payload);
  }

  async function clearSticky() {
    return apiRequest('/api/messages/clear');
  }

  async function fetchDisplayStatus() {
    return apiRequest('/api/display/status', null, { method: 'GET' });
  }

  function displayStateLabel(state) {
    const labels = {
      active: '有效',
      showing: '显示中',
      dismissed: '已关闭',
      expired: '已过期',
      replaced: '已替换',
      cleared: '已清空',
      shown: '已显示',
    };
    return labels[state] || state || '未知';
  }

  function setDisplayStatus(data) {
    const receiver = (data && data.receiver) || {};
    receiverStateEl.textContent = receiver.online ? '最近在线' : '离线或未上报';
    dndStateEl.textContent = receiver.dnd ? '勿扰中' : '未勿扰';

    const sticky = data && data.currentSticky;
    stickyStateEl.textContent = sticky
      ? `${sticky.text}（${displayStateLabel(sticky.displayState)}）`
      : '没有当前贴上去';

    const count = data && typeof data.pendingTransientCount === 'number' ? data.pendingTransientCount : 0;
    transientStateEl.textContent = count > 0 ? `${count} 条等待显示` : '没有等待显示';

    const current = data && data.currentDisplay;
    if (current) {
      statusDetailEl.textContent = `当前远程显示：${current.text}（${displayStateLabel(current.displayState)}）。勿扰由 receiver 本地控制。`;
    } else if (receiver.remoteDisplayActive) {
      statusDetailEl.textContent = 'receiver 报告远程显示仍在占用，但消息摘要暂不可用。勿扰由 receiver 本地控制。';
    } else {
      statusDetailEl.textContent = '当前没有 receiver 上报的远程显示占用。勿扰由 receiver 本地控制。';
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

  async function handleSubmit(event) {
    event.preventDefault();
    const type = selectedType();
    const text = textInput.value.trim();
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
      await createMessage(type, text);
      setStatus(`${typeLabel(type)} 已发送。`, 'success');
      if (type === 'transient') textInput.value = '';
      await refreshDisplayStatus({ silent: true });
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
      const result = await clearSticky();
      setStatus(result.cleared ? '当前贴上去已清空。' : '当前没有需要清空的贴上去。', 'success');
      await refreshDisplayStatus({ silent: true });
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
  window.createMessage = createMessage;
  window.clearSticky = clearSticky;
  window.fetchDisplayStatus = fetchDisplayStatus;
  window.setDisplayStatus = setDisplayStatus;

  hydrateToken();
  form.addEventListener('submit', handleSubmit);
  clearButton.addEventListener('click', handleClear);
  refreshStatusButton.addEventListener('click', () => refreshDisplayStatus());
  if (getSendToken()) refreshDisplayStatus({ silent: true });
})();
