import { ReactNode, createContext, useContext, useState } from 'react';

const key = 'pinnedAgents';

export interface StorageContextType {
  pinnedAgentsIds: string[];
  pinAgent: (agentId: string) => void;
  unpinAgent: (agentId: string) => void;
}

export const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const StorageProvider = ({ children }: { children: ReactNode }) => {
  const [pinnedAgentsIds, setPinnedAgents] = useState<string[]>(() => {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : [];
  });

  const returnValue = {
    pinnedAgentsIds,
    pinAgent: (agentId: string) => {
      setPinnedAgents((prevPinnedAgents) => {
        if (prevPinnedAgents.includes(agentId)) {
          return prevPinnedAgents;
        }
        const newValue = [...prevPinnedAgents, agentId];
        localStorage.setItem(key, JSON.stringify(newValue));
        return newValue;
      });
    },
    unpinAgent: (agentId: string) => {
      setPinnedAgents((prevPinnedAgents) => {
        const newValue = prevPinnedAgents.filter((id) => id !== agentId);
        localStorage.setItem(key, JSON.stringify(newValue));
        return newValue;
      });
    },
  };

  return <StorageContext.Provider value={returnValue}>{children}</StorageContext.Provider>;
};

export const useStorageContext = (): StorageContextType => {
  const context = useContext(StorageContext);
  if (context === undefined) {
    throw new Error('useStorageContext must be used within a StorageProvider');
  }
  return context;
};
