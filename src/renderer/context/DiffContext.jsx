import React, { createContext, useState, useContext } from 'react';

const DiffContext = createContext();

export const DiffProvider = ({ children }) => {
  const [showDiff, setShowDiff] = useState(false);
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [onAcceptCallback, setOnAcceptCallback] = useState(() => {});

  const showDiffEditor = (originalContent, modifiedContent, acceptCallback) => {
    setOriginal(originalContent);
    setModified(modifiedContent);
    setOnAcceptCallback(() => acceptCallback);
    setShowDiff(true);
  };

  const handleAccept = () => {
    onAcceptCallback();
    setShowDiff(false);
  };

  const handleReject = () => {
    setShowDiff(false);
  };

  return (
    <DiffContext.Provider value={{ showDiffEditor }}>
      {children}
      {showDiff && (
        <div className="fixed inset-0 z-50">
          <DiffEditor 
            original={original} 
            modified={modified} 
            onAccept={handleAccept} 
            onReject={handleReject} 
          />
        </div>
      )}
    </DiffContext.Provider>
  );
};

export const useDiff = () => useContext(DiffContext);
