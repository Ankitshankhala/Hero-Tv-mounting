import type { ZipcodeData } from '@/utils/zipcodeValidation';

// In-memory cache for the ZIP index once loaded
let loadedMap: Record<string, [string, string, string, number, number]> | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Preloads the ZIP index into memory for instant lookups
 * Uses dynamic import for code splitting
 */
export const preloadZipIndex = async (): Promise<void> => {
  if (loadedMap) return; // Already loaded
  if (loadPromise) return loadPromise; // Already loading

  loadPromise = (async () => {
    try {
      const module = await import('@/data/zip-index-compact.json');
      loadedMap = module.default as unknown as Record<string, [string, string, string, number, number]>;
      console.log(`ZIP index loaded: ${Object.keys(loadedMap).length} entries`);
    } catch (error) {
      console.warn('Failed to preload ZIP index:', error);
      loadedMap = {}; // Set to empty object to prevent retries
    }
  })();

  return loadPromise;
};

/**
 * Fast synchronous ZIP lookup - returns immediately if index is loaded
 * Returns null if index not yet loaded or ZIP not found
 */
export const getLocalZipFast = (zipcode: string): ZipcodeData | null => {
  if (!loadedMap) return null;
  
  const entry = loadedMap[zipcode];
  if (!entry) return null;

  const [city, state, stateAbbr, lat, lng] = entry;
  return {
    zipcode,
    city,
    state,
    stateAbbr,
    lat,
    lng
  };
};

/**
 * Async ZIP lookup that waits for index to load if needed
 */
export const findLocalZip = async (zipcode: string): Promise<ZipcodeData | null> => {
  // Try fast lookup first
  const fastResult = getLocalZipFast(zipcode);
  if (fastResult) return fastResult;

  // If not loaded, wait for preload
  await preloadZipIndex();
  return getLocalZipFast(zipcode);
};

/**
 * Check if the ZIP index is ready for instant lookups
 */
export const isZipIndexReady = (): boolean => {
  return loadedMap !== null;
};

/**
 * Get stats about the loaded index
 */
export const getZipIndexStats = () => {
  return {
    isLoaded: loadedMap !== null,
    entryCount: loadedMap ? Object.keys(loadedMap).length : 0
  };
};