import { Response } from 'express';

export const verifyAccessToken = (req, res: Response, next) => {
  if (process.env.ENV === 'offline') {
    res.locals.userId = 'local_user';
    next();
    return;
  }

  const app = req.headers['x-app-id'];
  const accessToken = req.headers.authorization?.split(' ')[1];

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
      const clientId = app === 'logs' ? process.env.LOGS_CLIENT_ID : process.env.CLIENT_ID;
      if (data.audience !== clientId) {
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
