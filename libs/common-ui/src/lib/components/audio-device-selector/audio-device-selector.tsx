import React, { useState } from 'react';
import { IconButton, Menu, MenuItem } from '@mui/material';
import { Mic, Headphones } from '@mui/icons-material';
import { useAudioDevices } from '../../contexts/audio-devices.context';

const iconSx = { padding: 0.5, color: '#5e35b1', '&:hover': { bgcolor: 'rgba(94, 53, 177, 0.08)' } };

export const AudioInputDeviceSelector = () => {
  const { inputDevices, inputDeviceId, setInputDeviceId } = useAudioDevices();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  if (inputDevices.length === 0) return null;

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} title="Microphone" sx={iconSx}>
        <Mic fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setInputDeviceId('');
            setAnchor(null);
          }}
          selected={!inputDeviceId}
        >
          Default
        </MenuItem>
        {inputDevices.map((d) => (
          <MenuItem
            key={d.deviceId}
            onClick={() => {
              setInputDeviceId(d.deviceId);
              setAnchor(null);
            }}
            selected={inputDeviceId === d.deviceId}
          >
            {d.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export const AudioOutputDeviceSelector = () => {
  const { outputDevices, outputDeviceId, setOutputDeviceId } = useAudioDevices();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  if (outputDevices.length === 0) return null;

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} title="Headset" sx={iconSx}>
        <Headphones fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setOutputDeviceId('');
            setAnchor(null);
          }}
          selected={!outputDeviceId}
        >
          Default
        </MenuItem>
        {outputDevices.map((d) => (
          <MenuItem
            key={d.deviceId}
            onClick={() => {
              setOutputDeviceId(d.deviceId);
              setAnchor(null);
            }}
            selected={outputDeviceId === d.deviceId}
          >
            {d.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export const AudioDeviceSelector = () => {
  const { inputDevices, outputDevices } = useAudioDevices();
  if (inputDevices.length === 0 && outputDevices.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
      <AudioInputDeviceSelector />
      <AudioOutputDeviceSelector />
    </div>
  );
};
