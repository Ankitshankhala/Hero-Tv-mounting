/**
 * Utility to prevent body scroll when modals are open
 * Handles edge cases for iOS and other mobile browsers
 */

let scrollPosition = 0;

export const disableBodyScroll = () => {
  // Store current scroll position
  scrollPosition = window.pageYOffset;
  
  // Apply styles to body to prevent scrolling
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollPosition}px`;
  document.body.style.width = '100%';
  
  // Prevent scrolling on the html element as well (iOS fix)
  document.documentElement.style.overflow = 'hidden';
};

export const enableBodyScroll = () => {
  // Remove styles
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.documentElement.style.overflow = '';
  
  // Restore scroll position
  window.scrollTo(0, scrollPosition);
};