import { useEffect, useRef, useState } from 'react';
import { useAudioDevices } from '@lifeis/common-ui';
import { Check, Mic } from 'lucide-react';

interface MicSelectorProps {
  className?: string;
}

export function MicSelector({ className }: MicSelectorProps) {
  const { inputDevices, inputDeviceId, setInputDeviceId } = useAudioDevices();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (inputDevices.length === 0) return null;

  const currentLabel = inputDevices.find((d) => d.deviceId === inputDeviceId)?.label;

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={currentLabel ? `Microphone: ${currentLabel}` : 'Select microphone'}
        className="flex items-center justify-center h-7 w-7 rounded-lg text-violet-700 hover:text-violet-900 hover:bg-violet-500/8 transition-colors"
      >
        <Mic className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[14rem] max-w-[20rem] rounded-md border border-black/10 bg-white shadow-lg py-1">
          <button
            type="button"
            onClick={() => {
              setInputDeviceId('');
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-violet-50 flex items-center gap-2 ${
              !inputDeviceId ? 'text-violet-900 font-medium' : 'text-foreground'
            }`}
          >
            <span className="w-4 inline-flex justify-center">
              {!inputDeviceId && <Check className="h-3 w-3" />}
            </span>
            Default
          </button>
          {inputDevices.map((d) => (
            <button
              key={d.deviceId}
              type="button"
              onClick={() => {
                setInputDeviceId(d.deviceId);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-violet-50 flex items-center gap-2 truncate ${
                inputDeviceId === d.deviceId ? 'text-violet-900 font-medium' : 'text-foreground'
              }`}
              title={d.label}
            >
              <span className="w-4 inline-flex justify-center shrink-0">
                {inputDeviceId === d.deviceId && <Check className="h-3 w-3" />}
              </span>
              <span className="truncate">{d.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
