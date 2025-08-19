/**
 * Utility functions for handling maps and directions across different platforms
 */

export type MapApp = 'apple' | 'google' | 'waze';

/**
 * Detects if the user is on iOS (iPhone, iPad, iPod)
 */
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Gets the preferred map app from localStorage or returns default
 */
export const getPreferredMapApp = (): MapApp => {
  const stored = localStorage.getItem('preferredMapApp') as MapApp;
  if (stored && ['apple', 'google', 'waze'].includes(stored)) {
    return stored;
  }
  return isIOS() ? 'apple' : 'google';
};

/**
 * Sets the preferred map app in localStorage
 */
export const setPreferredMapApp = (app: MapApp): void => {
  localStorage.setItem('preferredMapApp', app);
};

/**
 * Builds the appropriate directions URL based on the specified map app
 * @param address - The destination address
 * @param mapApp - The map application to use
 * @returns URL string for the specified maps application
 */
export const buildDirectionsUrl = (address: string, mapApp?: MapApp): string => {
  const encodedAddress = encodeURIComponent(address);
  const app = mapApp || getPreferredMapApp();
  
  switch (app) {
    case 'apple':
      return `maps://maps.apple.com/?daddr=${encodedAddress}`;
    case 'waze':
      return `https://waze.com/ul?q=${encodedAddress}&navigate=yes`;
    case 'google':
    default:
      return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  }
};

/**
 * Opens directions to the given address using the specified or preferred maps application
 * @param address - The destination address
 * @param mapApp - Optional specific map app to use
 */
export const openDirections = (address: string, mapApp?: MapApp): void => {
  if (!address) return;
  
  const app = mapApp || getPreferredMapApp();
  const directionsUrl = buildDirectionsUrl(address, app);
  
  if (app === 'apple' && isIOS()) {
    // On iOS with Apple Maps, use location.href to ensure it opens in the native app
    window.location.href = directionsUrl;
  } else {
    // For all other cases, open in a new tab
    window.open(directionsUrl, '_blank');
  }
};