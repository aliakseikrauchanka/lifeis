import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format, isToday, isYesterday } from 'date-fns';
import { askLogsChat } from '../api/logs/logs-chat.api';
import { getAllLogs } from '../api/logs/logs.api';
import { BasketSelect } from '../components/basket-select';
import { LogsPeriodControls } from '../components/logs-period-controls';
import { useBaskets } from '../hooks/use-baskets';
import { getLogsPeriodDates, getLogsPeriodParamsForApi } from '../utils/logs-period.utils';
import { CHAT_PROMPTS } from '../prompts/logs-chat-prompts';
import { TextField } from '@mui/material';
import { OwnButton, SpeechToText } from '@lifeis/common-ui';
import type { IDiaryLog } from '../domains/log.domain';
import css from './logs-chat.page.module.scss';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const LogsChatPage = () => {
  const { baskets } = useBaskets();
  const [period, setPeriod] = useState<'today' | 'week' | 'all' | 'range'>('week');
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [selectedBasketId, setSelectedBasketId] = useState<string | ''>('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<IDiaryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isCaptionsNeedClear, setIsCaptionsNeedClear] = useState(false);
  const [isListeningFired, setIsListeningFired] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async (periodValue: typeof period, range: typeof dateRange, basketId: string) => {
    setLogsLoading(true);
    try {
      const { from, to } = getLogsPeriodDates(periodValue, range);
      const response = await getAllLogs(from, to, basketId || undefined);
      setLogs(response.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (period === 'range') {
      fetchLogs(period, dateRange, selectedBasketId);
    } else {
      fetchLogs(period, { from: null, to: null }, selectedBasketId);
    }
  }, [period, dateRange, selectedBasketId, fetchLogs]);

  const logsWithDateHeaders = useMemo(() => {
    const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const items: Array<{ type: 'date-header'; label: string } | { type: 'log'; log: IDiaryLog }> = [];
    let lastDateKey = '';

    for (const log of sorted) {
      const logDate = new Date(log.timestamp);
      const dateKey = format(logDate, 'yyyy-MM-dd');

      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        const label = isToday(logDate)
          ? 'Today'
          : isYesterday(logDate)
          ? 'Yesterday'
          : format(logDate, 'EEEE, MMM d, yyyy');
        items.push({ type: 'date-header', label });
      }
      items.push({ type: 'log', log });
    }

    return items;
  }, [logs]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    messagesAreaRef.current?.scrollTo({ top: messagesAreaRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, logs]);

  const handlePromptClick = useCallback((prompt: string) => {
    setQuestion(prompt);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsListeningFired(false);
    }
    if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setIsListeningFired((prev) => !prev);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getChatParams = useCallback(
    () => getLogsPeriodParamsForApi(period, dateRange, selectedBasketId),
    [period, dateRange, selectedBasketId],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = question.trim();
      if (!q || isLoading) return;

      setIsCaptionsNeedClear(true);
      setQuestion('');
      setMessages((prev) => [...prev, { role: 'user', content: q }]);
      setIsLoading(true);

      try {
        const params = getChatParams();
        const { answer } = await askLogsChat(q, { ...params, messages });
        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      } catch (err) {
        console.error('Chat error:', err);
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${(err as Error).message}` }]);
      } finally {
        setIsLoading(false);
      }
    },
    [question, isLoading, getChatParams, messages],
  );

  return (
    <main className={css.logsChatPage}>
      <div className={css.controlsSection}>
        <div className={css.controlsRow}>
          <BasketSelect baskets={baskets} value={selectedBasketId} onChange={setSelectedBasketId} />
          <LogsPeriodControls
            period={period}
            onPeriodChange={setPeriod}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
      </div>

      <div className={css.chatSection}>
        <div ref={messagesAreaRef} className={css.messagesArea}>
          {logsLoading ? (
            <div className={css.emptyState}>Loading logs...</div>
          ) : logsWithDateHeaders.length > 0 ? (
            <>
              {logsWithDateHeaders.map((item, i) =>
                item.type === 'date-header' ? (
                  <div key={`h-${i}`} className={css.logsDateHeader}>
                    {item.label}
                  </div>
                ) : (
                  <div key={item.log.id} className={css.messageUser}>
                    <div className={css.messageContent}>
                      <span className={css.logsTime}>{format(new Date(item.log.timestamp), 'HH:mm')}</span>
                      <span className={css.logsBasketInUser}>({item.log.basket_name})</span> {item.log.message}
                    </div>
                  </div>
                ),
              )}
            </>
          ) : null}
          {messages.length === 0 && !logsLoading && logs.length === 0 && (
            <div className={css.emptyState}>
              Ask a question about your logs. For example: &quot;What did I eat this week?&quot; or &quot;Summarize my
              entries.&quot;
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? css.messageUser : css.messageAssistant}>
              <div className={css.messageContent}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className={css.messageAssistant}>
              <div className={css.messageContent}>...</div>
            </div>
          )}
        </div>

        <div className={css.promptBubbles}>
          {CHAT_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={css.promptBubble}
              onClick={() => handlePromptClick(item.prompt)}
              disabled={isLoading}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form ref={formRef} onSubmit={handleSubmit} className={css.chatForm}>
          <TextField
            inputRef={inputRef}
            className={css.questionInput}
            multiline
            maxRows={4}
            placeholder="Ask a question about your logs..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            // onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
            variant="outlined"
            size="small"
            fullWidth
            disabled={isLoading}
          />
          <SpeechToText
            onCaption={(caption) => {
              const last = caption?.length ? caption[caption.length - 1] : '';
              if (last) setQuestion((q) => (q ? `${q} ${last}` : last));
            }}
            onCleared={() => setIsCaptionsNeedClear(false)}
            isNeedClear={isCaptionsNeedClear}
            id="chat"
            isToggledListening={isListeningFired}
            onListeningToggled={() => setIsListeningFired((prev) => !prev)}
            showPlayButton={false}
          />
          <OwnButton type="submit" disabled={!question.trim() || isLoading}>
            Ask
          </OwnButton>
        </form>
      </div>
    </main>
  );
};
