import { AudioInputDeviceSelector, AudioOutputDeviceSelector, OwnButton, UserSession } from '@lifeis/common-ui';
import { ArrowDownwardRounded, ArrowUpward, Mic, MicOff, Reply, SearchRounded } from '@mui/icons-material';
import Select from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import classNames from 'classnames';
import { SttProviderType, useStorageContext } from '../../contexts/storage.context';
import css from './app-header.module.scss';

interface IAppHeaderProps {
  isOfflineMode: boolean;
  isLoggedIn: boolean;
  onLoginSuccess: (googleUserId: string) => void;
  onLogOut: () => void;
}

export function AppHeader({ isOfflineMode, isLoggedIn, onLoginSuccess, onLogOut }: IAppHeaderProps) {
  const {
    audioEnabled,
    setAudioEnabled,
    isFullScreen,
    setIsSearchOpened,
    prevFocusedAgentIndex,
    setFocusedAgentIndex,
    sttProvider,
    setSttProvider,
  } = useStorageContext();

  return (
    <header
      className={classNames(css.header, {
        [css.headerFullScreen]: isFullScreen,
      })}
    >
      <div className={css.headerContent}>
        <UserSession
          isFullScreen={isFullScreen}
          isOfflineMode={isOfflineMode}
          isLoggedIn={isLoggedIn}
          onLoginSuccess={onLoginSuccess}
          onLogOut={onLogOut}
        />
        <div
          className={classNames(css.headerIcons, {
            [css.headerIconsFullScreen]: isFullScreen,
          })}
        >
          <OwnButton onClick={() => setIsSearchOpened((prev) => !prev)}>
            <SearchRounded />
          </OwnButton>
          <OwnButton
            onClick={() =>
              setFocusedAgentIndex((prev) => {
                const newValue = prev - 1;
                return newValue < 0 ? 0 : newValue;
              })
            }
          >
            <ArrowUpward />
          </OwnButton>
          <OwnButton onClick={() => setFocusedAgentIndex((prev) => prev + 1)}>
            <ArrowDownwardRounded />
          </OwnButton>
          <OwnButton
            onClick={() => {
              typeof prevFocusedAgentIndex !== 'undefined' && setFocusedAgentIndex(prevFocusedAgentIndex);
            }}
          >
            <Reply />
          </OwnButton>
          <OwnButton type="button" color="success" onClick={() => setAudioEnabled(!audioEnabled)}>
            {audioEnabled ? <MicOff /> : <Mic />}
          </OwnButton>
          {audioEnabled && (
            <>
              <AudioInputDeviceSelector />
              <AudioOutputDeviceSelector />
              <Select
                value={sttProvider}
                onChange={(_, val) => val && setSttProvider(val as SttProviderType)}
                size="sm"
                sx={{ minHeight: 'initial', padding: '0.2rem', fontSize: '12px', minWidth: '40px' }}
              >
                <Option value="elevenlabs">11Labs Realtime</Option>
                <Option value="deepgram">DG Realtime</Option>
                <Option value="deepgram-file">DG File</Option>
              </Select>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
