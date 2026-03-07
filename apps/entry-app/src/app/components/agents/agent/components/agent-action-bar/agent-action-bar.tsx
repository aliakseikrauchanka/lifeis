import { OwnButton, SpeechToText } from '@lifeis/common-ui';
import Autocomplete from '@mui/joy/Autocomplete';
import { CameraAlt } from '@mui/icons-material';
import { AI_PROVIDER_OPTIONS } from '../../agent.constants';
import css from './agent-action-bar.module.scss';

const getProviderOptions = (isExplicitLanguage: boolean) =>
  isExplicitLanguage ? [...AI_PROVIDER_OPTIONS] : AI_PROVIDER_OPTIONS.filter((opt) => opt.value !== 'glosbe');

interface IAgentActionBarProps {
  selectedAiProviders: string[];
  onAiProviderChange: (values: string[]) => void;
  isExplicitLanguage: boolean;
  number?: number;
  onCapture: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  message: string;
  hasContent: boolean;
  audioEnabled: boolean;
  id: string;
  savedCaptions: string[];
  onCaption: (caption: string[] | undefined) => void;
  isCaptionsNeedClear: boolean;
  onCaptionsCleared: () => void;
  isListeningFired: boolean;
  onListeningToggled: () => void;
  showPlayButton?: boolean;
}

export const AgentActionBar = ({
  selectedAiProviders,
  onAiProviderChange,
  isExplicitLanguage,
  number,
  onCapture,
  onClear,
  message,
  hasContent,
  audioEnabled,
  id,
  onCaption,
  isCaptionsNeedClear,
  onCaptionsCleared,
  isListeningFired,
  onListeningToggled,
  showPlayButton = true,
}: IAgentActionBarProps) => {
  const providerOptions = getProviderOptions(isExplicitLanguage);

  return (
    <div className={css.buttons}>
      <Autocomplete
        multiple
        disableClearable
        value={providerOptions.filter((opt) => selectedAiProviders.includes(opt.value))}
        onChange={(_, newValue) => onAiProviderChange(newValue.map((opt) => opt.value))}
        options={providerOptions}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
        isOptionEqualToValue={(option, value) =>
          (typeof option === 'string' ? option : option.value) === (typeof value === 'string' ? value : value.value)
        }
        disableCloseOnSelect
        size="sm"
        sx={{ minHeight: 30, minWidth: 95 }}
      />
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
        disabled={!hasContent}
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
          showPlayButton={showPlayButton}
        />
      )}
      <OwnButton type="submit" style={{ height: '100%' }} disabled={!message || selectedAiProviders.length === 0}>
        Submit
      </OwnButton>
    </div>
  );
};
