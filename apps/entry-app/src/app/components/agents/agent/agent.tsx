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
import { useStorageContext } from '../../../contexts/storage.context';
import { readClipboardText } from './agent.helpers';
import { speak } from '../all-agents.helpers';
import { useAgentMutations } from './hooks/useAgentMutations';
import { AgentHeader } from './components/agent-header/agent-header';
import { AgentTextInput, IAgentTextInputHandle } from './components/agent-text-input/agent-text-input';
import { AgentActionBar } from './components/agent-action-bar/agent-action-bar';
import { AgentResponse } from './components/agent-response/agent-response';

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

const defaultAiModelName = 'openai';

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
    const wideModeSettings = JSON.parse(localStorage.getItem('wideModeSettings') || '{}');
    const [message, setMessage] = useState('');
    const [answer, setAnswer] = useState<string>('');
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const textInputRef = useRef<IAgentTextInputHandle>(null);
    const responseRef = useRef<HTMLDivElement | null>(null);
    const currentMessageRef = useRef<string>(message);
    const formRef = useRef<HTMLFormElement | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const {
      audioEnabled,
      recalculateFullScreen,
      loggedInUserId,
      pinnedAgentsIds: pinnedAgents,
      pinAgent,
      unpinAgent,
      languageCode,
      setLanguageCode,
    } = useStorageContext();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isListeningFired, setIsListeningFired] = useState(false);
    const [selectedAiProvider, setSelectedAiProvider] = useState(defaultAiModelName);
    const [snackBarText, setSnackBarText] = useState('');
    const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
    const [savedCaptions, setSavedCaptions] = useState<string[]>([]);
    const [isWideMode, setIsWideMode] = useState(wideModeSettings[id] || false);
    const [isExplicitLanguage, setIsExplicitLanguage] = useState(false);
    const [isAutoDictation, setIsAutoDictation] = useState(false);

    const { removeMutation, createTemplateMutation, createCloneOfTemplateMutation, updateMutation, submitMutation } =
      useAgentMutations(id, () => undefined);

    const onHistoryItemSelect = useCallback((msg: string, resp: string) => {
      setMessage(msg);
      setAnswer(resp);
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

    const submitPrompt = async (msg: string) => {
      setIsSubmitting(true);
      try {
        const response = await submitMutation.mutateAsync({
          id,
          message: msg,
          aiProvider: selectedAiProvider,
          language: isExplicitLanguage ? listenLanguageCode || languageCode : undefined,
        });
        setHasSubmitted(true);
        const purifiedDom = domPurify.sanitize(response.answer);
        setAnswer(purifiedDom);
        if (isAutoDictation) {
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
        setSnackBarText('Problems on submitting query to AI service' + e);
        Sentry.captureException(e);
      } finally {
        setIsSubmitting(false);
      }
    };

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
      (event: any, newValue: string | null) => {
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
      setAnswer('');
      textInputRef.current?.clearImage();
      setIsCaptionsNeedClear(true);
    };

    const handleCopyResponse = () => {
      navigator.clipboard.writeText(responseRef.current?.textContent || '');
    };

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
                selectedAiProvider={selectedAiProvider}
                onAiProviderChange={setSelectedAiProvider}
                isExplicitLanguage={isExplicitLanguage}
                number={number}
                onCapture={handleCapture}
                onClear={handleClearText}
                message={message}
                answer={answer}
                isSubmitting={isSubmitting}
                audioEnabled={audioEnabled}
                id={id}
                savedCaptions={savedCaptions}
                onCaption={handleCaption}
                isCaptionsNeedClear={isCaptionsNeedClear}
                onCaptionsCleared={() => setIsCaptionsNeedClear(false)}
                isListeningFired={isListeningFired}
                onListeningToggled={() => setIsListeningFired((prev) => !prev)}
              />
            </div>
            <AgentResponse
              answer={answer}
              isSubmitting={isSubmitting}
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
