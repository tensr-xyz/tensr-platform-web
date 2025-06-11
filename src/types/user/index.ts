export interface User {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionEndsAt?: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  currentVersion?: string;
  preferences?: {
    theme?: 'LIGHT' | 'DARK';
    notifications?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  sub?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: string | null;
}
