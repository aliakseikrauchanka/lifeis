import { utilFetch } from '@lifeis/common-ui';

export const transcriptOpenAi = async (blob: Blob): Promise<Response> => {
  const formData = new FormData();
  formData.append('audio', blob);

  return utilFetch(`/openai/transcribe`, {
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

  return utilFetch(`/deepgram/transcribe`, {
    method: 'POST',
    body: formData,
    headers: {
      MIME: blob.type,
    },
  });
};
