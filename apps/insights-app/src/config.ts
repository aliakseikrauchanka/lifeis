export const CONFIG = {
  BE_URL: `${process.env.NEXT_PUBLIC_BE || 'http://localhost:3000'}/api`,
  CLIENT_ID: process.env.NEXT_PUBLIC_CLIENT_ID as string,
};
