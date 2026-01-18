// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                      OFFLINE STORAGE - IndexedDB                             ║
// ║              Stockage robuste pour mode offline iOS/Android                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const DB_NAME = 'flow-offline-db';
const DB_VERSION = 1;

// Stores
const STORES = {
  TASKS: 'tasks',
  PENDING_SYNC: 'pending-sync',
  SETTINGS: 'settings',
  CACHE: 'cache',
};

let db = null;

// ═══════════════════════════════════════════════════════════════
// INITIALISATION
// ═══════════════════════════════════════════════════════════════

export async function initOfflineDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[OfflineDB] Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = event => {
      const database = event.target.result;

      // Store pour les tâches (cache local)
      if (!database.objectStoreNames.contains(STORES.TASKS)) {
        const tasksStore = database.createObjectStore(STORES.TASKS, { keyPath: 'id' });
        tasksStore.createIndex('date', 'date', { unique: false });
        tasksStore.createIndex('status', 'status', { unique: false });
        tasksStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Store pour les actions en attente de sync
      if (!database.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const syncStore = database.createObjectStore(STORES.PENDING_SYNC, {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncStore.createIndex('type', 'type', { unique: false });
      }

      // Store pour les settings
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // Store pour le cache général
      if (!database.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = database.createObjectStore(STORES.CACHE, { keyPath: 'key' });
        cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      console.log('[OfflineDB] Database schema created/updated');
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPERS GÉNÉRIQUES
// ═══════════════════════════════════════════════════════════════

async function getStore(storeName, mode = 'readonly') {
  if (!db) await initOfflineDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

async function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════
// TÂCHES - CRUD
// ═══════════════════════════════════════════════════════════════

export async function saveTasksOffline(tasks) {
  const store = await getStore(STORES.TASKS, 'readwrite');
  const promises = tasks.map(task => {
    return promisifyRequest(
      store.put({
        ...task,
        updatedAt: Date.now(),
      })
    );
  });
  await Promise.all(promises);
  console.log(`[OfflineDB] Saved ${tasks.length} tasks offline`);
}

export async function getTasksOffline() {
  const store = await getStore(STORES.TASKS);
  return promisifyRequest(store.getAll());
}

export async function getTasksByDateOffline(date) {
  const store = await getStore(STORES.TASKS);
  const index = store.index('date');
  return promisifyRequest(index.getAll(date));
}

export async function deleteTaskOffline(taskId) {
  const store = await getStore(STORES.TASKS, 'readwrite');
  return promisifyRequest(store.delete(taskId));
}

export async function clearTasksOffline() {
  const store = await getStore(STORES.TASKS, 'readwrite');
  return promisifyRequest(store.clear());
}

// ═══════════════════════════════════════════════════════════════
// QUEUE DE SYNCHRONISATION
// ═══════════════════════════════════════════════════════════════

export async function addToSyncQueue(action) {
  const store = await getStore(STORES.PENDING_SYNC, 'readwrite');
  const entry = {
    ...action,
    timestamp: Date.now(),
    retryCount: 0,
  };
  const id = await promisifyRequest(store.add(entry));
  console.log(`[OfflineDB] Added to sync queue:`, action.type, id);

  // Tenter de déclencher la sync si online
  if (navigator.onLine && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-tasks');
    } catch {
      // Background sync non supporté - on sync manuellement plus tard
    }
  }

  return id;
}

export async function getSyncQueue() {
  const store = await getStore(STORES.PENDING_SYNC);
  return promisifyRequest(store.getAll());
}

export async function removeSyncItem(id) {
  const store = await getStore(STORES.PENDING_SYNC, 'readwrite');
  return promisifyRequest(store.delete(id));
}

export async function clearSyncQueue() {
  const store = await getStore(STORES.PENDING_SYNC, 'readwrite');
  return promisifyRequest(store.clear());
}

export async function getSyncQueueCount() {
  const store = await getStore(STORES.PENDING_SYNC);
  return promisifyRequest(store.count());
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

export async function saveSetting(key, value) {
  const store = await getStore(STORES.SETTINGS, 'readwrite');
  return promisifyRequest(store.put({ key, value, updatedAt: Date.now() }));
}

export async function getSetting(key) {
  const store = await getStore(STORES.SETTINGS);
  const result = await promisifyRequest(store.get(key));
  return result?.value;
}

// ═══════════════════════════════════════════════════════════════
// CACHE AVEC EXPIRATION
// ═══════════════════════════════════════════════════════════════

export async function setCache(key, data, ttlMs = 5 * 60 * 1000) {
  const store = await getStore(STORES.CACHE, 'readwrite');
  return promisifyRequest(
    store.put({
      key,
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    })
  );
}

export async function getCache(key) {
  const store = await getStore(STORES.CACHE);
  const result = await promisifyRequest(store.get(key));

  if (!result) return null;

  // Vérifier expiration
  if (result.expiresAt < Date.now()) {
    // Supprimer le cache expiré
    const writeStore = await getStore(STORES.CACHE, 'readwrite');
    await promisifyRequest(writeStore.delete(key));
    return null;
  }

  return result.data;
}

export async function clearExpiredCache() {
  const store = await getStore(STORES.CACHE, 'readwrite');
  const index = store.index('expiresAt');
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.upperBound(now));
    let deleted = 0;

    request.onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deleted++;
        cursor.continue();
      } else {
        console.log(`[OfflineDB] Cleared ${deleted} expired cache entries`);
        resolve(deleted);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// ═══════════════════════════════════════════════════════════════
// SYNC MANAGER
// ═══════════════════════════════════════════════════════════════

export async function processSyncQueue(apiRequest) {
  if (!navigator.onLine) {
    console.log('[OfflineDB] Offline - skipping sync');
    return { synced: 0, failed: 0 };
  }

  const queue = await getSyncQueue();
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      switch (item.type) {
        case 'CREATE_TASK':
          await apiRequest('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(item.data),
          });
          break;

        case 'UPDATE_TASK':
          await apiRequest(`/api/tasks/${item.data.id}`, {
            method: 'PATCH',
            body: JSON.stringify(item.data.updates),
          });
          break;

        case 'DELETE_TASK':
          await apiRequest(`/api/tasks/${item.data.id}`, {
            method: 'DELETE',
          });
          break;

        default:
          console.warn('[OfflineDB] Unknown sync type:', item.type);
      }

      await removeSyncItem(item.id);
      synced++;
    } catch (error) {
      console.error('[OfflineDB] Sync failed for item:', item.id, error);
      failed++;

      // Incrémenter le retry count
      if (item.retryCount < 3) {
        const store = await getStore(STORES.PENDING_SYNC, 'readwrite');
        await promisifyRequest(
          store.put({
            ...item,
            retryCount: item.retryCount + 1,
            lastError: error.message,
          })
        );
      } else {
        // Trop de retries - supprimer l'item
        console.error('[OfflineDB] Max retries reached, removing item:', item.id);
        await removeSyncItem(item.id);
      }
    }
  }

  console.log(`[OfflineDB] Sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}

// ═══════════════════════════════════════════════════════════════
// ÉTAT OFFLINE
// ═══════════════════════════════════════════════════════════════

export function isOffline() {
  return !navigator.onLine;
}

export function onOnlineStatusChange(callback) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));

  // Retourner fonction de cleanup
  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORT PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════

export default {
  init: initOfflineDB,
  tasks: {
    save: saveTasksOffline,
    getAll: getTasksOffline,
    getByDate: getTasksByDateOffline,
    delete: deleteTaskOffline,
    clear: clearTasksOffline,
  },
  sync: {
    add: addToSyncQueue,
    getQueue: getSyncQueue,
    remove: removeSyncItem,
    clear: clearSyncQueue,
    count: getSyncQueueCount,
    process: processSyncQueue,
  },
  settings: {
    save: saveSetting,
    get: getSetting,
  },
  cache: {
    set: setCache,
    get: getCache,
    clearExpired: clearExpiredCache,
  },
  isOffline,
  onOnlineStatusChange,
};
