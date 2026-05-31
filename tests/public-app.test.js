import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this._textContent = '';
    this.className = '';
    this.disabled = false;
    this.value = '';
    this.checked = false;
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
    this._textContent = '';
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  async dispatchEvent(event) {
    const listeners = this.listeners.get(event.type) || [];
    await Promise.all(listeners.map((listener) => listener(event)));
  }
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

function makeLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) || null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key)),
  };
}

function loadApp({ fetchImpl = vi.fn(), localStorage = makeLocalStorage() } = {}) {
  const durationInput = new FakeElement('input');
  durationInput.value = '30';
  durationInput.checked = true;

  const elements = {
    'send-token': new FakeElement('input'),
    'remember-token': new FakeElement('input'),
    'message-text': new FakeElement('textarea'),
    'sender-form': new FakeElement('form'),
    'send-button': new FakeElement('button'),
    'clear-button': new FakeElement('button'),
    'refresh-status-button': new FakeElement('button'),
    status: new FakeElement('p'),
    'receiver-state': new FakeElement('dd'),
    'dnd-state': new FakeElement('dd'),
    'board-state': new FakeElement('dd'),
    'expires-state': new FakeElement('dd'),
    'status-detail': new FakeElement('p'),
    'history-state': new FakeElement('p'),
    'history-list': new FakeElement('div'),
  };
  elements['remember-token'].checked = true;

  const document = {
    querySelector(selector) {
      if (selector.startsWith('#')) return elements[selector.slice(1)];
      if (selector === 'input[name="duration"]:checked') return durationInput;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="duration"]') return [durationInput];
      return [];
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };

  const window = {};
  const context = {
    window,
    document,
    localStorage,
    fetch: fetchImpl,
    Date,
  };
  vm.runInNewContext(fs.readFileSync('public/app.js', 'utf8'), context);
  return { window, elements, fetchImpl, localStorage };
}

describe('public sender app history UI', () => {
  it('renders successful history, empty history, and current markers', () => {
    const { window, elements } = loadApp();

    window.renderBoardHistory({
      boards: [
        {
          id: 'board_2',
          text: 'new note',
          createdAt: '2026-05-29T00:00:00.000Z',
          isCurrent: true,
        },
        {
          id: 'board_1',
          text: 'old note',
          createdAt: '2026-05-28T23:59:00.000Z',
        },
      ],
    });

    expect(elements['history-state'].textContent).toBe('');
    expect(elements['history-list'].children).toHaveLength(2);
    expect(elements['history-list'].children[0].className).toBe('history-item current');
    expect(elements['history-list'].children[0].textContent).toContain('当前');
    expect(elements['history-list'].children[0].textContent).toContain('new note');
    expect(elements['history-list'].children[1].textContent).not.toContain('当前');

    window.renderBoardHistory({ boards: [] });
    expect(elements['history-list'].children).toHaveLength(0);
    expect(elements['history-state'].textContent).toBe('还没有最近小黑板。');
  });

  it('refreshes history after board creation and clearing', async () => {
    let cleared = false;
    const fetchImpl = vi.fn(async (path, options = {}) => {
      if (path === '/api/board' && options.method === 'POST') {
        return jsonResponse({ board: { id: 'board_1', text: 'hi' } }, 201);
      }
      if (path === '/api/board' && options.method === 'DELETE') {
        cleared = true;
        return jsonResponse({ cleared: true, board: { id: 'board_1', text: 'hi' } });
      }
      if (path === '/api/display/status') {
        return jsonResponse({ receiver: { online: true, dnd: false }, currentBoard: null, currentDisplay: null });
      }
      if (path === '/api/board/history') {
        return jsonResponse({
          boards: [
            {
              id: 'board_1',
              text: 'hi',
              createdAt: '2026-05-29T00:00:00.000Z',
              isCurrent: cleared ? undefined : true,
            },
          ],
        });
      }
      throw new Error(`unexpected request ${path}`);
    });
    const { elements } = loadApp({ fetchImpl });
    elements['send-token'].value = 'send-secret';
    elements['message-text'].value = 'hi';

    await elements['sender-form'].dispatchEvent({ type: 'submit', preventDefault: vi.fn() });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/board/history',
      expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer send-secret' } })
    );
    expect(elements['history-list'].children[0].textContent).toContain('当前');

    await elements['clear-button'].dispatchEvent({ type: 'click' });
    expect(fetchImpl.mock.calls.filter(([path]) => path === '/api/board/history')).toHaveLength(2);
    expect(elements['history-list'].children[0].textContent).not.toContain('当前');
  });

  it('shows a readable history load failure without changing the token', async () => {
    const fetchImpl = vi.fn(async (path) => {
      if (path === '/api/board/history') return jsonResponse({ error: 'unauthorized' }, 401);
      return jsonResponse({});
    });
    const { window, elements } = loadApp({ fetchImpl });
    elements['send-token'].value = 'send-secret';

    await window.refreshBoardHistory();

    expect(elements['history-list'].children).toHaveLength(0);
    expect(elements['history-state'].textContent).toBe('最近记录加载失败，请稍后再试。');
    expect(elements['history-state'].className).toBe('history-state error');
    expect(elements['send-token'].value).toBe('send-secret');
  });
});
