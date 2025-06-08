import { EditableInput, LanguageSelector, OwnButton, SpeechToText } from '@lifeis/common-ui';
import {
  getAgentHistory,
  removeAgent,
  submitMessage,
  updateAgent,
  createTemplate,
  cloneTemplateAgent,
  submitImageOnParsing,
} from '../../../api/agents/agents.api';
import { useState, KeyboardEvent, FormEvent, MouseEvent, useRef, useEffect, useCallback } from 'react';
import css from './agent.module.scss';
import domPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import { IconButton, Select, useTheme, Option, Snackbar } from '@mui/joy';
import {
  Archive,
  CameraAlt,
  ContentCopy,
  CopyAll,
  Dashboard,
  Delete,
  DragHandle,
  PlayForWork,
  PushPin,
  PushPinOutlined,
  Unarchive,
  WidthFull,
  WidthNormal,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentHistoryModal } from './components/agent-history';
import classNames from 'classnames';
import { useMediaQuery } from '@mui/material';
import { AgentHistoryNavigation } from './components/agent-history-navigation/agent-history-navigation';
import { IAgentHistoryItem } from '../../../domains/agent.domain';
import { useStorageContext } from '../../../contexts/storage.context';
import { ImagePreviewFromBuffer } from './components/image-preview-from-buffer';
import { readClipboardText } from './agent.helpers';

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

const emptyHistoryItem: IAgentHistoryItem = {
  _id: '',
  agentId: '',
  prefix: '',
  message: '',
  prompt: '',
  response: '',
  timestamp: new Date(),
} as const;

const defaultAiModelName = 'gemini-2.0-flash';

