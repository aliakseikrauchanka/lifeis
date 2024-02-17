let chunks = [];
let mediaRecorder;

export const startRecording = (onStop: (blob: BLob) => void): void => {
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      let options;
      // if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
      //   options = { mimeType: 'video/webm; codecs=vp9' };
      // } else if (MediaRecorder.isTypeSupported('video/webm')) {
      //   options = { mimeType: 'video/webm' };
      // } else if (MediaRecorder.isTypeSupported('video/mp4')) {

      // for IOS
      options = { mimeType: 'video/mp4', videoBitsPerSecond: 100000 };
      // } else {
      //   console.error('no suitable mimetype found for this device');
      // }
      mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.start();

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.onstop = (e) => {
        const blob = new Blob(chunks, { type: options.mimeType });
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
