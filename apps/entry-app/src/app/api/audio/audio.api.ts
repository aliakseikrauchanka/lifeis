import { utilFetch } from '@lifeis/common-ui';
import { CONFIG } from '../../../config';

export const transcript = async (blob: Blob): Promise<Response> => {
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
