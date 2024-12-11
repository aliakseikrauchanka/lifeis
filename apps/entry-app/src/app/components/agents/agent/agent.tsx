import { EditableInput, OwnButton, SpeechToText } from '@lifeis/common-ui';
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
  PushPin,
  PushPinOutlined,
  Unarchive,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentHistoryModal } from './components/agent-history';
import classNames from 'classnames';
import { useMediaQuery } from '@mui/material';
import { AgentHistoryNavigation } from './components/agent-history-navigation/agent-history-navigation';
import { IAgentHistoryItem } from '../../../domains/agent.domain';
import { useStorageContext } from '../../../contexts/storage.context';
import { ImagePreviewFromBuffer } from './components/image-preview-from-buffer';

interface IAgentProps {
  type: 'agent' | 'template';
  id: string;
  userId: string;
  name: string;
  prefix: string;
  focused?: boolean;
  number?: number;
  isArchived?: boolean;
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

const defaultAiModelName = 'gemini-1.5-flash-latest';

export const Agent = ({ id, name, prefix, focused, number, type, userId, isArchived: isArchivedProp }: IAgentProps) => {
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
  const { audioEnabled } = useStorageContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAiProvider, setSelectedAiProvider] = useState(defaultAiModelName);
  const [snackBarText, setSnackBarText] = useState('');
  const [imageIsParsing, setImageIsParsing] = useState(false);
  const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
  const [savedCaptions, setSavedCaptions] = useState<string[]>([]);

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

  const { pinnedAgentsIds: pinnedAgents, pinAgent, unpinAgent } = useStorageContext();

  const clientHistoryItems = initLoad ? (agentHistory ? [emptyHistoryItem, ...agentHistory] : []) : agentHistory;

  useEffect(() => {
    if (textAreaRef.current && focused) {
      textAreaRef?.current.focus();
    }
  }, [focused]);

  useEffect(() => {
    if (message !== currentMessageRef.current && !message) {
      textAreaRef?.current?.focus();
    }
    currentMessageRef.current = message;
  }, [message]);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const submitPrompt = async () => {
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

  const handleOpenAgentHistory = async () => {
    setIsHistoryOpen(true);
  };

  const handleSubmitForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitPrompt();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submitPrompt();
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

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
  };

  const handleClearText = () => {
    setMessage('');
    setAnswer('');
    setImageBuffer(null);
    setIsCaptionsNeedClear(true);
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

  return (
    <form onSubmit={handleSubmitForm} className={css.agent}>
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

      <div className={classNames(css.agentPrefixContainer, isInstructionsOpen && css.agentPrefixContainerExpanded)}>
        <EditableInput initialValue={prefix} onValueChange={handleBlurPrefix} onToggle={handleInstructionsToggle} />
      </div>

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
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={handlePaste}
          onKeyPress={handleKeyPress}
          className={classNames(css.agentInput, isMobile && css.agentInputMinimized)}
          style={{
            height: `${height}px`,
          }}
        />
        <IconButton
          sx={{ position: 'absolute', right: '32px', top: '2px', opacity: 0.5 }}
          size="sm"
          onClick={handleCopyMessage}
        >
          <CopyAll />
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
          onIndexChange={(index) => {
            setHistoryCurrentIndex(index);
            const historyItem = clientHistoryItems?.[index];
            setMessage(historyItem?.message || '');
            setAnswer(historyItem?.response || '');
          }}
        />
      </div>
      <div className={css.agentButtons}>
        <Select
          value={selectedAiProvider}
          onChange={(_, newValue) => setSelectedAiProvider(newValue as string)}
          sx={{ minHeight: 30, minWidth: 95 }}
        >
          <Option value="gemini-1.5-flash-latest">Gemini</Option>
          <Option value="gemini-2.0-flash-exp">Gemini Flash 2</Option>
          <Option value="gemini-1.5-pro">Gemini Pro</Option>
          <Option value="openai">OpenAI</Option>
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
        {audioEnabled && (
          <SpeechToText
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
          />
        )}
        <OwnButton
          type="button"
          color="danger"
          onClick={handleClearText}
          style={{ marginLeft: 'auto' }}
          disabled={!message && !answer}
        >
          Clear All
        </OwnButton>
        <OwnButton type="submit" disabled={!message || isSubmitting}>
          Submit
        </OwnButton>
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
        </h4>
        {isSubmitting ? (
          'Generating ...'
        ) : (
          <div className="response-body" ref={responseRef}>
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
    </form>
  );
};
