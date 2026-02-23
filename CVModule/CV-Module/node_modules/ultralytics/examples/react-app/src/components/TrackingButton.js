import React from 'react';
import { useUltralytics } from 'ultralytics/react';

/**
 * A button component that tracks clicks with Ultralytics
 */
function TrackingButton({ eventName, eventProperties, children, onClick, ...props }) {
  const { track } = useUltralytics();
  
  const handleClick = (e) => {
    // Track the click event
    track(eventName || 'button_click', {
      buttonText: children,
      ...eventProperties
    });
    
    // Call the original onClick handler if provided
    if (onClick) {
      onClick(e);
    }
  };
  
  return (
    <button onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

export default TrackingButton;
