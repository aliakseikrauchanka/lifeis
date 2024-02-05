import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { authGoogle } from '../../../api/auth/auth';
import { AuthResponse } from '../../../domains/auth.domain';

interface ISignInProps {
  onSuccess: (codes: AuthResponse) => void;
}

export function SignIn({ onSuccess }: ISignInProps) {
  const googleLogin = useGoogleLogin({
    onSuccess: async (googleResponse) => {
      try {
        const authResponse = await authGoogle(googleResponse.code);
        onSuccess({
          accessToken: authResponse.access_token,
          refreshToken: authResponse.refresh_token,
        });
      } catch (error) {
        console.error('Error while making request to own service:', error);
      }
    },
    onError: (err) => {
      // Handle login errors here
      console.error('Google login failed', err);
    },
    flow: 'auth-code',
  });

  return <button onClick={() => googleLogin()}>Sign in with Google</button>;
}
