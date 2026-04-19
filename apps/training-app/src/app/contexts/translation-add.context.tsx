import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchTranslations, TranslationData } from '../api/srs.api';
import { matchesAppLanguagePair } from '../constants/language-options';
import { useAppLanguages } from '../hooks/use-app-languages';

export interface TranslationAddPrefill {
  original?: string;
  translation?: string;
  originalLanguage?: string;
  translationLanguage?: string;
}

export type TranslationAddMode = 'add' | 'edit';

interface TranslationAddContextValue {
  isOpen: boolean;
  mode: TranslationAddMode;
  editId: string | null;
  prefill: TranslationAddPrefill | null;
  open: (prefill?: TranslationAddPrefill) => void;
  openForEdit: (id: string, prefill: TranslationAddPrefill) => void;
  close: () => void;
  notifyChanged: () => void;
  refreshIndex: () => Promise<void>;
  subscribeChanged: (fn: () => void) => () => void;
  /** Match when selected text equals stored original or stored translation (after normalize). */
  findByOriginalOrTranslation: (text: string) => TranslationData | undefined;
}

const TranslationAddContext = createContext<TranslationAddContextValue | null>(null);

function normalize(s: string): string {
  return s.trim().toLocaleLowerCase();
}

export function TranslationAddProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<TranslationAddMode>('add');
  const [editId, setEditId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<TranslationAddPrefill | null>(null);
  const subscribersRef = useRef(new Set<() => void>());
  const indexOriginalRef = useRef<Map<string, TranslationData>>(new Map());
  const indexTranslationRef = useRef<Map<string, TranslationData>>(new Map());
  const { nativeLanguage, trainingLanguage } = useAppLanguages();
  const languagesRef = useRef({ nativeLanguage, trainingLanguage });
  useEffect(() => {
    languagesRef.current = { nativeLanguage, trainingLanguage };
  }, [nativeLanguage, trainingLanguage]);

  const refreshIndex = useCallback(async () => {
    try {
      const list = await fetchTranslations();
      const byOrig = new Map<string, TranslationData>();
      const byTrans = new Map<string, TranslationData>();
      for (const t of list) {
        byOrig.set(normalize(t.original), t);
        byTrans.set(normalize(t.translation), t);
      }
      indexOriginalRef.current = byOrig;
      indexTranslationRef.current = byTrans;
    } catch (err) {
      // Silently ignore — user may be logged out or network may be offline.
      // The index simply remains empty and lookup returns undefined.
    }
  }, []);

  useEffect(() => {
    refreshIndex();
  }, [refreshIndex]);

  const findByOriginalOrTranslation = useCallback((text: string): TranslationData | undefined => {
    const key = normalize(text);
    const match =
      indexOriginalRef.current.get(key) ?? indexTranslationRef.current.get(key);
    if (!match) return undefined;
    const { nativeLanguage: n, trainingLanguage: t } = languagesRef.current;
    return matchesAppLanguagePair(match, n, t) ? match : undefined;
  }, []);

  const open = useCallback((p?: TranslationAddPrefill) => {
    setMode('add');
    setEditId(null);
    setPrefill(p ?? null);
    setIsOpen(true);
  }, []);

  const openForEdit = useCallback((id: string, p: TranslationAddPrefill) => {
    setMode('edit');
    setEditId(id);
    setPrefill(p);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setPrefill(null);
    setEditId(null);
    setMode('add');
  }, []);

  const notifyChanged = useCallback(() => {
    refreshIndex();
    subscribersRef.current.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('translation-add subscriber error:', err);
      }
    });
  }, [refreshIndex]);

  const subscribeChanged = useCallback((fn: () => void) => {
    subscribersRef.current.add(fn);
    return () => {
      subscribersRef.current.delete(fn);
    };
  }, []);

  const value = useMemo<TranslationAddContextValue>(
    () => ({
      isOpen,
      mode,
      editId,
      prefill,
      open,
      openForEdit,
      close,
      notifyChanged,
      refreshIndex,
      subscribeChanged,
      findByOriginalOrTranslation,
    }),
    [
      isOpen,
      mode,
      editId,
      prefill,
      open,
      openForEdit,
      close,
      notifyChanged,
      refreshIndex,
      subscribeChanged,
      findByOriginalOrTranslation,
    ],
  );

  return <TranslationAddContext.Provider value={value}>{children}</TranslationAddContext.Provider>;
}

export function useTranslationAdd() {
  const ctx = useContext(TranslationAddContext);
  if (!ctx) throw new Error('useTranslationAdd must be used within TranslationAddProvider');
  return ctx;
}