export const Agent = ({
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
}: IAgentProps) => {
  const [historyCurrentIndex, setHistoryCurrentIndex] = useState(0);
  const [initLoad, setInitLoad] = useState(true);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<string>('');
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaWrapperRef = useRef(null);
  // resizer
  const resizerRef = useRef(null);
  const [isResizing, setIsResizing] = useState(false);
  const [height, setHeight] = useState(100); // Initial height

  const responseRef = useRef<HTMLDivElement | null>(null);
  const currentMessageRef = useRef<string>(message);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();
  const { audioEnabled, setIsWideModeOn, isWideModeOn } = useStorageContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListeningFired, setIsListeningFired] = useState(false);
  const [selectedAiProvider, setSelectedAiProvider] = useState(defaultAiModelName);
  const [snackBarText, setSnackBarText] = useState('');
  const [imageIsParsing, setImageIsParsing] = useState(false);
  const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
  const [savedCaptions, setSavedCaptions] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);
  const prevFocusedElement = useRef<HTMLElement | null>(null);
  const [isWideMode, setIsWideMode] = useState(false);

  const { loggedInUserId } = useStorageContext();

  const [imageBuffer, setImageBuffer] = useState<string | ArrayBuffer | null>(null);

  const setImage = async (buffer: ArrayBuffer) => {
    setImageBuffer(buffer);
    setImageIsParsing(true);

    const response = await submitImageOnParsing(buffer);

    setImageIsParsing(false);
    const purifiedDom = domPurify.sanitize(response.answer);
    setMessage((message) => message + purifiedDom);
  };

  const handleCapture = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as ArrayBuffer);
        event.target.value = '';
      };
      reader.readAsArrayBuffer(file);
    }
  }, []);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              setImage(reader.result as ArrayBuffer);
            };
            reader.readAsArrayBuffer(blob);

            return; // Exit after handling the image
          }
        }
      }
    }
  }, []);

  const removeMutation = useMutation({
    mutationFn: removeAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const createCloneOfTemplateMutation = useMutation({
    mutationFn: cloneTemplateAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
  const submitMutation = useMutation({
    mutationFn: submitMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-history', id] });
      setInitLoad(false);
    },
  });

  const { data: agentHistory } = useQuery({
    queryKey: ['agents-history', id],
    queryFn: () => getAgentHistory(id),
    select: (data) => data.history,
  });

  useEffect(() => {
    if (agentHistory) {
      setHistoryCurrentIndex(0);
    }
  }, [agentHistory]);

  const { pinnedAgentsIds: pinnedAgents, pinAgent, unpinAgent, languageCode, setLanguageCode } = useStorageContext();

  const clientHistoryItems = initLoad ? (agentHistory ? [emptyHistoryItem, ...agentHistory] : []) : agentHistory;

  useEffect(() => {
    if (textAreaRef.current && focused) {
      formRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'center',
      });
      textAreaRef?.current.focus();
    }
  }, [focused, listenLanguageCode, languageCode, setLanguageCode]);

  useEffect(() => {
    if (message !== currentMessageRef.current && !message) {
      textAreaRef?.current?.focus();
    }
    currentMessageRef.current = message;
  }, [message]);

  const selectRef = useRef(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const submitPrompt = async (message: string) => {
    setIsSubmitting(true);
    try {
      const response = await submitMutation.mutateAsync({
        id,
        message,
        aiProvider: selectedAiProvider,
      });
      const purifiedDom = domPurify.sanitize(response.answer);
      setAnswer(purifiedDom);
    } catch (e) {
      setSnackBarText('Problems on submitting query to AI service' + e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgentFocus = useCallback(() => {
    if (!!listenLanguageCode && listenLanguageCode !== languageCode) {
      setLanguageCode(listenLanguageCode);
    }
  }, [listenLanguageCode, languageCode, setLanguageCode]);

  const handleOpenAgentHistory = async () => {
    setIsHistoryOpen(true);
  };

  const handleSubmitForm = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setIsCaptionsNeedClear(true);
    submitPrompt(message);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // handle escape key
    if (e.key === 'Escape') {
      setIsWideMode(false);
      setIsWideModeOn(false);
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
      handleFullScreenToggle();
    }

    // handle ctrl + shift + left arrow
    if (e.code === 'ArrowLeft' && e.ctrlKey && e.shiftKey) {
      handleHistoryIndexChange(historyCurrentIndex + 1);
    }

    if (e.code === 'ArrowRight' && e.ctrlKey && e.shiftKey) {
      handleHistoryIndexChange(historyCurrentIndex - 1);
    }

    if (e.code === 'KeyL' && e.ctrlKey && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const a = selectRef.current as any;
      if (!a) {
        return;
      }
      prevFocusedElement.current = document.activeElement as HTMLElement;
      const selectButton = a.querySelector('button');
      if (selectButton) {
        selectButton.focus();
        selectButton.click();
      }
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

  const handleListenLanguageChange = (event: any, newValue: string | null) => {
    updateMutation.mutate({ id, name, prefix, listenLanguageCode: newValue || '' });
    setLanguageCode(newValue || '');
    if (prevFocusedElement.current) {
      setTimeout(() => {
        prevFocusedElement.current?.focus();
        prevFocusedElement.current = null;
      }, 100);
    }
  };

  const handleReadLanguageChange = (event: any, newValue: string | null) => {
    updateMutation.mutate({ id, name, prefix, readLanguageCode: newValue || '' });
  };

  const handleInstructionsToggle = (isInstructionsOpen: boolean) => {
    setIsInstructionsOpen(isInstructionsOpen);
  };

  const handleArhiveUnarchived = (isArchived: boolean) => {
    try {
      updateMutation.mutate({ id, isArchived });
    } catch (error) {
      console.error('Failed to update agent prefix:', error);
    }
  };

  const handleBlurName = (newValue: string) => {
    if (name !== newValue) {
      try {
        updateMutation.mutate({ id, name: newValue, prefix });
      } catch (error) {
        console.error('Failed to update agent name:', error);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLAnchorElement>) => {
    e.dataTransfer.setData('text/plain', responseRef.current?.textContent || '');
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    setMessage(data);
  };

  const handleFullScreenToggle = () => {
    setIsWideMode((prev) => !prev);
    setIsWideModeOn(!isWideModeOn);
  };

  const handleInsertFromClipboard = () => {
    readClipboardText().then((text) => {
      setMessage(text);
      submitPrompt(text);
    });
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
  };

  const handleClearText = () => {
    setMessage('');
    setAnswer('');
    setImageBuffer(null);
    setIsCaptionsNeedClear(true);
  };

  const handleHistoryIndexChange = (index: number) => {
    setHistoryCurrentIndex(index);
    const historyItem = clientHistoryItems?.[index];
    setMessage(historyItem?.message || '');
    setAnswer(historyItem?.response || '');
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(responseRef.current?.textContent || '');
  };

  const startResizing = (e: any) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const stopResizing = () => {
    if (isResizing) {
      setIsResizing(false);
    }
  };

  const resize = (e: any) => {
    if (!isResizing || !textareaWrapperRef.current) return;

    // Support touch and mouse events
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientY) return;

    const wrapperTop = (textareaWrapperRef.current as any).getBoundingClientRect().top;
    const newHeight = clientY - wrapperTop;

    // Set minimum and maximum height
    const minHeight = 50;
    const maxHeight = 500;

    if (newHeight > minHeight && newHeight < maxHeight) {
      setHeight(newHeight);
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('touchmove', resize);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('touchend', stopResizing);

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizing]);

  const onFormFocus = () => {
    onAgentFocus?.();
  };

  return (
    <form
      onSubmit={handleSubmitForm}
      className={classNames(css.agent, {
        [css.agentWideMode]: isWideMode,
      })}
      id={`agent-${id}`}
      ref={formRef}
      onClick={onFormFocus}
    >
      <header className={css.agentHeader}>
        <IconButton size="sm" color="primary">
          {pinnedAgents.includes(id) ? (
            <PushPin onClick={() => unpinAgent(id)} />
          ) : (
            <PushPinOutlined onClick={() => pinAgent(id)} />
          )}
        </IconButton>
        <h3 className={css.agentHeaderName} title={name}>
          <EditableInput initialValue={name} onValueChange={handleBlurName} />
        </h3>
        <div className={css.agentDeleteBtnContainer}>
          {type === 'agent' && (
            <IconButton
              aria-label="Archive/Unarchive"
              size="sm"
              color="primary"
              onClick={() => {
                unpinAgent(id);
                handleArhiveUnarchived(!isArchivedProp);
              }}
            >
              {isArchivedProp ? <Unarchive /> : <Archive />}
            </IconButton>
          )}
          <IconButton
            aria-label="Clone"
            size="sm"
            color="warning"
            onClick={type === 'agent' ? handleMakeAgentTemplate : handleMakeCloneOfAgentTemplate}
          >
            {type === 'agent' ? <Dashboard /> : <ContentCopy />}
          </IconButton>
          {userId === loggedInUserId && (
            <IconButton aria-label="Delete" size="sm" color="danger" onClick={handleRemoveAgent}>
              <Delete />
            </IconButton>
          )}
        </div>
      </header>

      <div>
        <div className={classNames(css.agentPrefixContainer, isInstructionsOpen && css.agentPrefixContainerExpanded)}>
          <EditableInput initialValue={prefix} onValueChange={handleBlurPrefix} onToggle={handleInstructionsToggle} />
        </div>

        <div
          className={classNames(css.agentBody, {
            [css.agentBodyWide]: isWideMode,
          })}
        >
          <div>
            <div
              className={classNames(css.agentInputWrapper, {
                [css.agentInputWrapperMinimized]: isMobile,
              })}
              style={{
                height: `${height}px`,
              }}
              ref={textareaWrapperRef}
            >
              <textarea
                onDrop={handleDrop}
                ref={textAreaRef}
                onFocus={handleAgentFocus}
                onBlur={onBlur}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                className={classNames(css.agentInput, isMobile && css.agentInputMinimized)}
                style={{
                  height: `${height}px`,
                }}
              />
              {audioEnabled && (
                <LanguageSelector
                  selectRef={selectRef}
                  sx={{ position: 'absolute', right: '32px', top: '2px', opacity: 0.5, minWidth: '20px' }}
                  languageCode={listenLanguageCode || languageCode}
                  handleLanguageChange={handleListenLanguageChange}
                />
              )}
              <IconButton
                sx={{ position: 'absolute', right: audioEnabled ? '96px' : '32px', top: '2px', opacity: 0.5 }}
                size="sm"
                onClick={handleCopyMessage}
              >
                <CopyAll />
              </IconButton>
              <IconButton
                sx={{ position: 'absolute', right: audioEnabled ? '124px' : '64px', top: '2px', opacity: 0.5 }}
                size="sm"
                onClick={handleInsertFromClipboard}
              >
                <PlayForWork />
              </IconButton>

              <IconButton
                sx={{ position: 'absolute', right: '32px', bottom: '12px', opacity: 0.5 }}
                size="sm"
                onClick={handleFullScreenToggle}
              >
                {isWideMode ? <WidthNormal /> : <WidthFull />}
              </IconButton>

              <div
                ref={resizerRef}
                className={classNames(css.agentInputResizer, isResizing && css.agentInputResizerActive)}
                onMouseDown={startResizing}
                onTouchStart={startResizing}
                tabIndex={0}
                role="slider"
                aria-valuemin={50}
                aria-valuemax={500}
                aria-valuenow={height}
                aria-orientation="vertical"
                aria-label="Resize textarea"
              />
              {imageBuffer instanceof ArrayBuffer && (
                <ImagePreviewFromBuffer
                  buffer={imageBuffer}
                  onClose={() => setImageBuffer(null)}
                  isLoading={imageIsParsing}
                />
              )}

              <AgentHistoryNavigation
                className={css.agentHistoryNavigation}
                historyItems={clientHistoryItems}
                index={historyCurrentIndex}
                onHistoryClick={handleOpenAgentHistory}
                onIndexChange={handleHistoryIndexChange}
              />
            </div>
            <div className={css.agentButtons}>
              <Select
                value={selectedAiProvider}
                onChange={(_, newValue) => setSelectedAiProvider(newValue as string)}
                sx={{ minHeight: 30, minWidth: 95 }}
              >
                <Option value="gemini-2.0-flash-lite">Gemini Flash 2 Lite</Option>
                <Option value="gemini-2.0-flash">Gemini Flash 2</Option>
                <Option value="gemini-2.5-pro-preview-06-05">Gemini Pro 2.5</Option>
                <Option value="openai">OpenAI</Option>
                <Option value="deepseek-r1">Deepseek R1</Option>
              </Select>
              <label htmlFor={`photo-${number}`} className={css.agentButtonsPhoto}>
                <CameraAlt fontSize="large" color="inherit" />
              </label>
              <input
                type="file"
                id={`photo-${number}`}
                capture="environment"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChangeCapture={handleCapture}
              />
              <OwnButton
                type="button"
                color="danger"
                onClick={handleClearText}
                style={{ marginLeft: 'auto', height: '100%' }}
                disabled={!message && !answer}
              >
                Clear All
              </OwnButton>
              {audioEnabled && (
                <SpeechToText
                  className={css.agentButtonsStt}
                  onCaption={(caption) => {
                    if (!caption || !caption.length) return;
                    setSavedCaptions(caption);
                    const differenceIndex = caption.findIndex((item, index) => savedCaptions[index] !== item);
                    const additionalMessage = caption.slice(differenceIndex).join(' ');
                    setMessage((message) => (message ? `${message} ${additionalMessage}` : additionalMessage));
                  }}
                  id={id}
                  onCleared={() => setIsCaptionsNeedClear(false)}
                  isNeedClear={isCaptionsNeedClear}
                  isToggledListening={isListeningFired}
                  onListeningToggled={() => {
                    setIsListeningFired((prev) => !prev);
                  }}
                />
              )}
              <OwnButton type="submit" style={{ height: '100%' }} disabled={!message || isSubmitting}>
                Submit
              </OwnButton>
            </div>
          </div>
          <div className={css.agentResponse}>
            <h4 className={css.agentResponseTitle}>
              Response:{' '}
              {!isSubmitting && answer && (
                <>
                  <IconButton aria-label="Copy" size="sm" color="primary" onClick={handleCopyResponse}>
                    <CopyAll />
                  </IconButton>

                  <IconButton
                    aria-label="Copy"
                    size="sm"
                    color="primary"
                    onClick={handleCopyResponse}
                    draggable
                    onDragStart={handleDragStart}
                  >
                    <DragHandle />
                  </IconButton>
                </>
              )}
              <LanguageSelector
                languageCode={readLanguageCode || languageCode}
                sx={{ minWidth: '20px' }}
                handleLanguageChange={handleReadLanguageChange}
              />
            </h4>
            {isSubmitting ? (
              'Generating ...'
            ) : (
              <div className={'response-body'} ref={responseRef}>
                {<ReactMarkdown>{answer}</ReactMarkdown>}
              </div>
            )}
          </div>
          <AgentHistoryModal open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} agentId={id} />
          <Snackbar
            anchorOrigin={{
              horizontal: 'center',
              vertical: 'bottom',
            }}
            color="danger"
            autoHideDuration={2000}
            open={!!snackBarText}
            variant="solid"
            onClose={(event, reason) => {
              if (reason === 'clickaway') {
                return;
              }
              setSnackBarText('');
            }}
          >
            {snackBarText}
          </Snackbar>
        </div>
      </div>
    </form>
  );
};
