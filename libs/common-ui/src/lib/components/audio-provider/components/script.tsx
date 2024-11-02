import React, { useEffect } from 'react';

interface ScriptProps {
  src: string;
  onLoad?: () => void;
}

const Script: React.FC<ScriptProps> = ({ src, onLoad }) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    script.onload = () => {
      if (onLoad) {
        onLoad();
      }
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [src, onLoad]);

  return null;
};

export default Script;
