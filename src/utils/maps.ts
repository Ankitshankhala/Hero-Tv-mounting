/**
 * Utility functions for handling maps and directions across different platforms
 */

/**
 * Detects if the user is on iOS (iPhone, iPad, iPod)
 */
export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Builds the appropriate directions URL based on the platform
 * @param address - The destination address
 * @returns URL string for the appropriate maps application
 */
export const buildDirectionsUrl = (address: string): string => {
  const encodedAddress = encodeURIComponent(address);
  
  if (isIOS()) {
    // Use Apple Maps on iOS devices
    return `maps://maps.apple.com/?daddr=${encodedAddress}`;
  } else {
    // Use Google Maps on other platforms
    return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  }
};

/**
 * Opens directions to the given address using the appropriate maps application
 * @param address - The destination address
 */
export const openDirections = (address: string): void => {
  if (!address) return;
  
  const directionsUrl = buildDirectionsUrl(address);
  
  if (isIOS()) {
    // On iOS, use location.href to ensure it opens in the native app
    window.location.href = directionsUrl;
  } else {
    // On other platforms, open in a new tab
    window.open(directionsUrl, '_blank');
  }
};