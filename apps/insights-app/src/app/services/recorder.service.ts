let chunks = [];
let mediaRecorder;

export const startRecording = (onStop: (blob: BLob) => void): void => {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      alert(MediaRecorder.isTypeSupported('audio/webm; codecs=opus'));
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.start();

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = (e) => {
        const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' });
        chunks = [];

        onStop(blob);
      };
    })
    .catch((err) => {
      console.error('Error while recording:', err);
    });
};

export function stopRecording() {
  console.log('try stop recording');
  mediaRecorder.stop();
}
