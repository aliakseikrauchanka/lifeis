import { textToSpeech } from '../../api/assistants/assistants.api';

export const speak = async (selectionText: string, languageCode: string, onReady: (audioUrl: string) => void) => {
  // let audioContent;
  // if (!curAudioBase64) {
  const audioContent = await textToSpeech(selectionText, languageCode);
  // } else {
  //   audioContent = curAudioBase64;
  // }
  if (audioContent) {
    const byteCharacters = atob(audioContent);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const audioBlob = new Blob([byteArray], { type: 'audio/mp3' });

    // Create and play audio
    const audioUrl = URL.createObjectURL(audioBlob);
    onReady(audioUrl);
  }
};
