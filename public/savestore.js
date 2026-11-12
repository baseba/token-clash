const DB = 'token-clash';
const STORE = 'kv';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function rememberSave(text) {
  try {
    await run('readwrite', (s) => s.put({ text, savedAt: Date.now() }, 'save'));
  } catch {}
}

export async function storedSave() {
  try {
    return (await run('readonly', (s) => s.get('save'))) ?? null;
  } catch {
    return null;
  }
}
