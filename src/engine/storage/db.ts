// Shared `musicanyya` IndexedDB database opening, used by every store adapter (contracts/performance-log.md,
// contracts/progress-store.md §2). One `onupgradeneeded` here is what lets each version add its own stores
// without ever touching what an earlier version already wrote (research.md R-5): version 2 added `performances`
// beside `recentScores`; version 3 (feature 013) adds `progress`, `userFiles`, `userFileBytes` and `meta`.
export const DB_NAME = 'musicanyya';
export const DB_VERSION = 3;

export const RECENT_SCORES_STORE = 'recentScores';
export const RECENT_SCORES_INDEX_BY_LAST_OPENED = 'byLastOpened';
export const PERFORMANCES_STORE = 'performances';
export const PERFORMANCES_INDEX_BY_SCORE_FINISHED = 'byScoreFinished';
export const PROGRESS_STORE = 'progress';
export const PROGRESS_INDEX_BY_LAST_OPENED = 'byLastOpened';
export const USER_FILES_STORE = 'userFiles';
export const USER_FILES_INDEX_BY_LAST_OPENED = 'byLastOpened';
export const USER_FILE_BYTES_STORE = 'userFileBytes';
export const META_STORE = 'meta';

export function upgradeMusicanyyaDb(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(RECENT_SCORES_STORE)) {
    const store = db.createObjectStore(RECENT_SCORES_STORE, { keyPath: 'id' });
    store.createIndex(RECENT_SCORES_INDEX_BY_LAST_OPENED, 'lastOpened');
  }
  if (!db.objectStoreNames.contains(PERFORMANCES_STORE)) {
    const store = db.createObjectStore(PERFORMANCES_STORE, { keyPath: 'runId' });
    store.createIndex(PERFORMANCES_INDEX_BY_SCORE_FINISHED, ['scoreId', 'finishedAt']);
  }
  if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
    const store = db.createObjectStore(PROGRESS_STORE, { keyPath: 'scoreKey' });
    store.createIndex(PROGRESS_INDEX_BY_LAST_OPENED, 'lastOpenedAt');
  }
  if (!db.objectStoreNames.contains(USER_FILES_STORE)) {
    const store = db.createObjectStore(USER_FILES_STORE, { keyPath: 'fileKey' });
    store.createIndex(USER_FILES_INDEX_BY_LAST_OPENED, 'lastOpenedAt');
  }
  if (!db.objectStoreNames.contains(USER_FILE_BYTES_STORE)) {
    db.createObjectStore(USER_FILE_BYTES_STORE, { keyPath: 'hash' });
  }
  if (!db.objectStoreNames.contains(META_STORE)) {
    db.createObjectStore(META_STORE, { keyPath: 'key' });
  }
}

export function openMusicanyyaDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB unavailable'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => upgradeMusicanyyaDb(request.result);
    request.onsuccess = () => {
      // research.md R-5: without this, an old tab left open on an earlier version blocks a later upgrade
      // (`onblocked` -> `unavailable`); this tab cannot fix that, but it stops the problem from recurring.
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
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
