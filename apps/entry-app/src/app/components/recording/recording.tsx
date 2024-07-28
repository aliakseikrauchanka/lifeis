import { startRecording, stopRecording } from '../../services/recorder.service';
import { OwnButton } from '@lifeis/common-ui';
import React, { useRef } from 'react';
import css from './recording.module.scss';
import classNames from 'classnames';

interface IRecordingProps {
  transcription: string;
  requestTranscript: (blob: Blob) => Promise<void>;
}

export const Recording = ({ transcription, requestTranscript }: IRecordingProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleRecordStart = () => {
    startRecording(async (blob: Blob) => {
      await requestTranscript(blob);

      if (audioRef.current) {
        audioRef.current.src = URL.createObjectURL(blob);
      }
    });
  };

  const handleStop = () => {
    stopRecording();
  };

  return (
    <div>
      <OwnButton onClick={handleRecordStart}>Record </OwnButton>
      <OwnButton onClick={handleStop}>Stop Recording</OwnButton>
      {transcription && (
        <div>
          <div>
            <h3>Audio of recording:</h3>
          </div>
          <h3>Transcription from recording:</h3>
          <p>{transcription}</p>
        </div>
      )}
      <audio
        className={classNames(css.audio, {
          [css.audioVisible]: !!transcription,
        })}
        ref={transcription ? audioRef : undefined}
        controls
        autoPlay
      ></audio>

      <br />
    </div>
  );
};
