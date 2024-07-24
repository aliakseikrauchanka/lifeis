import { Router } from 'express';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
// what is this? I send reques to oauth from server on localhost:3000 and redirect to localhost:4201
// how does it work?
const REDIRECT_URL = process.env.REDIRECT_URL ?? 'http://localhost:4201';

const router = Router();

router.post('/google', (req, res) => {
  const { code } = req.body;
  const client_id = CLIENT_ID;
  const client_secret = CLIENT_SECRET;
  const redirect_uri = REDIRECT_URL;
  const grant_type = 'authorization_code';

  fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri,
      grant_type,
    }),
  })
    .then((response) => response.json())
    .then((tokens) => res.json(tokens))
    .catch(() => {
      // Handle errors in the token exchange
      console.error('Token exchange error');
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

router.post('/google/refresh', (req, res) => {
  const { refreshToken } = req.body;
  const client_id = CLIENT_ID;
  const client_secret = CLIENT_SECRET;
  const redirect_uri = REDIRECT_URL;
  const grant_type = 'refresh_token';

  fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id,
      client_secret,
      redirect_uri,
      grant_type,
    }),
  })
    .then((response) => response.json())
    .then((tokens) => {
      res.json(tokens);
    })
    .catch(() => {
      // Handle errors in the token exchange
      console.error('Token refresh error');
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

export default router;
