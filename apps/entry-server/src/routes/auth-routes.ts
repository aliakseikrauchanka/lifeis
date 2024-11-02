import { Router } from 'express';

// const CLIENT_ID = process.env.CLIENT_ID;
// const CLIENT_SECRET = process.env.CLIENT_SECRET;
// // what is this? I send reques to oauth from server on localhost:3000 and redirect to localhost:4201
// // how does it work?
// const REDIRECT_URL = process.env.REDIRECT_URL ?? 'http://localhost:4201';

const router = Router();

router.post('/google', async (req, res) => {
  const { code } = req.body;
  const app = req.headers['x-app-id'];

  let clientId;
  let clientSecret;
  let redirectUri;
  // TODO: we use auth for couple of applications which seems not good idea
  if (app === 'logs') {
    clientId = process.env.LOGS_CLIENT_ID;
    clientSecret = process.env.LOGS_CLIENT_SECRET;
    redirectUri = process.env.LOGS_REDIRECT_URL;
  } else if (app === 'insights') {
    clientId = process.env.INSIGHTS_CLIENT_ID;
    clientSecret = process.env.INSIGHTS_CLIENT_SECRET;
    redirectUri = process.env.INSIGHTS_REDIRECT_URL;
  } else {
    clientId = process.env.CLIENT_ID;
    clientSecret = process.env.CLIENT_SECRET;
    redirectUri = process.env.REDIRECT_URL ?? 'http://localhost:4201';
  }
  const grantType = 'authorization_code';

  try {
    const rawResponse = await fetch('https://oauth2.googleapis.com/token', {
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
    });
    const response = await rawResponse.json();
    const tokenInfoRaw = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${response.access_token}`,
    );
    const tokenInfo = await tokenInfoRaw.json();

    res.json({
      ...response,
      google_user_id: tokenInfo.user_id,
    });
  } catch {
    console.error('Token exchange error');
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/google/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const app = req.headers['x-app-id'];
  let clientId;
  let clientSecret;
  let redirectUri;
  // TODO: we use auth for couple of applications which seems not good idea
  if (app === 'insights') {
    clientId = process.env.LOGS_CLIENT_ID;
    clientSecret = process.env.LOGS_CLIENT_SECRET;
    redirectUri = process.env.LOGS_REDIRECT_URL;
  } else {
    clientId = process.env.CLIENT_ID;
    clientSecret = process.env.CLIENT_SECRET;
    redirectUri = process.env.REDIRECT_URL;
  }
  const grantType = 'refresh_token';

  try {
    const rawResponse = await fetch('https://oauth2.googleapis.com/token', {
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
    });
    const response = await rawResponse.json();
    // maybe not needed for refresh token logic
    const tokenInfoRaw = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${response.access_token}`,
    );
    const tokenInfo = await tokenInfoRaw.json();

    res.json({
      ...response,
      google_user_id: tokenInfo.user_id,
    });
  } catch {
    console.error('Token exchange error');
    res.status(500);
  }
});

export default router;
