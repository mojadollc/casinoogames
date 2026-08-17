import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive slot machine height
 * Returns optimal height based on viewport dimensions and orientation
 */
export default function useSlotResponsiveHeight(minHeight = 280, maxHeight = 450) {
  const [dimensions, setDimensions] = useState(() => ({
    height: calculateHeight(minHeight, maxHeight),
    width: typeof window !== 'undefined' ? window.innerWidth : 375,
    isLandscape: typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false,
    orientation: typeof window !== 'undefined' 
      ? (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait')
      : 'portrait'
  }));

  useEffect(() => {
    let rafId = null;
    
    const updateDimensions = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const isLandscape = vw > vh;
      
      setDimensions(prev => ({
        height: calculateHeight(minHeight, maxHeight),
        width: vw,
        isLandscape,
        orientation: isLandscape ? 'landscape' : 'portrait'
      }));
    };
    
    // Debounced resize handler using RAF
    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateDimensions);
    };
    
    // Handle orientation change with slight delay for accurate dimensions
    const handleOrientationChange = () => {
      setTimeout(updateDimensions, 100);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Initial calculation
    updateDimensions();
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [minHeight, maxHeight]);
  
  return dimensions;
}

/**
 * Calculate optimal slot height based on viewport
 */
function calculateHeight(minHeight, maxHeight) {
  if (typeof window === 'undefined') return minHeight;
  
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const isLandscape = vw > vh;
  
  // Landscape: use smaller percentage of height
  if (isLandscape) {
    const targetHeight = Math.floor(vh * 0.55);
    return Math.max(minHeight * 0.8, Math.min(maxHeight, targetHeight));
  }
  
  // Portrait: use larger percentage of height
  // Account for header, title, jackpot, controls, etc.
  const availableHeight = vh - 320; // Approximate fixed UI overhead
  const targetHeight = Math.min(availableHeight * 0.95, maxHeight);
  
  return Math.max(minHeight, Math.min(maxHeight, Math.floor(targetHeight)));
}
