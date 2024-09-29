import { Router } from 'express';

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
// what is this? I send reques to oauth from server on localhost:3000 and redirect to localhost:4201
// how does it work?
const REDIRECT_URL = process.env.REDIRECT_URL ?? 'http://localhost:4201';

const router = Router();

router.post('/google', (req, res) => {
  const { code } = req.body;
  const app = req.headers['x-app-id'];

  let clientId;
  let clientSecret;
  let redirectUri;
  // TODO: we use auth for couple of applications which seems not good idea
  if (app === 'insights') {
    clientId = process.env.INSIGHTS_CLIENT_ID;
    clientSecret = process.env.INSIGHTS_CLIENT_SECRET;
    redirectUri = process.env.INSIGHTS_REDIRECT_URL;
  } else {
    clientId = process.env.CLIENT_ID;
    clientSecret = process.env.CLIENT_SECRET;
    redirectUri = process.env.REDIRECT_URL;
  }
  const grantType = 'authorization_code';

  fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: grantType,
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
  const app = req.headers['x-app-id'];
  let clientId;
  let clientSecret;
  let redirectUri;
  // TODO: we use auth for couple of applications which seems not good idea
  if (app === 'insights') {
    clientId = process.env.INSIGHTS_CLIENT_ID;
    clientSecret = process.env.INSIGHTS_CLIENT_SECRET;
    redirectUri = process.env.INSIGHTS_REDIRECT_URL;
  } else {
    clientId = process.env.CLIENT_ID;
    clientSecret = process.env.CLIENT_SECRET;
    redirectUri = process.env.REDIRECT_URL;
  }
  const grantType = 'refresh_token';

  fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: grantType,
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
