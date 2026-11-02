import type { Annotation, StudyDocument, User } from '../types';
import { ApiError } from './errors';

export interface StoredUser extends User { passwordDigest: string }
export interface StoredDocument extends StudyDocument { sourceUrl?: string }
export interface DatabaseState {
  users: StoredUser[];
  documents: StoredDocument[];
  annotations: Annotation[];
  progress: Record<string, number>;
}

const DATABASE_NAME = 'studymark-demo-v1';
let connection: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new ApiError('Browser storage is unavailable. Enable IndexedDB to use the demo.', 'STORAGE_UNAVAILABLE'));
        return;
      }
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('data');
        request.result.createObjectStore('files');
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(new ApiError('Could not open browser storage.', 'STORAGE_UNAVAILABLE'));
      request.onblocked = () => reject(new ApiError('Close other StudyMark tabs and try again.', 'STORAGE_BLOCKED'));
    });
    connection.catch(() => { connection = undefined; });
  }
  return connection;
}

/** A single read/write transaction keeps metadata, annotations and blobs consistent. */
export async function writeState<T>(change: (state: DatabaseState | undefined, files: IDBObjectStore) => { state: DatabaseState; result: T }): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['data', 'files'], 'readwrite');
    const store = transaction.objectStore('data');
    const request = store.get('state');
    let result: T;
    let thrown: unknown;
    request.onsuccess = () => {
      try {
        const changed = change(request.result as DatabaseState | undefined, transaction.objectStore('files'));
        result = changed.result;
        store.put(changed.state, 'state');
      } catch (error) {
        thrown = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(thrown ?? new ApiError('Could not save your changes. Please retry.', 'STORAGE_ERROR'));
    transaction.onerror = () => reject(thrown ?? new ApiError('Could not save your changes. Browser storage may be full.', 'STORAGE_ERROR'));
  });
}

export async function readState(): Promise<DatabaseState> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('data').objectStore('data').get('state');
    request.onsuccess = () => {
      if (!request.result) reject(new ApiError('Demo data has not been initialized.', 'STORAGE_ERROR'));
      else resolve(request.result as DatabaseState);
    };
    request.onerror = () => reject(new ApiError('Could not read browser storage.', 'STORAGE_ERROR'));
  });
}

export async function readFile(id: string): Promise<Blob | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('files').objectStore('files').get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(new ApiError('Could not read the saved PDF.', 'STORAGE_ERROR'));
  });
}

export async function resetStorageForTests(): Promise<void> {
  if (connection) (await connection).close();
  connection = undefined;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
