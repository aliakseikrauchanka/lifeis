// the same config that has entry app
// TODO: config should be stored in app
export const CONFIG = {
  BE_URL: `${import.meta.env.VITE_BE || 'http://localhost:3000'}/api`,
  CLIENT_ID: import.meta.env.VITE_CLIENT_ID,
};
