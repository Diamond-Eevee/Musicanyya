// Shared `musicanyya` IndexedDB database opening, used by IndexedDbScoreStore and IndexedDbPerformanceStore
// (contracts/performance-log.md "IndexedDB database `musicanyya` (version 2)"). One `onupgradeneeded` here is
// what lets version 2 add `performances` without ever touching an existing `recentScores` store.
export const DB_NAME = 'musicanyya';
export const DB_VERSION = 2;

export const RECENT_SCORES_STORE = 'recentScores';
export const RECENT_SCORES_INDEX_BY_LAST_OPENED = 'byLastOpened';
export const PERFORMANCES_STORE = 'performances';
export const PERFORMANCES_INDEX_BY_SCORE_FINISHED = 'byScoreFinished';

export function upgradeMusicanyyaDb(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(RECENT_SCORES_STORE)) {
    const store = db.createObjectStore(RECENT_SCORES_STORE, { keyPath: 'id' });
    store.createIndex(RECENT_SCORES_INDEX_BY_LAST_OPENED, 'lastOpened');
  }
  if (!db.objectStoreNames.contains(PERFORMANCES_STORE)) {
    const store = db.createObjectStore(PERFORMANCES_STORE, { keyPath: 'runId' });
    store.createIndex(PERFORMANCES_INDEX_BY_SCORE_FINISHED, ['scoreId', 'finishedAt']);
  }
}

export function openMusicanyyaDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB unavailable'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => upgradeMusicanyyaDb(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('indexedDB blocked'));
  });
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function classifyDbError(error: unknown): 'unavailable' | 'quotaExceeded' {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return 'quotaExceeded';
  return 'unavailable';
}
