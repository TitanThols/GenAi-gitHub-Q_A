import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { logout } from "./authSlice";

export interface AgentStep {
    hop: number;
    toolName: string;
    toolArgs: Record<string, any>;
    toolResult: string;
}

export interface Source {
    filePath: string;
    startLine: number;
    endLine: number;
    name: string;
    score?: number;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
    steps?: AgentStep[];
    sources?: Source[];
    totalHops?: number;
}

export interface QueryState {
    messages: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    selectedSources: Source[];
    isSourceDrawerOpen: boolean;
}

const initialState: QueryState = {
    messages: [],
    isLoading: false,
    error: null,
    selectedSources: [],
    isSourceDrawerOpen: false,
};

const querySlice = createSlice({
    name: "query",
    initialState,
    reducers: {
        addMessage: (state, action: PayloadAction<ChatMessage>) => {
            state.messages.push(action.payload);
        },
        clearMessages: (state) => {
            state.messages = [];
            state.error = null;
            state.selectedSources = [];
            state.isSourceDrawerOpen = false;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.isLoading = false;
        },
        openSourceDrawer: (state, action: PayloadAction<Source[]>) => {
            state.selectedSources = action.payload;
            state.isSourceDrawerOpen = true;
        },
        closeSourceDrawer: (state) => {
            state.isSourceDrawerOpen = false;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(logout, () => initialState);
    },
});

export const {
    addMessage,
    clearMessages,
    setLoading,
    setError,
    openSourceDrawer,
    closeSourceDrawer,
} = querySlice.actions;

export default querySlice.reducer;
