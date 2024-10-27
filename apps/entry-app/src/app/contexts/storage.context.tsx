import { getGoogleUserId } from '@lifeis/common-ui';
import { ReactNode, createContext, useContext, useState } from 'react';

const pinnedAgentsKey = 'pinnedAgents';
const audioEnabledKey = 'audio';

export interface StorageContextType {
  loggedInUserId: string;
  setLoggedInUserId: (userId: string) => void;
  pinnedAgentsIds: string[];
  pinAgent: (agentId: string) => void;
  unpinAgent: (agentId: string) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
}

const isOfflineModeOn = import.meta.env.VITE_MODE === 'offline';

export const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const StorageProvider = ({ children }: { children: ReactNode }) => {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    const storedValue = localStorage.getItem(audioEnabledKey);
    return storedValue ? JSON.parse(storedValue) : false;
  });

  const [loggedInUserId, setLoggedInUserId] = useState<string>(isOfflineModeOn ? 'local_user' : getGoogleUserId());

  const [pinnedAgentsIds, setPinnedAgents] = useState<string[]>(() => {
    const storedValue = localStorage.getItem(pinnedAgentsKey);
    return storedValue ? JSON.parse(storedValue) : [];
  });

  const returnValue: StorageContextType = {
    loggedInUserId,
    setLoggedInUserId,
    pinnedAgentsIds,
    pinAgent: (agentId: string) => {
      setPinnedAgents((prevPinnedAgents) => {
        if (prevPinnedAgents.includes(agentId)) {
          return prevPinnedAgents;
        }
        const newValue = [...prevPinnedAgents, agentId];
        localStorage.setItem(pinnedAgentsKey, JSON.stringify(newValue));
        return newValue;
      });
    },
    unpinAgent: (agentId: string) => {
      setPinnedAgents((prevPinnedAgents) => {
        const newValue = prevPinnedAgents.filter((id) => id !== agentId);
        localStorage.setItem(pinnedAgentsKey, JSON.stringify(newValue));
        return newValue;
      });
    },
    audioEnabled,
    setAudioEnabled: (value: boolean) => {
      setAudioEnabled(value);
      localStorage.setItem(audioEnabledKey, JSON.stringify(value));
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
