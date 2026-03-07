import { ImagePreviewFromBuffer, LanguageSelector } from '@lifeis/common-ui';
import { IconButton, Switch, useTheme } from '@mui/joy';
import { CopyAll, PlayCircle, PlayForWork, WidthFull, WidthNormal } from '@mui/icons-material';
import classNames from 'classnames';
import { KeyboardEvent, Ref, RefObject, forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import domPurify from 'dompurify';
import { AgentHistoryNavigation } from '../agent-history-navigation/agent-history-navigation';
import { AgentHistoryModal } from '../agent-history';
import { submitImageOnParsing } from '../../../../../api/agents/agents.api';
import { speak } from '../../../all-agents.helpers';
import { useTextareaResize } from '../../hooks/useTextareaResize';
import { useAgentHistory } from '../../hooks/useAgentHistory';
import css from './agent-text-input.module.scss';

export interface ILanguageProps {
  languageCode: string;
  listenLanguageCode: string;
  readLanguageCode?: string;
  isExplicitLanguage: boolean;
  onExplicitLanguageChange: (checked: boolean) => void;
  onListenLanguageChange: (event: any, newValue: string | null) => void;
}

export interface IDictationProps {
  isAutoDictation: boolean;
  onAutoDictationChange: (checked: boolean) => void;
  audioRef: RefObject<HTMLAudioElement | null>;
}

export interface IAgentTextInputHandle {
  processImageBuffer: (buffer: ArrayBuffer) => void;
  clearImage: () => void;
}

interface IAgentTextInputProps {
  id: string;
  message: string;
  onMessageChange: React.Dispatch<React.SetStateAction<string>>;
  onAgentFocus: (e: React.MouseEvent<HTMLElement>) => void;
  onBlur?: () => void;
  onDrop: (e: React.DragEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onInsertFromClipboard: () => void;
  onWideMode: () => void;
  isWideMode: boolean;
  textAreaRef: Ref<HTMLTextAreaElement>;
  hasSubmitted: boolean;
  onHistoryItemSelect: (message: string, response: string, agentType?: string) => void;
  languageProps: ILanguageProps;
  dictationProps: IDictationProps;
}

export const AgentTextInput = forwardRef<IAgentTextInputHandle, IAgentTextInputProps>(
  (
    {
      id,
      message,
      onMessageChange,
      onAgentFocus,
      onBlur,
      onDrop,
      onKeyDown,
      onInsertFromClipboard,
      onWideMode,
      isWideMode,
      textAreaRef,
      hasSubmitted,
      onHistoryItemSelect,
      languageProps,
      dictationProps,
    },
    ref,
  ) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const selectRef = useRef<HTMLDivElement>(null);
    const prevFocusedElement = useRef<HTMLElement | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [imageBuffer, setImageBuffer] = useState<string | ArrayBuffer | null>(null);
    const [imageIsParsing, setImageIsParsing] = useState(false);

    const { height, resizerRef, textareaWrapperRef, startResizing, isResizing } = useTextareaResize(
      isMobile ? 190 : 140,
    );

    const { clientHistoryItems, historyCurrentIndex, handleHistoryIndexChange, handleHistoryEduClick } =
      useAgentHistory(id, hasSubmitted);

    const processImageBuffer = useCallback(
      async (buffer: ArrayBuffer) => {
        setImageBuffer(buffer);
        setImageIsParsing(true);
        const response = await submitImageOnParsing(buffer);
        setImageIsParsing(false);
        const purifiedDom = domPurify.sanitize(response.answer);
        onMessageChange((prev) => prev + purifiedDom);
      },
      [onMessageChange],
    );

    const clearImage = useCallback(() => {
      setImageBuffer(null);
    }, []);

    useImperativeHandle(ref, () => ({ processImageBuffer, clearImage }), [processImageBuffer, clearImage]);

    const handlePaste = useCallback(
      (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
              const blob = item.getAsFile();
              if (blob) {
                const reader = new FileReader();
                reader.onload = () => {
                  processImageBuffer(reader.result as ArrayBuffer);
                };
                reader.readAsArrayBuffer(blob);
                return;
              }
            }
          }
        }
      },
      [processImageBuffer],
    );

    const handleCopyMessage = useCallback(() => {
      navigator.clipboard.writeText(message);
    }, [message]);

    const handleInternalKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.code === 'ArrowLeft' && e.ctrlKey && e.shiftKey) {
          const { message: msg, response, agentType } = handleHistoryIndexChange(historyCurrentIndex + 1);
          onHistoryItemSelect(msg, response, agentType);
          return;
        }
        if (e.code === 'ArrowRight' && e.ctrlKey && e.shiftKey) {
          const { message: msg, response, agentType } = handleHistoryIndexChange(historyCurrentIndex - 1);
          onHistoryItemSelect(msg, response, agentType);
          return;
        }
        if (e.code === 'KeyL' && e.ctrlKey && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const el = selectRef.current;
          if (!el) return;
          prevFocusedElement.current = document.activeElement as HTMLElement;
          const selectButton = el.querySelector('button');
          if (selectButton) {
            selectButton.focus();
            selectButton.click();
          }
          return;
        }
        onKeyDown(e);
      },
      [onKeyDown, handleHistoryIndexChange, historyCurrentIndex, onHistoryItemSelect],
    );

    const handleHistoryNavigationIndexChange = useCallback(
      (index: number) => {
        const { message: msg, response, agentType } = handleHistoryIndexChange(index);
        onHistoryItemSelect(msg, response, agentType);
      },
      [handleHistoryIndexChange, onHistoryItemSelect],
    );

    const {
      languageCode,
      listenLanguageCode,
      readLanguageCode,
      isExplicitLanguage,
      onExplicitLanguageChange,
      onListenLanguageChange,
    } = languageProps;
    const { isAutoDictation, onAutoDictationChange, audioRef } = dictationProps;

    return (
      <>
        <div
          className={classNames(css.inputWrapper, {
            [css.inputWrapperMinimized]: isMobile,
            [css.inputWrapperWide]: isWideMode,
          })}
          style={{ height: `${height}px` }}
          ref={textareaWrapperRef}
        >
          <textarea
            onDrop={onDrop}
            ref={textAreaRef}
            onClick={onAgentFocus}
            onBlur={onBlur}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleInternalKeyDown}
            className={classNames(css.input, isMobile && css.inputMinimized)}
            style={{ height: `${height}px` }}
          />
          <IconButton
            sx={{ position: 'absolute', right: '36px', top: '2px', opacity: 0.5 }}
            size="sm"
            onClick={handleCopyMessage}
          >
            <CopyAll />
          </IconButton>
          <IconButton
            sx={{ position: 'absolute', right: '68px', top: '2px', opacity: 0.5 }}
            size="sm"
            onClick={onInsertFromClipboard}
          >
            <PlayForWork />
          </IconButton>
          <LanguageSelector
            selectRef={selectRef}
            sx={{ position: 'absolute', left: '5px', bottom: '18px', opacity: 0.5, minWidth: '20px' }}
            languageCode={listenLanguageCode || languageCode}
            handleLanguageChange={onListenLanguageChange}
          />
          <Switch
            checked={isExplicitLanguage}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onExplicitLanguageChange(event.target.checked)}
            color={isExplicitLanguage ? 'success' : 'neutral'}
            variant={isExplicitLanguage ? 'solid' : 'outlined'}
            sx={{ position: 'absolute', left: '78px', bottom: '21px', opacity: 0.5 }}
            slotProps={{
              endDecorator: {
                sx: { minWidth: 22 },
              },
            }}
          />
          <IconButton
            sx={{ position: 'absolute', right: '68px', top: '30px', opacity: 0.5 }}
            size="sm"
            onClick={() => {
              if (!message) return;
              speak(message, listenLanguageCode || languageCode, (audioUrl) => {
                if (audioRef.current) {
                  audioRef.current.src = audioUrl;
                  audioRef.current.play();
                  audioRef.current.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                  };
                }
              });
            }}
          >
            <PlayCircle />
          </IconButton>
          <Switch
            checked={isAutoDictation}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onAutoDictationChange(event.target.checked)}
            color={isAutoDictation ? 'success' : 'neutral'}
            variant={isAutoDictation ? 'solid' : 'outlined'}
            sx={{ position: 'absolute', right: '36px', top: '36px', opacity: 0.5 }}
            slotProps={{
              endDecorator: {
                sx: { minWidth: 22 },
              },
            }}
          />
          <IconButton
            sx={{ position: 'absolute', right: '32px', bottom: '12px', opacity: 0.5 }}
            size="sm"
            onClick={onWideMode}
          >
            {isWideMode ? <WidthNormal /> : <WidthFull />}
          </IconButton>
          <div
            ref={resizerRef}
            className={classNames(css.inputResizer, isResizing && css.inputResizerActive)}
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
            <ImagePreviewFromBuffer buffer={imageBuffer} onClose={clearImage} isLoading={imageIsParsing} />
          )}
          <AgentHistoryNavigation
            className={css.historyNavigation}
            historyItems={clientHistoryItems}
            index={historyCurrentIndex}
            isEduEnabled={readLanguageCode === 'pl' || listenLanguageCode === 'pl'}
            onHistoryClick={() => setIsHistoryOpen(true)}
            onHistoryEduClick={handleHistoryEduClick}
            onIndexChange={handleHistoryNavigationIndexChange}
          />
        </div>
        <AgentHistoryModal open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} agentId={id} />
      </>
    );
  },
);
