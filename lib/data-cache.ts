/**
 * Data Caching Utilities
 * 
 * Uses IndexedDB for persistent storage of API responses to avoid repeated calls.
 * Falls back to localStorage for simpler data if IndexedDB is not available.
 */

const DB_NAME = 'FantasyBasketballGM';
const DB_VERSION = 1;
const STORE_NAME = 'leagueData';

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiresAt: number;
}

// Cache expiration: 1 hour for most data, 24 hours for historical data
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const HISTORICAL_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in browser');
  }

  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Get cached data
 */
export async function getCachedData(key: string): Promise<any | null> {
  if (typeof window === 'undefined') return null;

  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry: CacheEntry | undefined = request.result;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
          // Delete expired entry
          deleteCachedData(key);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
    });
  } catch (error) {
    console.error('Cache get error:', error);
    // Fallback to localStorage
    try {
      const item = localStorage.getItem(`cache_${key}`);
      if (item) {
        const entry: CacheEntry = JSON.parse(item);
        if (Date.now() > entry.expiresAt) {
          localStorage.removeItem(`cache_${key}`);
          return null;
        }
        return entry.data;
      }
    } catch (e) {
      console.error('localStorage fallback error:', e);
    }
    return null;
  }
}

/**
 * Set cached data
 */
export async function setCachedData(
  key: string,
  data: any,
  isHistorical: boolean = false
): Promise<void> {
  if (typeof window === 'undefined') return;

  const expiresAt = Date.now() + (isHistorical ? HISTORICAL_CACHE_DURATION : CACHE_DURATION);
  const entry: CacheEntry = {
    key,
    data,
    timestamp: Date.now(),
    expiresAt,
  };

  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Cache set error:', error);
    // Fallback to localStorage
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      console.error('localStorage fallback error:', e);
    }
  }
}

/**
 * Delete cached data
 */
export async function deleteCachedData(key: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Cache delete error:', error);
    // Fallback to localStorage
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (e) {
      console.error('localStorage fallback error:', e);
    }
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Also clear localStorage fallback
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('cache_')) {
            localStorage.removeItem(key);
          }
        });
        resolve();
      };
    });
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

/**
 * Generate cache key for league data
 */
export function getCacheKey(leagueKey: string, season: string, dataType: string): string {
  return `${leagueKey}_${season}_${dataType}`;
}






