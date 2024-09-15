import { useStorageContext } from '../../contexts/storage.context';
import React, { ReactElement } from 'react';

interface AudioSwitchProps {
  audioElement: ReactElement;
  nonAudioElement: ReactElement;
}

const AudioSwitch = ({ audioElement, nonAudioElement }: AudioSwitchProps): ReactElement => {
  const { audioEnabled } = useStorageContext();
  // You can add state or logic here if needed

  return audioEnabled ? audioElement : nonAudioElement;
};

export default AudioSwitch;
