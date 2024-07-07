import ffmpeg from 'fluent-ffmpeg';

export const convertFile = (inputPath, outputPath, onSuccess) => {
  console.log('debug, input', inputPath, 'output', outputPath);
  ffmpeg(inputPath)
    .output(outputPath)
    .on('end', function () {
      console.log('Conversion Finished');
      onSuccess && onSuccess();
    })
    .on('error', function (err) {
      console.log('Conversion Error: ' + err.message);
    })
    .run();
};
