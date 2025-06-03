export const readClipboardText = (): Promise<string> => {
  if (navigator.clipboard && navigator.clipboard.readText) {
    return navigator.clipboard.readText();
  }

  // Fallback for older browsers
  return new Promise((resolve, reject) => {
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('paste');
      if (!successful) {
        reject(new Error('Fallback: Could not read clipboard contents'));
      } else {
        resolve(textArea.value);
      }
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(textArea);
    }
  });
};
