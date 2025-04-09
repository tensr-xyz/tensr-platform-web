export interface User {
    userId: string;
    email: string;
    status: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    lastLoginAt?: string;
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
