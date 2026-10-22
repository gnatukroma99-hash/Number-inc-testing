
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AdBlockerCacheDB', 1);
    request.onupgradeneeded = () => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('parsedRules')) {
        db.createObjectStore('parsedRules', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


async function cacheRules(rulesArray) {
  const db = await openDB();
  const tx = db.transaction('parsedRules', 'readwrite');
  const store = tx.objectStore('parsedRules');
  store.put({ id: 'activeRules', rules: rulesArray, timestamp: Date.now() });
}


async function getCachedRules() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('parsedRules', 'readonly');
    const store = tx.objectStore('parsedRules');
    const req = store.get('activeRules');
    req.onsuccess = () => resolve(req.result ? req.result.rules : null);
  });
}