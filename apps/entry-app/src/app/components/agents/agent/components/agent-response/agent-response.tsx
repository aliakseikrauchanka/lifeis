import { IconButton, Tabs, TabList, Tab, TabPanel, CircularProgress } from '@mui/joy';
import { CopyAll } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import classNames from 'classnames';
import DOMPurify from 'dompurify';
import { Ref, useState, useEffect, useMemo } from 'react';
import { AI_PROVIDER_OPTIONS, PROVIDER_ORDER } from '../../agent.constants';
import css from './agent-response.module.scss';

const getProviderLabel = (key: string) =>
  AI_PROVIDER_OPTIONS.find((opt) => opt.value === key)?.label ?? (key === 'response' ? 'History' : key);

type ProviderResponse = { answer: string; status: 'idle' | 'loading' | 'done' | 'error' };

interface IAgentResponseProps {
  providerResponses: Record<string, ProviderResponse>;
  isWideMode: boolean;
  responseRef: Ref<HTMLDivElement>;
  onCopyResponse: (content: string) => void;
}

export const AgentResponse = ({ providerResponses, isWideMode, responseRef, onCopyResponse }: IAgentResponseProps) => {
  const providerIds = useMemo(
    () => [
      ...PROVIDER_ORDER.filter((id) => id in providerResponses),
      ...Object.keys(providerResponses).filter((id) => !PROVIDER_ORDER.includes(id)),
    ],
    [providerResponses],
  );
  const [selectedTab, setSelectedTab] = useState<string | null>(providerIds[0] ?? null);

  useEffect(() => {
    if (providerIds.length > 0 && !providerIds.includes(selectedTab ?? '')) {
      setSelectedTab(providerIds[0]);
    }
  }, [providerIds, selectedTab]);

  if (providerIds.length === 0) {
    return (
      <div
        className={classNames(css.response, {
          [css.responseWide]: isWideMode,
        })}
      >
        <div
          className={classNames(css.responseContent, {
            [css.responseContentWide]: isWideMode,
          })}
        />
      </div>
    );
  }

  const activeProvider = selectedTab ?? providerIds[0];
  const activeResponse = providerResponses[activeProvider];
  const canCopy = activeResponse?.status === 'done' && !!activeResponse.answer;

  return (
    <div
      className={classNames(css.response, {
        [css.responseWide]: isWideMode,
      })}
    >
      <div
        className={classNames(css.responseContent, {
          [css.responseContentWide]: isWideMode,
        })}
      >
        <Tabs
          value={activeProvider}
          onChange={(_, value) => setSelectedTab(value as string)}
          size="sm"
          sx={{ overflow: 'auto' }}
        >
          <div className={css.responseTitle}>
            {canCopy && (
              <IconButton
                aria-label="Copy"
                size="sm"
                color="primary"
                onClick={() => onCopyResponse(activeResponse.answer)}
              >
                <CopyAll />
              </IconButton>
            )}
            <TabList sx={{ '--List-gap': '4px' }}>
              {providerIds.map((providerId) => {
                const resp = providerResponses[providerId];
                const isLoading = resp?.status === 'loading';
                return (
                  <Tab key={providerId} value={providerId} className={css.responseTabName}>
                    <span className={css.responseTabNameText}>{getProviderLabel(providerId)}</span>
                    {isLoading && <CircularProgress size="sm" sx={{ ml: 0.5 }} className={css.responseTabNameLoader} />}
                  </Tab>
                );
              })}
            </TabList>
          </div>
          {providerIds.map((providerId) => {
            const resp = providerResponses[providerId];
            const isActive = providerId === activeProvider;
            return (
              <TabPanel key={providerId} value={providerId} sx={{ p: 0 }}>
                <div className="response-body" ref={isActive ? responseRef : undefined}>
                  {resp?.status === 'loading' && 'Generating ...'}
                  {resp?.status === 'error' && 'Error generating response.'}
                  {resp?.status === 'done' && resp.answer && (
                    <ReactMarkdown>{DOMPurify.sanitize(resp.answer, { ALLOWED_TAGS: [] })}</ReactMarkdown>
                  )}
                </div>
              </TabPanel>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
};
