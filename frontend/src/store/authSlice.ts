import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface User {
    id: string;
    email: string;
}

export interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

const storedToken = localStorage.getItem('accessToken');
const storedRefreshToken = localStorage.getItem('refreshToken');
const storedUser = localStorage.getItem('user');

let initialUser: User | null = null;
try {
    initialUser = storedUser ? JSON.parse(storedUser) : null;
} catch {
    initialUser = null;
}

const initialState: AuthState = {
    user: initialUser,
    accessToken: storedToken,
    refreshToken: storedRefreshToken,
    isAuthenticated: Boolean(storedToken),
    isLoading: false,
    error: null,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setCredentials: (
            state,
            action: PayloadAction<{
                user: User;
                accessToken: string;
                refreshToken?: string;
            }>
        ) => {
            const { user, accessToken, refreshToken } = action.payload;
            state.user = user;
            state.accessToken = accessToken;
            if (refreshToken) {
                state.refreshToken = refreshToken;
                localStorage.setItem('refreshToken', refreshToken);
            }
            state.isAuthenticated = true;
            state.error = null;

            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('user', JSON.stringify(user));
        },
        logout: (state) => {
            state.user = null;
            state.accessToken = null;
            state.refreshToken = null;
            state.isAuthenticated = false;
            state.error = null;

            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.isLoading = false;
        },
    },
});

export const { setCredentials, logout, setLoading, setError } = authSlice.actions;

export default authSlice.reducer;