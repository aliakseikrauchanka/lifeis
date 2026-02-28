import { useEffect, useRef, useState } from 'react';
import { Mic } from '@mui/icons-material';

export const MicIndicator = () => {
  const [micLabel, setMicLabel] = useState('Detecting...');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const detectMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = stream.getAudioTracks()[0];
        setMicLabel(track.label || 'Unknown microphone');
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        setMicLabel('No microphone access');
      }
    };

    detectMic();

    navigator.mediaDevices.addEventListener('devicechange', detectMic);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', detectMic);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onClick={() => setOpen((prev) => !prev)}
        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', opacity: 0.7 }}
      >
        <Mic style={{ fontSize: '16px' }} />
      </span>
      {open && (
        <span
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            background: '#333',
            color: '#fff',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
          }}
        >
          {micLabel}
        </span>
      )}
    </span>
  );
};
