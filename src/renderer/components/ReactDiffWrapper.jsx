import React, { useState, useEffect } from 'react';
import DiffEditor from './DiffEditor';

/**
 * ReactDiffWrapper - A wrapper component that provides a clean interface
 * for vanilla JS to interact with the React DiffEditor
 */
const ReactDiffWrapper = ({ 
  original, 
  modified, 
  onAccept, 
  onReject,
  visible = true 
}) => {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
    setIsVisible(false);
  };

  const handleReject = () => {
    if (onReject) {
      onReject();
    }
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <DiffEditor
      original={original}
      modified={modified}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
};

export default ReactDiffWrapper;
