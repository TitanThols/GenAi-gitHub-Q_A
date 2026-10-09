import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import store from "../store";
import { logout, setCredentials } from "../store/authSlice";

interface TokenResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
    };
}

interface RetryConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const api = axios.create({
    baseURL,
    withCredentials: true,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let refreshRequest: Promise<string> | null = null;

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const config = error.config as RetryConfig | undefined;
        const isAuthEndpoint = /\/auth\/(login|register|refresh)$/.test(
            config?.url ?? "",
        );

        if (
            error.response?.status !== 401 ||
            !config ||
            config._retry ||
            isAuthEndpoint
        ) {
            return Promise.reject(error);
        }

        config._retry = true;

        try {
            refreshRequest ??= axios
                .post<TokenResponse>(
                    `${baseURL}/auth/refresh`,
                    {},
                    { withCredentials: true },
                )
                .then(({ data }) => {
                    store.dispatch(setCredentials(data));
                    return data.accessToken;
                })
                .catch((refreshError: unknown) => {
                    store.dispatch(logout());
                    throw refreshError;
                })
                .finally(() => {
                    refreshRequest = null;
                });

            const accessToken = await refreshRequest;
            config.headers.Authorization = `Bearer ${accessToken}`;
            return await api(config);
        } catch (refreshError) {
            return Promise.reject(refreshError);
        }
    },
);

export default api;