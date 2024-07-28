import { utilFetch } from '@lifeis/common-ui';
import { CONFIG } from '../../../config';

export const transcriptOpenAi = async (blob: Blob): Promise<Response> => {
  const formData = new FormData();
  formData.append('audio', blob);

  return utilFetch(`${CONFIG.BE_URL}/openai/transcribe`, {
    method: 'POST',
    body: formData,
    headers: {
      MIME: blob.type,
    },
  });
};

export const transcriptDeepgram = async (blob: Blob): Promise<Response> => {
  const formData = new FormData();
  formData.append('audio', blob);

  return utilFetch(`${CONFIG.BE_URL}/deepgram/transcribe`, {
    method: 'POST',
    body: formData,
    headers: {
      MIME: blob.type,
    },
  });
};
