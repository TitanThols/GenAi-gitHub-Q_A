import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../store/authSlice";
import queryReducer from "../store/querySlice";
import repoReducer from "../store/repoSlice";

const store = configureStore({
    reducer: {
        auth: authReducer,
        query: queryReducer,
        repo: repoReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;