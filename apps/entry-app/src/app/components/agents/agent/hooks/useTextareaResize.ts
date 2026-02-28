import { useState, useRef, useEffect, useCallback } from 'react';

export const useTextareaResize = (initialHeight: number) => {
  const resizerRef = useRef(null);
  const textareaWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [height, setHeight] = useState(initialHeight);

  const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const resize = (e: MouseEvent | TouchEvent) => {
      if (!textareaWrapperRef.current) return;

      const clientY = 'clientY' in e ? e.clientY : e.touches?.[0]?.clientY;
      if (!clientY) return;

      const wrapperTop = textareaWrapperRef.current.getBoundingClientRect().top;
      const newHeight = clientY - wrapperTop;

      const minHeight = 50;
      const maxHeight = 500;

      if (newHeight > minHeight && newHeight < maxHeight) {
        setHeight(newHeight);
      }
    };

    const stopResizing = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('touchmove', resize);
      window.addEventListener('mouseup', stopResizing);
      window.addEventListener('touchend', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('touchmove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('touchend', stopResizing);
    };
  }, [isResizing]);

  return { height, resizerRef, textareaWrapperRef, startResizing, isResizing };
};
