import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { authGoogle } from '../../../api/auth/auth.api';

interface ISignInProps {
  onSuccess: () => void;
}

export function SignIn({ onSuccess }: ISignInProps) {
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (googleResponse) => {
      try {
        await authGoogle(googleResponse.code);
        onSuccess();
      } catch (error) {
        console.error('Error while making request to own auth service:', error);
      }
    },
    onError: (err) => {
      // Handle login errors here
      console.error('Google login failed', err);
    },
    flow: 'auth-code',
  });

  return <button onClick={() => handleGoogleLogin()}>Sign in with Google</button>;
}
