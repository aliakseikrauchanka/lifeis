import { IconButton } from '@mui/joy';
import { CopyAll } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import classNames from 'classnames';
import { Ref } from 'react';
import css from './agent-response.module.scss';

interface IAgentResponseProps {
  answer: string;
  isSubmitting: boolean;
  isWideMode: boolean;
  responseRef: Ref<HTMLDivElement>;
  onCopyResponse: () => void;
}

export const AgentResponse = ({
  answer,
  isSubmitting,
  isWideMode,
  responseRef,
  onCopyResponse,
}: IAgentResponseProps) => {
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
        <h4 className={css.responseTitle}>
          Response:{' '}
          {!isSubmitting && answer && (
            <IconButton aria-label="Copy" size="sm" color="primary" onClick={onCopyResponse}>
              <CopyAll />
            </IconButton>
          )}
        </h4>
        {isSubmitting ? (
          'Generating ...'
        ) : (
          <div className={'response-body'} ref={responseRef}>
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
