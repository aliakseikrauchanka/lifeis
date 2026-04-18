import { utilFetch } from '@lifeis/common-ui';

const OUTPUT_DEVICE_KEY = 'audio-output-device';

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

    const deviceId = typeof window !== 'undefined' ? localStorage.getItem(OUTPUT_DEVICE_KEY) : null;
    const audioAny = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (deviceId && typeof audioAny.setSinkId === 'function') {
      try {
        await audioAny.setSinkId(deviceId);
      } catch {
        // setSinkId may fail if device is unavailable; fall back to default
      }
    }
    audio.play();
  } catch (e) {
    console.error('TTS error:', e);
  }
};
