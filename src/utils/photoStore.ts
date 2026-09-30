// Temporary photo storage in IndexedDB so a browser refresh does not lose the
// photos taken during the current form session.
//
// VERSION 1 NOTE: there is no backend, so photos are NOT permanently stored or
// sent anywhere. They exist only on this phone until "New installation" is
// pressed. Permanent photo storage will require a backend/storage service in a
// future version.

const DB = 'goldnet-install';
const STORE = 'photos';

export type PhotoKey = 'cpe' | 'router';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = t.onabort = () => {
      db.close();
      reject(t.error);
    };
  });
}

export async function savePhoto(key: PhotoKey, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(blob, key));
}

export async function loadPhoto(key: PhotoKey): Promise<Blob | null> {
  try {
    return ((await tx('readonly', (s) => s.get(key))) as Blob | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function deletePhoto(key: PhotoKey): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(key));
  } catch {
    /* ignore */
  }
}

export async function clearPhotos(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear());
  } catch {
    /* ignore */
  }
}
