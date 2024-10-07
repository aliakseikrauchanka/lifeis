export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  googleUserId: string; // not the best idea to store google user id in our system
}
