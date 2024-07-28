import { transcriptOpenAi } from '../../api/audio/audio.api';
import React, { useCallback } from 'react';

export const FileInput = () => {
  const [transcribe, setTranscribe] = React.useState<string>('');
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target?.files) {
      return;
    }

    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onloadend = async () => {
      const blob = new Blob([reader.result as ArrayBuffer], { type: 'audio/mp3' });
      const data = await transcriptOpenAi(blob);
      const t = await data.json();

      setTranscribe(t.text);
    };

    if (file) {
      reader.readAsArrayBuffer(file);
    }
  }, []);

  return (
    <>
      <input type="file" accept="audio/mp3" onChange={handleFileChange} />
      <div>{transcribe}</div>
    </>
  );
};
