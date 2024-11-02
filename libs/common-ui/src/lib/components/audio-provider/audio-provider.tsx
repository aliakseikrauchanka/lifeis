import { useState } from 'react';
import { Conditioned } from './components/conditioned';
import Script from './components/script';

interface AudioProviderProps {
  children: React.ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [ortLoaded, setORTLoaded] = useState(false);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);

  const initORT = () => {
    if (typeof window !== 'undefined' && (window as any).ort) {
      // Make ort available globally
      (window as any).globalThis.ort = (window as any).ort;
      setORTLoaded(true);
    }
  };

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.js"
        onLoad={() => {
          console.log('ort has loaded');

          initORT();
        }}
      />
      <Conditioned is={ortLoaded}>
        <Script
          src="https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.7/dist/bundle.min.js"
          onLoad={() => {
            console.log('vad-web has loaded');
            setIsFullyLoaded(true);
          }}
        />
      </Conditioned>

      {isFullyLoaded ? children : <div>Loading library...</div>}
    </>
  );
};
