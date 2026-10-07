import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { AppDispatch, RootState } from './store';
import api from './api/axios';
import { logout, setCredentials, setLoading } from './store/authSlice';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import RepoStatusPage from './pages/RepoStatusPage';
import ProtectedRoute from './routes/ProtectedRoute';

let restoreSessionRequest: Promise<void> | null = null;

function RestoreSession() {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      dispatch(setLoading(false));
      return;
    }

    restoreSessionRequest ??= api
      .post('/auth/refresh', {})
      .then(({ data }) => {
        dispatch(setCredentials(data));
      })
      .catch(() => {
        dispatch(logout());
      })
      .finally(() => {
        dispatch(setLoading(false));
        restoreSessionRequest = null;
      });
  }, [dispatch, userId]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <RestoreSession />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/repos/:repoId" element={<RepoStatusPage />} />
          <Route path="/chat/:repoId" element={<ChatPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;