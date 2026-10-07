import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';


const ProtectedRoute = () => {
    const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0d0d0d] text-slate-400 flex items-center justify-center">
                Restoring your session…
            </div>
        );
    }
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
