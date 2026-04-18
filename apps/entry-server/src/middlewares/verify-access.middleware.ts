import { Response } from 'express';

export const verifyAccessToken = (req, res: Response, next) => {
  if (process.env.MODE === 'offline' && process.env.NODE_ENV !== 'production') {
    res.locals.userId = 'local_user';
    next();
    return;
  }

  const app = req.headers['x-app-id'];

  const accessToken = req.headers.authorization?.split(' ')[1];

  // Service API key for server-to-server calls (e.g. MCP server)
  if (process.env.SERVICE_API_KEY && accessToken === process.env.SERVICE_API_KEY) {
    res.locals.userId = process.env.SERVICE_USER_ID;
    console.log('debug', 'res.locals.userId', res.locals.userId);
    next();
    return;
  }

  if (!accessToken) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        // The access token is invalid
        return res.status(401).json({ error: 'Invalid access token' });
      }

      // TODO: we use auth for couple of applications which seems not good idea
      const clientId =
        app === 'logs'
          ? process.env.LOGS_CLIENT_ID
          : app === 'insights'
          ? process.env.INSIGHTS_CLIENT_ID
          : app === 'training'
          ? process.env.TRAINING_CLIENT_ID
          : app === 'extension'
          ? process.env.EXTENSION_CLIENT_ID
          : process.env.CLIENT_ID;

      if (!clientId) {
        console.error(`verifyAccessToken: clientId env var not configured for app="${app}"`);
        return res.status(500).json({ error: 'Server authentication is not configured' });
      }

      if (data.audience !== clientId) {
        // SECURITY FIX: Removed console.log('data.audience', data.audience).
        // Logging the token's audience on mismatch leaks OAuth client ID information
        // to anyone with log access, aiding attacker enumeration.
        return res.status(401).json({ error: 'Token not issued for this application' });
      }

      // save user id into response locals
      res.locals.userId = data.user_id;

      // The access token is valid, continue processing the request
      next();
    })
    .catch((error) => {
      console.error('Access token verification error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    });
};
