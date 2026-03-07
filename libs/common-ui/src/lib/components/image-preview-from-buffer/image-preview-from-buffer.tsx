import { Close } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { useEffect, useState } from 'react';
import css from './image-preview-from-buffer.module.scss';

export interface ImagePreviewFromBufferProps {
  buffer: ArrayBuffer | Uint8Array;
  onClose: () => void;
  isLoading: boolean;
  className?: string;
}

export const ImagePreviewFromBuffer = ({ buffer, onClose, isLoading, className }: ImagePreviewFromBufferProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (buffer) {
      const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
      const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [buffer]);

  const handleImageClick = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  return (
    <div className={className ? `${css.imagePreview} ${className}` : css.imagePreview}>
      {isLoading && <span>Loading...</span>}
      {previewUrl && (
        <img src={previewUrl} alt="Preview" onClick={handleImageClick} className={css.imagePreviewImage} />
      )}
      <IconButton
        aria-label="Close"
        variant="plain"
        color="neutral"
        size="sm"
        sx={{ position: 'absolute', right: 0, top: 0 }}
        onClick={onClose}
      >
        <Close />
      </IconButton>
    </div>
  );
};
