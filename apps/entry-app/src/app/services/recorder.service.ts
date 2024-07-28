let chunks: Array<Blob> = [];
let mediaRecorder: MediaRecorder;

export const startRecording = async (onStop: (blob: Blob) => void): Promise<void> => {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      let options: MediaRecorderOptions | undefined;
      if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
        options = { mimeType: 'audio/webm; codecs=opus' };
      } else {
        // includes also MediaRecorder.isTypeSupported('video/mp4') for IOS
        options = { mimeType: 'video/mp4', videoBitsPerSecond: 100000 };
      }
      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = (e) => {
        const blob = new Blob(chunks, { type: options?.mimeType });
        chunks = [];

        onStop(blob);
      };

      mediaRecorder.start();
    })
    .catch((err) => {
      console.error('Error while recording:', err);
    });
};

export function stopRecording() {
  mediaRecorder.pause();
  mediaRecorder.stop();
}
