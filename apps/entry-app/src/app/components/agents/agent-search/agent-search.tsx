import { useState, useEffect, useRef } from 'react';
import Fuse, { FuseResult } from 'fuse.js';
import { Input } from '@mui/joy';
import { IAgentResponse } from '../../../domains/agent.domain';
import { createPortal } from 'react-dom';

interface AgentSearchProps {
  agents: Array<IAgentResponse>;
  onSelect: (agentId: string) => void;
  onClose: () => void;
}

export const AgentSearch = ({ agents, onSelect, onClose }: AgentSearchProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fuse = new Fuse(agents, {
    keys: ['name'],
    threshold: 0.3,
  });

  const searchResults: FuseResult<IAgentResponse>[] = searchTerm
    ? fuse.search<IAgentResponse>(searchTerm)
    : agents.map((agent, i) => ({ item: agent, refIndex: i }));

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

  const handleClickAway = (e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickAway);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
    };
  }, []);

  const agentSearch = (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        zIndex: 101,
        top: 0,
        width: '150px',
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

  return createPortal(agentSearch, document.body.querySelector('#root')!);
};
