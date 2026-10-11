// ============================================================================
// Knock Knock Resilient Offline & Local Media Engine (IndexedDB-Backed)
// Stores and restores photos, videos, and posters locally when Supabase Storage
// is rate-limited, quota-restricted (402), or network is offline.
// ============================================================================

const DB_NAME = 'knock_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

export interface StoredMediaRecord {
    id: string;
    blob: Blob;
    mimeType: string;
    createdAt: number;
}

// In-memory cache mapping local media ID to active browser Object URL (URL.createObjectURL)
const localBlobUrlCache = new Map<string, string>();
let dbPromise: Promise<IDBDatabase> | null = null;
let isInitialized = false;

function openMediaDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('IndexedDB unavailable in this environment'));
    }

    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        req.onsuccess = () => {
            resolve(req.result);
        };

        req.onerror = () => {
            console.warn('[localMedia] Failed to open IndexedDB:', req.error);
            reject(req.error);
        };
    });

    return dbPromise;
}

/**
 * Initialize local media registry on application start.
 * Restores active browser Object URLs for all previously stored local media.
 */
export async function initLocalMediaRegistry(): Promise<void> {
    if (isInitialized) return;
    isInitialized = true;

    try {
        const db = await openMediaDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        await new Promise<void>((resolve, reject) => {
            req.onsuccess = () => {
                const records: StoredMediaRecord[] = req.result || [];
                records.forEach(rec => {
                    if (rec && rec.id && rec.blob) {
                        try {
                            const objUrl = URL.createObjectURL(rec.blob);
                            localBlobUrlCache.set(rec.id, objUrl);
                        } catch (e) {
                            console.warn('[localMedia] Failed to recreate blob URL for', rec.id, e);
                        }
                    }
                });
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[localMedia] Registry initialization failed (continuing in-memory):', err);
    }
}

/**
 * Store a File or Blob in IndexedDB and cache its active Object URL.
 */
export async function storeLocalMedia(id: string, blob: Blob | File): Promise<string> {
    // Generate active browser Object URL immediately
    let objUrl = localBlobUrlCache.get(id);
    if (!objUrl) {
        try {
            objUrl = URL.createObjectURL(blob);
            localBlobUrlCache.set(id, objUrl);
        } catch (_) {}
    }

    try {
        const db = await openMediaDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const record: StoredMediaRecord = {
            id,
            blob,
            mimeType: blob.type || 'application/octet-stream',
            createdAt: Date.now()
        };

        await new Promise<void>((resolve, reject) => {
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('[localMedia] Failed to persist blob to IndexedDB (available in-memory):', e);
    }

    return objUrl || '';
}

/**
 * Retrieve a stored Blob from IndexedDB by ID.
 */
export async function getLocalMedia(id: string): Promise<Blob | null> {
    try {
        const db = await openMediaDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        return await new Promise<Blob | null>((resolve) => {
            req.onsuccess = () => {
                const rec: StoredMediaRecord | undefined = req.result;
                resolve(rec ? rec.blob : null);
            };
            req.onerror = () => resolve(null);
        });
    } catch (_) {
        return null;
    }
}

/**
 * Generate a persistent fallback URL for a File or Blob, stored in IndexedDB.
 */
export async function createLocalFallbackMediaUrl(
    file: File | Blob, 
    customExt?: string
): Promise<{ fallbackUrl: string; id: string; activeBlobUrl: string }> {
    const isVid = file.type.startsWith('video/') || (file instanceof File && /\.(mp4|webm|mov|m4v|mkv|avi)/i.test(file.name));
    const rawExt = customExt || (file instanceof File ? file.name.split('.').pop() : '') || (isVid ? 'mp4' : 'jpg');
    const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || (isVid ? 'mp4' : 'jpg');
    const id = `local-media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const activeBlobUrl = await storeLocalMedia(id, file);
    const mediaTag = isVid ? '#video.mp4' : '#image.jpg';
    const fallbackUrl = `${activeBlobUrl}#LOCAL_ID:${id}${mediaTag}`;

    return { fallbackUrl, id, activeBlobUrl };
}

/**
 * Resolves a media URL containing a `#LOCAL_ID:xxx` fragment to an active browser Object URL.
 * Preserves all metadata fragments (#POSTER:, #MUSIC:, #LINK:, #BOOST:, #video.mp4).
 */
export function resolveLocalMediaUrl(url: string | null | undefined): string {
    if (!url) return '';

    // Check for #LOCAL_ID:xxx fragment
    const localIdMatch = url.match(/#LOCAL_ID:([^#]+)/);
    if (localIdMatch && localIdMatch[1]) {
        const localId = localIdMatch[1];
        const activeBlob = localBlobUrlCache.get(localId);
        if (activeBlob) {
            // Replace the dead or old base URL with the active live blob URL
            const hashIndex = url.indexOf('#');
            const fragments = hashIndex !== -1 ? url.substring(hashIndex) : '';
            return `${activeBlob}${fragments}`;
        }
    }

    // Check for local-media:// protocol format
    if (url.startsWith('local-media://')) {
        const pathPart = url.replace('local-media://', '');
        const [localId, ...hashParts] = pathPart.split('#');
        const activeBlob = localBlobUrlCache.get(localId);
        if (activeBlob) {
            const extraHash = hashParts.length > 0 ? `#${hashParts.join('#')}` : '';
            return `${activeBlob}${extraHash}`;
        }
    }

    return url;
}

// Automatically initiate registry restore on client-side startup
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    initLocalMediaRegistry().catch(() => {});
}
