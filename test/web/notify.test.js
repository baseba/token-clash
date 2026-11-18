import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier } from '../../public/notify.js';

let shown;
let focused;
let listeners;

let asked;

function stubBrowser({ permission = 'granted' } = {}) {
  asked = 0;
  shown = [];
  focused = false;
  listeners = {};
  const on = (name, fn) => (listeners[name] = fn);
  globalThis.window = { addEventListener: on, focus: () => {} };
  globalThis.document = { title: 'Token Clash', hidden: false, hasFocus: () => focused, addEventListener: on, removeEventListener: (name) => delete listeners[name] };
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; } };
  globalThis.Notification = class {
    static permission = permission;
    static requestPermission = async () => (asked += 1, permission);
    constructor(title, opts) {
      shown.push({ title, body: opts.body });
    }
    close() {}
  };
  window.Notification = globalThis.Notification;
}

beforeEach(() => stubBrowser());
afterEach(() => listeners.focus?.()); // the player comes back: the title stops blinking

test('alerts only while the player is looking at another tab or window', () => {
  const notifier = createNotifier();
  focused = true;
  notifier.notify('turn:1', '¡Te toca!', 'Turno 1');
  assert.equal(shown.length, 0);
  focused = false;
  notifier.notify('turn:2', '¡Te toca!', 'Turno 2');
  assert.deepEqual(shown, [{ title: '¡Te toca!', body: 'Turno 2' }]);
});

test('each moment is announced once, even if the same frame arrives again', () => {
  const notifier = createNotifier();
  notifier.notify('turn:1', '¡Te toca!', 'Turno 1');
  notifier.notify('turn:1', '¡Te toca!', 'Turno 1');
  assert.equal(shown.length, 1);
});

test('turning alerts off is remembered and silences them', async () => {
  await createNotifier().setEnabled(false);
  const notifier = createNotifier();
  assert.equal(notifier.enabled, false);
  notifier.notify('full:1', '¡Tu sala se llenó!', '');
  assert.equal(shown.length, 0);
});

test('without permission the tab title still blinks, and stops when the player comes back', async () => {
  stubBrowser({ permission: 'denied' });
  const notifier = createNotifier();
  notifier.notify('ready:1', 'Solo faltas tú', '');
  assert.equal(shown.length, 0);
  await new Promise((r) => setTimeout(r, 1300));
  assert.match(document.title, /Solo faltas tú/);
  listeners.focus();
  assert.equal(document.title, 'Token Clash');
});

test('the permission prompt shows on the first click on the page, and only once', () => {
  stubBrowser({ permission: 'default' });
  createNotifier();
  assert.equal(asked, 0);
  listeners.pointerdown();
  assert.equal(asked, 1);
  assert.equal(listeners.pointerdown, undefined);
  assert.equal(listeners.keydown, undefined);
});

test('the prompt is not asked once the player has already answered it', () => {
  stubBrowser({ permission: 'denied' });
  createNotifier();
  assert.equal(listeners.pointerdown, undefined);
});
