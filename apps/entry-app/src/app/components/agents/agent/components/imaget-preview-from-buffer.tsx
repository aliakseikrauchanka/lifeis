import React, { useEffect, useState } from 'react';

export const ImagePreviewFromBuffer = ({ buffer }: { buffer: ArrayBuffer | Uint8Array }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (buffer) {
      const blob = new Blob([buffer], { type: 'image/jpeg' }); // Or the correct MIME type (e.g., 'image/png')
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      // Clean up the URL object when the component unmounts or the buffer changes
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null); // Clear the preview if the buffer is null or undefined
    }
  }, [buffer]);

  return (
    <div>
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Image preview"
          style={{ position: 'absolute', right: '40px', bottom: '10px', maxWidth: '50px', opacity: 0.5 }}
        />
      )}
      {!previewUrl && <p>No image to preview</p>} {/* Optional: Display a message when there's no preview */}
    </div>
  );
};
