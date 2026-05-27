(function () {
  const tokenInput = document.querySelector('#send-token');
  const rememberInput = document.querySelector('#remember-token');
  const textInput = document.querySelector('#message-text');
  const form = document.querySelector('#sender-form');
  const sendButton = document.querySelector('#send-button');
  const clearButton = document.querySelector('#clear-button');
  const statusEl = document.querySelector('#status');
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

  async function apiRequest(path, body) {
    const token = getSendToken();
    if (!token) {
      throw new Error('missing_send_token');
    }

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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

  hydrateToken();
  form.addEventListener('submit', handleSubmit);
  clearButton.addEventListener('click', handleClear);
})();
