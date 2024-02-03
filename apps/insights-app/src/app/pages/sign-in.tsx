import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { CONFIG } from '../../config';

interface ISignInProps {
  onSuccess: (codeResponse: any) => void;
}

function SignIn({ onSuccess }: ISignInProps) {
  const googleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        const response = await fetch(`${CONFIG.BE_URL}/api/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code: codeResponse.code }),
        });

        const data = await response.json();
        onSuccess(data);
      } catch (error) {
        console.error('Error:', error);
      }
    },
    onError: () => {
      // Handle login errors here
      console.error('Google login failed');
    },
    flow: 'auth-code',
  });

  return <button onClick={() => googleLogin()}>Sign in with Google</button>;
}

export default SignIn;
