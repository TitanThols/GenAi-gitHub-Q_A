import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type RepoStatus = 'pending' | 'cloning' | 'chunking' | 'embedding' | 'indexed' | 'failed';

export interface Repo {
    id: string,
    name: string,
    url: string,
    defaultBranch: string,
    status: RepoStatus,
    totalFiles: number,
    totalChunks: number,
    errorMessage?: string | null,
    createdAt: string,
    updatedAt: string
}

export interface RepoState {
    repos: Repo[],
    currentRepo: Repo | null,
    isLoading: boolean,
    error: string | null
}

const initialState: RepoState = {
    repos: [],
    currentRepo: null,
    isLoading: false,
    error: null
}

const repoSlice = createSlice({
    name: "repo",
    initialState,
    reducers: {
        setRepos: (state, action: PayloadAction<Repo[]>) => {
            state.repos = action.payload;
        },
        setCurrentRepo: (state, action: PayloadAction<Repo | null>) => {
            state.currentRepo = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.isLoading = false;
        },
        addRepo: (state, action: PayloadAction<Repo>) => {
            state.repos.push(action.payload);
        },
        updateRepoStatus: (state, action: PayloadAction<{ id: string, status: RepoStatus, totalChunks?: number, errorMessage?: string }>) => {
            const { id, status, totalChunks, errorMessage } = action.payload;
            const repo = state.repos.find((r) => r.id === id);
            if (repo) {
                repo.status = status;
                repo.updatedAt = new Date().toISOString();
                if (totalChunks) {
                    repo.totalChunks = totalChunks;
                }
                if (errorMessage) {
                    repo.errorMessage = errorMessage;
                }
            }
        },
    }
})

export const { setRepos, setCurrentRepo, setLoading, setError, addRepo, updateRepoStatus } = repoSlice.actions;
export default repoSlice.reducer;