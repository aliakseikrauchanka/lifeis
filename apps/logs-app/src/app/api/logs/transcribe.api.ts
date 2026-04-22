import { utilFetch } from '@lifeis/common-ui';

export interface TranscribeResult {
  filename: string;
  message: string;
  timestamp: number;
  log_id?: string;
  basket_id?: string;
  error?: string;
}

export const transcribeAudioFiles = async (
  files: File[],
  basketId?: string,
  timestamps?: Record<string, string>,
): Promise<{ results: TranscribeResult[] }> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('audio', file);
  });
  if (basketId) {
    formData.append('basket_id', basketId);
  }
  if (timestamps && Object.keys(timestamps).length > 0) {
    formData.append('timestamps', JSON.stringify(timestamps));
  }

  const response = await utilFetch('/logs/transcribe-audio', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody: { message?: string } = await response.json();
    throw new Error(errorBody.message || 'Failed to transcribe audio files');
  }

  return response.json();
};
