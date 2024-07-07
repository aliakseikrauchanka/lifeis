export const verifyAccessToken = (req, res, next) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  console.log(req.headers.authorization?.split(' ')[0]);

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

      // The access token is valid, continue processing the request
      next();
    })
    .catch((error) => {
      console.error('Access token verification error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    });
};
