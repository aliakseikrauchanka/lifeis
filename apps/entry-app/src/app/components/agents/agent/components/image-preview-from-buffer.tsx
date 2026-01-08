import { Close } from '@mui/icons-material';
import React, { useEffect, useState } from 'react';
import css from './image-preview-from-buffer.module.scss';
import { IconButton } from '@mui/joy';

interface ImagePreviewFromBufferProps {
  buffer: ArrayBuffer | Uint8Array;
  onClose: () => void;
  isLoading: boolean;
}

export const ImagePreviewFromBuffer = ({ buffer, onClose, isLoading }: ImagePreviewFromBufferProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (buffer) {
      // Convert to ArrayBuffer to ensure compatibility with Blob
      // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
      const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' }); // Or the correct MIME type (e.g., 'image/png')
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      // Clean up the URL object when the component unmounts or the buffer changes
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null); // Clear the preview if the buffer is null or undefined
    }
  }, [buffer]);

  const handleImageClick = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  return (
    <div className={css.imagePreview}>
      {isLoading && <span>Loading...</span>}
      {previewUrl && (
        <img src={previewUrl} alt="Preview" onClick={handleImageClick} className={css.imagePreviewImage} />
      )}
      <IconButton
        aria-label="Close"
        variant="plain"
        color="neutral"
        size="sm" // Adjust size as needed
        sx={{ position: 'absolute', right: 0, top: 0 }}
        onClick={onClose}
      >
        <Close /> {/* Use the ModalClose icon */}
      </IconButton>
    </div>
  );
};
