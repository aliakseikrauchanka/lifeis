import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Popover } from '@mui/material';
import { Select, Option } from '@mui/joy';
import { LanguageSelector, OwnButton } from '@lifeis/common-ui';
import { IAgentResponse } from '../../../domains/agent.domain';
import { speak } from '../all-agents.helpers';

interface SelectionContextMenuProps {
  agents: IAgentResponse[];
  focusedAgentId: string;
  languageCode: string;
  onReadLanguageChange: (event: any, newValue: string | null) => void;
  onSubmitToAgent: (agentIndex: number, text: string) => void;
  selectedAgentIndex: number;
}

export const SelectionContextMenu: React.FC<SelectionContextMenuProps> = ({
  agents,
  focusedAgentId,
  languageCode,
  onReadLanguageChange,
  onSubmitToAgent,
  selectedAgentIndex,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectionText, setSelectionText] = useState('');

  useEffect(() => {
    const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
    if (isIPad) return;

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;

      const range = selection.getRangeAt(0);
      const text = selection.toString();

      if (
        range &&
        !selection.isCollapsed &&
        !!range.commonAncestorContainer.parentElement?.closest('.response-body') &&
        text.length < 200
      ) {
        const rect = range.getBoundingClientRect();
        setAnchorPosition({
          top: rect.bottom + 10,
          left: rect.left,
        });
        setSelectionText(text);
      } else {
        setTimeout(() => {
          setAnchorPosition(null);
          setSelectionText('');
        }, 100);
        audioRef.current?.pause();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleSpeak = useCallback(async () => {
    const language = agents.find((a) => a._id === focusedAgentId)?.readLanguageCode || languageCode;
    speak(selectionText, language, (audioUrl) => {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        audioRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };
      }
    });
  }, [selectionText, agents, focusedAgentId, languageCode]);

  const open = Boolean(anchorPosition);

  return (
    <>
      <Popover
        open={open}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
        onClose={() => {
          setAnchorPosition(null);
          setSelectionText('');
        }}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        sx={{
          pointerEvents: 'none',
          '& .MuiPopover-paper': {
            pointerEvents: 'auto',
            backgroundColor: 'rebeccapurple',
            color: 'white',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'start',
            padding: '4px',
          },
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <OwnButton onClick={handleSpeak}>Speak</OwnButton>
          <div
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <LanguageSelector
              languageCode={agents.find((a) => a._id === focusedAgentId)?.readLanguageCode || languageCode}
              sx={{ minWidth: '20px' }}
              handleLanguageChange={onReadLanguageChange}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <OwnButton onClick={() => onSubmitToAgent(selectedAgentIndex, selectionText)}>Submit</OwnButton>
          <Select
            value={String(selectedAgentIndex)}
            onChange={(_, newValue) => {
              if (newValue) {
                onSubmitToAgent(Number(newValue), selectionText);
              }
            }}
            sx={{ minWidth: 120, minHeight: '1.75rem' }}
          >
            {agents.map((agent, i) => (
              <Option key={agent._id} value={String(i)}>
                {agent.name}
              </Option>
            ))}
          </Select>
        </div>
      </Popover>
      <audio ref={audioRef}>
        <source type="audio/mpeg" />
      </audio>
    </>
  );
};
