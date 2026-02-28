import { OwnButton, SpeechToText } from '@lifeis/common-ui';
import { Select, Option } from '@mui/joy';
import { CameraAlt } from '@mui/icons-material';
import css from './agent-action-bar.module.scss';

interface IAgentActionBarProps {
  selectedAiProvider: string;
  onAiProviderChange: (value: string) => void;
  isExplicitLanguage: boolean;
  number?: number;
  onCapture: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  message: string;
  answer: string;
  isSubmitting: boolean;
  audioEnabled: boolean;
  id: string;
  savedCaptions: string[];
  onCaption: (caption: string[] | undefined) => void;
  isCaptionsNeedClear: boolean;
  onCaptionsCleared: () => void;
  isListeningFired: boolean;
  onListeningToggled: () => void;
}

export const AgentActionBar = ({
  selectedAiProvider,
  onAiProviderChange,
  isExplicitLanguage,
  number,
  onCapture,
  onClear,
  message,
  answer,
  isSubmitting,
  audioEnabled,
  id,
  onCaption,
  isCaptionsNeedClear,
  onCaptionsCleared,
  isListeningFired,
  onListeningToggled,
}: IAgentActionBarProps) => {
  return (
    <div className={css.buttons}>
      <Select
        value={selectedAiProvider}
        onChange={(_, newValue) => onAiProviderChange(newValue as string)}
        sx={{ minHeight: 30, minWidth: 95 }}
      >
        <Option value="gemini-2.5-flash-lite">Gemini Flash 2.5 Lite</Option>
        <Option value="gemini-2.5-flash">Gemini Flash 2.5</Option>
        <Option value="gemini-3-pro-preview">Gemini Pro 3.0</Option>
        <Option value="openai">OpenAI</Option>
        {isExplicitLanguage && <Option value="glosbe">Glosbe</Option>}
        <Option value="deepseek-r1">Deepseek R1</Option>
      </Select>
      <label htmlFor={`photo-${number}`} className={css.buttonsPhoto}>
        <CameraAlt fontSize="large" color="inherit" />
      </label>
      <input
        type="file"
        id={`photo-${number}`}
        capture="environment"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChangeCapture={onCapture}
      />
      <OwnButton
        type="button"
        color="danger"
        onClick={onClear}
        style={{ marginLeft: 'auto', height: '100%' }}
        disabled={!message && !answer}
      >
        Clear All
      </OwnButton>
      {audioEnabled && (
        <SpeechToText
          className={css.buttonsStt}
          onCaption={onCaption}
          id={id}
          onCleared={onCaptionsCleared}
          isNeedClear={isCaptionsNeedClear}
          isToggledListening={isListeningFired}
          onListeningToggled={onListeningToggled}
        />
      )}
      <OwnButton type="submit" style={{ height: '100%' }} disabled={!message || isSubmitting}>
        Submit
      </OwnButton>
    </div>
  );
};
