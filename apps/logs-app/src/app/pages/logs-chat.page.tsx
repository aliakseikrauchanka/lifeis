import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { askLogsChat } from '../api/logs/logs-chat.api';
import { BasketSelect } from '../components/basket-select';
import { LogsPeriodControls } from '../components/logs-period-controls';
import { useBaskets } from '../hooks/use-baskets';
import { getLogsPeriodParamsForApi } from '../utils/logs-period.utils';
import { TextField } from '@mui/material';
import { OwnButton } from '@lifeis/common-ui';
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
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isLoading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }, []);

  const getChatParams = useCallback(
    () => getLogsPeriodParamsForApi(period, dateRange, selectedBasketId),
    [period, dateRange, selectedBasketId],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = question.trim();
      if (!q || isLoading) return;

      setQuestion('');
      setMessages((prev) => [...prev, { role: 'user', content: q }]);
      setIsLoading(true);

      try {
        const params = getChatParams();
        const { answer } = await askLogsChat(q, params);
        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
      } catch (err) {
        console.error('Chat error:', err);
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${(err as Error).message}` }]);
      } finally {
        setIsLoading(false);
      }
    },
    [question, isLoading, getChatParams],
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
        <div className={css.messagesArea}>
          {messages.length === 0 && (
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

        <form ref={formRef} onSubmit={handleSubmit} className={css.chatForm}>
          <TextField
            inputRef={inputRef}
            className={css.questionInput}
            multiline
            maxRows={4}
            placeholder="Ask a question about your logs..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            variant="outlined"
            size="small"
            fullWidth
            disabled={isLoading}
          />
          <OwnButton type="submit" disabled={!question.trim() || isLoading}>
            Ask
          </OwnButton>
        </form>
      </div>
    </main>
  );
};
