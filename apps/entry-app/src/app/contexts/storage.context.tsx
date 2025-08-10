import { getGoogleUserId } from '@lifeis/common-ui';
import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getPinnedAgents, savePinnedAgents } from '../api/agents/agents.api';

const audioEnabledKey = 'audio';

export interface StorageContextType {
  prevFocusedAgentIndex: number | undefined;
  focusedAgentIndex: number;
  setFocusedAgentIndex: (index: number | ((prevValue: number) => number)) => void;
  isSearchOpened: boolean;
  setIsSearchOpened: (arg: boolean | ((prevValue: boolean) => boolean)) => void;
  languageCode: string;
  setLanguageCode: (code: string) => void;
  loggedInUserId: string;
  setLoggedInUserId: (userId: string) => void;
  pinnedAgentsIds: string[];
  pinAgent: (agentId: string) => void;
  unpinAgent: (agentId: string) => void;
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  isFullScreen: boolean;
  recalculateFullScreen: () => void;
}

function usePreviousDistinct<T>(value: T, isEqual: (a: T, b: T) => boolean = Object.is) {
  const last = useRef<T>(value);
  const prevDistinct = useRef<T | undefined>(undefined);

  useEffect(() => {
    if (!isEqual(value, last.current)) {
      prevDistinct.current = last.current; // last different value
      last.current = value;
    }
    // if equal, do nothing (we ignore repeats)
  }, [value, isEqual]);

  return prevDistinct.current; // undefined on first render or if never changed
}

const isFullScreenEnabled = Object.values(JSON.parse(localStorage.getItem('wideModeSettings') || '{}')).some(
  (value) => value,
);

const isOfflineModeOn = import.meta.env.VITE_MODE === 'offline';

export const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const StorageProvider = ({ children }: { children: ReactNode }) => {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    const storedValue = localStorage.getItem(audioEnabledKey);
    return storedValue ? JSON.parse(storedValue) : false;
  });

  const [loggedInUserId, setLoggedInUserId] = useState<string>(isOfflineModeOn ? 'local_user' : getGoogleUserId());

  const [languageCode, setLanguageCode] = useState<string>('pl');

  const [pinnedAgentsIds, setPinnedAgents] = useState<string[]>([]);

  const [isFullScreen, setIsFullScreen] = useState<boolean>(isFullScreenEnabled || false);

  const [isSearchOpened, setIsSearchOpened] = useState(false);

  const [focusedAgentIndex, setFocusedAgentIndex] = useState(0);

  const prevFocusedAgentIndex = usePreviousDistinct(focusedAgentIndex);

  useEffect(() => {
    if (!loggedInUserId) {
      return;
    }

    const restorePinnedAgents = async () => {
      const pinnedAgentsIdsResponse = await getPinnedAgents();
      setPinnedAgents(pinnedAgentsIdsResponse.agentsIds);
    };

    restorePinnedAgents();
  }, [loggedInUserId]);

  const pinAgent = useCallback(
    async (agentId: string) => {
      if (pinnedAgentsIds.includes(agentId)) {
        return pinnedAgentsIds;
      }
      const newValue = [...pinnedAgentsIds, agentId];
      setPinnedAgents(newValue);
      await savePinnedAgents(newValue);
    },
    [pinnedAgentsIds],
  );

  const unpinAgent = useCallback(
    async (agentId: string) => {
      const newValue = pinnedAgentsIds.filter((id) => id !== agentId);
      setPinnedAgents(newValue);
      await savePinnedAgents(newValue);
    },
    [pinnedAgentsIds],
  );

  const returnValue: StorageContextType = {
    prevFocusedAgentIndex,
    focusedAgentIndex,
    setFocusedAgentIndex,
    isSearchOpened,
    setIsSearchOpened,
    languageCode,
    setLanguageCode,
    loggedInUserId,
    setLoggedInUserId,
    pinnedAgentsIds,
    pinAgent,
    unpinAgent,
    audioEnabled,
    isFullScreen,
    recalculateFullScreen: () => {
      const wideModeSettings = JSON.parse(localStorage.getItem('wideModeSettings') || '{}');
      const isFullScreen = Object.values(wideModeSettings).some((value) => value);
      setIsFullScreen(isFullScreen);
    },
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
