import { utilFetch } from '@lifeis/common-ui';

export const speak = async (text: string, languageCode: string): Promise<void> => {
  try {
    const res = await utilFetch(`/gemini/text-to-speech?l=${languageCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const { audioContent } = await res.json();
    if (!audioContent) return;

    const byteCharacters = atob(audioContent);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  } catch (e) {
    console.error('TTS error:', e);
  }
};
