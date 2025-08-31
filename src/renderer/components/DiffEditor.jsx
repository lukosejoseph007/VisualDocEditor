import React from 'react';
import { diffLines } from 'diff';

const DiffEditor = ({ original, modified, onAccept, onReject }) => {
  const changes = diffLines(original, modified);
  
  const renderDiff = () => {
    return changes.map((change, index) => {
      const { value, added, removed } = change;
      const lines = value.split('\n').filter(line => line !== '');
      
      return lines.map((line, lineIndex) => (
        <div 
          key={`${index}-${lineIndex}`}
          className={`p-1 ${added ? 'bg-green-100' : removed ? 'bg-red-100' : 'bg-gray-50'}`}
        >
          {line}
        </div>
      ));
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-4/5 h-4/5 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">Review Changes</h2>
          <p className="text-gray-600">Original ↔ Modified</p>
        </div>
        
        <div className="flex-1 overflow-auto grid grid-cols-2">
          <div className="border-r">
            <div className="bg-gray-100 p-2 font-mono">
              {original.split('\n').map((line, i) => (
                <div key={`orig-${i}`} className="p-1">{line}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="bg-gray-100 p-2 font-mono">
              {renderDiff()}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t flex justify-end space-x-2">
          <button 
            onClick={onReject}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            Reject
          </button>
          <button 
            onClick={onAccept}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Accept Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiffEditor;
