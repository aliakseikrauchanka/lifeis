import { CONFIG } from '../../../config';

export const transcipt = async (blob: Blob): Promise<Response> => {
  const accessToken = localStorage.getItem('accessToken');

  const formData = new FormData();
  formData.append('audio', blob);

  return fetch(`${CONFIG.BE_URL}/transcribe`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      MIME: blob.type,
    },
  });
};
