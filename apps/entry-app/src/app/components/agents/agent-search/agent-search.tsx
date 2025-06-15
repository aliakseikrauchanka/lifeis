import { useState, useEffect } from 'react';
import Fuse from 'fuse.js';
import { Input } from '@mui/joy';
import { IAgentResponse } from '../../../domains/agent.domain';

interface AgentSearchProps {
  agents: Array<IAgentResponse>;
  onSelect: (agentId: string) => void;
  onClose: () => void;
}

export const AgentSearch = ({ agents, onSelect, onClose }: AgentSearchProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fuse = new Fuse(agents, {
    keys: ['name'],
    threshold: 0.3,
  });

  const searchResults = searchTerm ? fuse.search(searchTerm) : [];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();

        if (searchResults[selectedIndex]) {
          onSelect(searchResults[selectedIndex].item._id);
          onClose();
        }
        setSearchTerm('');

        break;
      case 'Escape':
        onClose();
        setSearchTerm('');
        break;
      case 'ArrowDown':
        setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
        break;
      case 'ArrowUp':
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 100,
        marginTop: '-36px',
      }}
    >
      <Input
        autoFocus
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search agents..."
        sx={{ width: '100%' }}
      />
      {searchResults.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '300px',
            overflowY: 'auto',
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 1000,
          }}
        >
          {searchResults.map((result, index) => (
            <div
              key={result.item._id}
              style={{
                padding: '8px',
                cursor: 'pointer',
                backgroundColor: index === selectedIndex ? '#f0f0f0' : 'transparent',
              }}
              onClick={() => {
                onSelect(result.item._id);
                onClose();
              }}
            >
              {result.item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
