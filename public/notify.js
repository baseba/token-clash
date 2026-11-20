// Browser notifications for the moments that need the player back: the lobby filled, the rival is
// ready and waiting on you, or it is your turn. They only fire while the tab is in the background;
// the tab title also blinks so the alert is visible even without notification permission.

const PREF_KEY = 'tc_notify';
const BLINK_MS = 1200;

const supported = () => typeof window !== 'undefined' && 'Notification' in window;
const readPref = () => {
  try { return localStorage.getItem(PREF_KEY); } catch { return null; }
};
const writePref = (value) => {
  try { localStorage.setItem(PREF_KEY, value); } catch { /* private mode: session only */ }
};

export function createNotifier() {
  let enabled = readPref() !== 'off';
  let shown = null;
  let blink = null;
  let baseTitle = null;
  const sent = new Set();

  const away = () => document.hidden || !document.hasFocus();
  const permission = () => (supported() ? Notification.permission : 'unsupported');

  function stopBlink() {
    if (!blink) return;
    clearInterval(blink);
    blink = null;
    if (baseTitle !== null) document.title = baseTitle;
    baseTitle = null;
  }

  function startBlink(text) {
    stopBlink();
    baseTitle = document.title;
    let on = false;
    blink = setInterval(() => {
      on = !on;
      document.title = on ? `● ${text}` : baseTitle;
    }, BLINK_MS);
  }

  function clear() {
    stopBlink();
    shown?.close();
    shown = null;
  }

  window.addEventListener('focus', clear);
  document.addEventListener('visibilitychange', () => !document.hidden && clear());

  // Browsers only show the permission prompt from a user gesture, so it is asked on the first click
  // or key press anywhere: for the player that is as soon as they start using the page.
  const askOnce = () => {
    document.removeEventListener('pointerdown', askOnce, true);
    document.removeEventListener('keydown', askOnce, true);
    if (enabled && permission() === 'default') Notification.requestPermission().catch(() => null);
  };
  if (enabled && permission() === 'default') {
    document.addEventListener('pointerdown', askOnce, true);
    document.addEventListener('keydown', askOnce, true);
  }

  return {
    get enabled() {
      return enabled;
    },
    permission,
    /** Turns alerts on or off; turning them on asks the browser for permission when still undecided. */
    async setEnabled(on) {
      enabled = on;
      writePref(on ? 'on' : 'off');
      if (on && permission() === 'default') await Notification.requestPermission().catch(() => null);
      return permission();
    },
    /** Alerts once per key, and only while the player is looking elsewhere. */
    notify(key, title, body) {
      if (!enabled || sent.has(key) || !away()) return;
      sent.add(key);
      startBlink(title);
      if (permission() !== 'granted') return;
      shown?.close();
      try {
        shown = new Notification(title, { body, icon: '/icons/token-ball-192.png?v=dev', tag: 'token-clash', renotify: true });
        shown.onclick = () => {
          window.focus();
          clear();
        };
      } catch {
        shown = null; // some mobile browsers only allow notifications from a service worker
      }
    },
  };
}
