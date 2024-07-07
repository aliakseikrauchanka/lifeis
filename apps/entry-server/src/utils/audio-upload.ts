import multer from 'multer';
import path from 'path';
import fs from 'fs';

const getFileName = (mime: string | string[]) => {
  const mimeStr: string = Array.isArray(mime) ? mime[0] : mime;
  if (mimeStr === 'audio/mp3;') {
    return 'record.mp3';
  }
  const fileName = mimeStr === 'audio/webm; codecs=opus' ? 'record.webm' : 'record.mp4';
  return fileName;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = path.join(__dirname, 'uploads');
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
    cb(null, d);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      // file.fieldname + '-' + Date.now() + path.extname(file.originalname)
      getFileName(req.headers.mime),
    );
  },
});

export const uploadMiddlewareFactory = multer({ storage });

export const getFilePath = (mimeType: string | string[]) => path.join(__dirname, 'uploads', getFileName(mimeType));

export const mp3FilePath = path.join(__dirname, 'uploads', 'record.mp3');

// export { getFileName, uploadMiddlewareFactory };
