import { EditableInput } from '@lifeis/common-ui';
import {
  useState,
  KeyboardEvent,
  FormEvent,
  MouseEvent,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import css from './agent.module.scss';
import domPurify from 'dompurify';
import * as Sentry from '@sentry/react';
import { Snackbar } from '@mui/joy';
import classNames from 'classnames';
import { useQueryClient } from '@tanstack/react-query';
import { useStorageContext } from '../../../contexts/storage.context';
import { readClipboardText } from './agent.helpers';
import { speak } from '../all-agents.helpers';
import { useAgentMutations } from './hooks/useAgentMutations';
import { submitMessage } from '../../../api/agents/agents.api';
import { AgentHeader } from './components/agent-header/agent-header';
import { AgentTextInput, IAgentTextInputHandle } from './components/agent-text-input/agent-text-input';
import { AgentActionBar } from './components/agent-action-bar/agent-action-bar';
import { AgentResponse } from './components/agent-response/agent-response';

type ProviderResponseStatus = 'idle' | 'loading' | 'done' | 'error';
type ProviderResponse = { answer: string; status: ProviderResponseStatus };

interface IAgentProps {
  type: 'agent' | 'template';
  id: string;
  userId: string;
  name: string;
  prefix: string;
  focused?: boolean;
  number?: number;
  isArchived?: boolean;
  listenLanguageCode?: string;
  readLanguageCode?: string;
  onBlur?: () => void;
  onAgentFocus?: () => void;
}

export interface IAgentHandle {
  setNewMessage: (message: string) => void;
}

const defaultAiProviders = ['openai', 'deepseek-r1'];

export const Agent = forwardRef<IAgentHandle, IAgentProps>(
  (
    {
      id,
      name,
      prefix,
      focused,
      number,
      type,
      userId,
      isArchived: isArchivedProp,
      listenLanguageCode = '',
      readLanguageCode,
      onBlur,
      onAgentFocus,
    }: IAgentProps,
    ref,
  ) => {
    const queryClient = useQueryClient();
    const wideModeSettings = JSON.parse(localStorage.getItem('wideModeSettings') || '{}');
    const [message, setMessage] = useState('');
    const [providerResponses, setProviderResponses] = useState<Record<string, ProviderResponse>>({});
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const textInputRef = useRef<IAgentTextInputHandle>(null);
    const responseRef = useRef<HTMLDivElement | null>(null);
    const currentMessageRef = useRef<string>(message);
    const formRef = useRef<HTMLFormElement | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const submissionGenerationRef = useRef(0);

    const {
      audioEnabled,
      recalculateFullScreen,
      loggedInUserId,
      pinnedAgentsIds: pinnedAgents,
      pinAgent,
      unpinAgent,
      languageCode,
      setLanguageCode,
      sttProvider,
    } = useStorageContext();

    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isListeningFired, setIsListeningFired] = useState(false);
    const [selectedAiProviders, setSelectedAiProviders] = useState<string[]>(defaultAiProviders);
    const [snackBarText, setSnackBarText] = useState('');
    const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
    const [savedCaptions, setSavedCaptions] = useState<string[]>([]);
    const [isWideMode, setIsWideMode] = useState(wideModeSettings[id] || false);
    const [isExplicitLanguage, setIsExplicitLanguage] = useState(false);
    const [isAutoDictation, setIsAutoDictation] = useState(false);

    const { removeMutation, createTemplateMutation, createCloneOfTemplateMutation, updateMutation } = useAgentMutations(
      id,
      () => undefined,
    );

    const onHistoryItemSelect = useCallback((msg: string, resp: string, agentType?: string) => {
      setMessage(msg);
      const providerKey = agentType ?? 'response';
      setProviderResponses({ [providerKey]: { answer: resp, status: 'done' } });
    }, []);

    useEffect(() => {
      if (formRef.current && focused) {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        textAreaRef?.current?.focus();
      }
    }, [focused, listenLanguageCode, languageCode, setLanguageCode]);

    useEffect(() => {
      if (message !== currentMessageRef.current && !message) {
        formRef?.current?.focus();
      }
      currentMessageRef.current = message;
    }, [message]);

    const handleCapture = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          textInputRef.current?.processImageBuffer(reader.result as ArrayBuffer);
          event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
      }
    }, []);

    const submitPrompt = useCallback(
      async (msg: string) => {
        abortControllersRef.current.forEach((controller) => controller.abort());
        abortControllersRef.current.clear();

        const generation = ++submissionGenerationRef.current;
        const providers = selectedAiProviders;

        setProviderResponses((prev) => {
          const next: Record<string, ProviderResponse> = {};
          providers.forEach((p) => {
            next[p] = { answer: prev[p]?.answer ?? '', status: 'loading' };
          });
          return next;
        });
        setHasSubmitted(true);

        const language = isExplicitLanguage ? listenLanguageCode || languageCode : undefined;
        let firstSuccessForDictation = true;

        await Promise.all(
          providers.map(async (aiProvider) => {
            const controller = new AbortController();
            abortControllersRef.current.set(aiProvider, controller);

            try {
              const response = await submitMessage({
                id,
                message: msg,
                aiProvider,
                language,
                signal: controller.signal,
              });

              if (submissionGenerationRef.current !== generation) return;

              const purifiedDom = domPurify.sanitize(response.answer);
              setProviderResponses((prev) => ({
                ...prev,
                [aiProvider]: { answer: purifiedDom, status: 'done' },
              }));
              queryClient.invalidateQueries({ queryKey: ['agents-history', id] });

              if (isAutoDictation && firstSuccessForDictation) {
                firstSuccessForDictation = false;
                speak(msg, listenLanguageCode || languageCode, (audioUrl) => {
                  if (audioRef.current) {
                    audioRef.current.src = audioUrl;
                    audioRef.current.play();
                    audioRef.current.onended = () => {
                      URL.revokeObjectURL(audioUrl);
                    };
                  }
                });
              }
            } catch (e) {
              if ((e as Error)?.name === 'AbortError') return;
              if (submissionGenerationRef.current !== generation) return;

              setProviderResponses((prev) => ({
                ...prev,
                [aiProvider]: { answer: prev[aiProvider]?.answer ?? '', status: 'error' },
              }));
              setSnackBarText('Problems on submitting query to AI service ' + (e as Error)?.message);
              Sentry.captureException(e);
            } finally {
              abortControllersRef.current.delete(aiProvider);
            }
          }),
        );
      },
      [id, selectedAiProviders, isExplicitLanguage, listenLanguageCode, languageCode, isAutoDictation, queryClient],
    );

    const handleAgentFocus = useCallback(
      (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();
        e.stopPropagation();
        onAgentFocus?.();
      },
      [onAgentFocus],
    );

    const handleSubmitForm = async (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      setIsCaptionsNeedClear(true);
      submitPrompt(message);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        setIsListeningFired(false);
      }
      if (e.key === 'Enter' && e.ctrlKey) {
        handleSubmitForm();
        return;
      }
      if (e.code === 'KeyS' && e.ctrlKey) {
        setIsListeningFired(true);
      }
      if (e.code === 'KeyF' && e.ctrlKey) {
        handleWideMode();
      }
    };

    const handleRemoveAgent = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (window.confirm('Are you sure you want to remove this agent?')) {
        removeMutation.mutate(id);
      }
    };

    const handleMakeAgentTemplate = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (window.confirm('Are you sure you want to make agent template?')) {
        createTemplateMutation.mutate(id);
      }
    };

    const handleMakeCloneOfAgentTemplate = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (window.confirm('Are you sure you want to make clone of agent template?')) {
        createCloneOfTemplateMutation.mutate(id);
      }
    };

    const handleBlurPrefix = (newValue: string) => {
      if (prefix !== newValue) {
        try {
          updateMutation.mutate({ id, name, prefix: newValue });
        } catch (error) {
          console.error('Failed to update agent prefix:', error);
        }
      }
    };

    const handleListenLanguageChange = useCallback(
      (_event: React.SyntheticEvent, newValue: string | null) => {
        updateMutation.mutate({ id, name, prefix, listenLanguageCode: newValue || '' });
        setLanguageCode(newValue || '');
      },
      [id, name, prefix, updateMutation, setLanguageCode],
    );

    const handleBlurName = (newValue: string) => {
      if (name !== newValue) {
        try {
          updateMutation.mutate({ id, name: newValue, prefix });
        } catch (error) {
          console.error('Failed to update agent name:', error);
        }
      }
    };

    const setNewMessage = (newMessage: string) => {
      setMessage(newMessage);
      submitPrompt(newMessage);
    };

    useImperativeHandle(ref, () => ({ setNewMessage }));

    const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('text/plain');
      setMessage(data);
    };

    const handleWideMode = useCallback(() => {
      setIsWideMode((prev: boolean) => {
        const wideModeSettings = JSON.parse(localStorage.getItem('wideModeSettings') || '{}');
        const newWideModeSettings = { ...wideModeSettings, [id]: !prev };
        localStorage.setItem('wideModeSettings', JSON.stringify(newWideModeSettings));
        return !prev;
      });
      recalculateFullScreen();
    }, [id, recalculateFullScreen]);

    const handleInsertFromClipboard = () => {
      readClipboardText().then((text) => setNewMessage(text));
    };

    const handleClearText = () => {
      setMessage('');
      setProviderResponses({});
      textInputRef.current?.clearImage();
      setIsCaptionsNeedClear(true);
    };

    const handleCopyResponse = useCallback((content: string) => {
      navigator.clipboard.writeText(content);
    }, []);

    const handleCaption = useCallback(
      (caption: string[] | undefined) => {
        if (!caption || !caption.length) return;
        setSavedCaptions(caption);
        const differenceIndex = caption.findIndex((item, index) => savedCaptions[index] !== item);
        const additionalMessage = caption.slice(differenceIndex).join(' ');
        setMessage((message) => (message ? `${message} ${additionalMessage}` : additionalMessage));
      },
      [savedCaptions],
    );

    const languageProps = useMemo(
      () => ({
        languageCode,
        listenLanguageCode,
        readLanguageCode,
        isExplicitLanguage,
        onExplicitLanguageChange: setIsExplicitLanguage,
        onListenLanguageChange: handleListenLanguageChange,
      }),
      [languageCode, listenLanguageCode, readLanguageCode, isExplicitLanguage, handleListenLanguageChange],
    );

    const dictationProps = useMemo(
      () => ({
        isAutoDictation,
        onAutoDictationChange: setIsAutoDictation,
        audioRef,
      }),
      [isAutoDictation],
    );

    const hasContent = !!(message || Object.values(providerResponses).some((r) => r.answer));

    return (
      <form
        onSubmit={handleSubmitForm}
        className={classNames(css.agent, {
          [css.agentWideMode]: isWideMode,
        })}
        id={`agent-${id}`}
        ref={formRef}
      >
        <AgentHeader
          id={id}
          name={name}
          type={type}
          userId={userId}
          loggedInUserId={loggedInUserId}
          isArchived={isArchivedProp}
          isPinned={pinnedAgents.includes(id)}
          onPin={() => pinAgent(id)}
          onUnpin={() => unpinAgent(id)}
          onNameChange={handleBlurName}
          onArchiveToggle={() => {
            unpinAgent(id);
            updateMutation.mutate({ id, isArchived: !isArchivedProp });
          }}
          onMakeTemplate={handleMakeAgentTemplate}
          onCloneTemplate={handleMakeCloneOfAgentTemplate}
          onRemove={handleRemoveAgent}
        />

        <div>
          <div className={classNames(css.agentPrefixContainer, isInstructionsOpen && css.agentPrefixContainerExpanded)}>
            <EditableInput
              initialValue={prefix}
              onValueChange={handleBlurPrefix}
              onToggle={(open: boolean) => setIsInstructionsOpen(open)}
            />
          </div>

          <div
            className={classNames(css.agentBody, {
              [css.agentBodyWide]: isWideMode,
            })}
          >
            <div
              className={classNames(css.agentInputPart, {
                [css.agentInputPartWide]: isWideMode,
              })}
            >
              <AgentTextInput
                ref={textInputRef}
                id={id}
                message={message}
                onMessageChange={setMessage}
                onAgentFocus={handleAgentFocus}
                onBlur={onBlur}
                onDrop={handleDrop}
                onKeyDown={handleKeyDown}
                onInsertFromClipboard={handleInsertFromClipboard}
                onWideMode={handleWideMode}
                isWideMode={isWideMode}
                textAreaRef={textAreaRef}
                hasSubmitted={hasSubmitted}
                onHistoryItemSelect={onHistoryItemSelect}
                languageProps={languageProps}
                dictationProps={dictationProps}
              />
              <AgentActionBar
                selectedAiProviders={selectedAiProviders}
                onAiProviderChange={setSelectedAiProviders}
                isExplicitLanguage={isExplicitLanguage}
                number={number}
                onCapture={handleCapture}
                onClear={handleClearText}
                message={message}
                hasContent={hasContent}
                audioEnabled={audioEnabled}
                id={id}
                savedCaptions={savedCaptions}
                onCaption={handleCaption}
                isCaptionsNeedClear={isCaptionsNeedClear}
                onCaptionsCleared={() => setIsCaptionsNeedClear(false)}
                isListeningFired={isListeningFired}
                onListeningToggled={() => setIsListeningFired((prev) => !prev)}
                showPlayButton={sttProvider !== 'elevenlabs'}
              />
            </div>
            <AgentResponse
              providerResponses={providerResponses}
              isWideMode={isWideMode}
              responseRef={responseRef}
              onCopyResponse={handleCopyResponse}
            />
            <Snackbar
              anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
              color="danger"
              autoHideDuration={2000}
              open={!!snackBarText}
              variant="solid"
              onClose={(event, reason) => {
                if (reason === 'clickaway') return;
                setSnackBarText('');
              }}
            >
              {snackBarText}
            </Snackbar>
            <audio ref={audioRef}>
              <source type="audio/mpeg" />
            </audio>
          </div>
        </div>
      </form>
    );
  },
);
