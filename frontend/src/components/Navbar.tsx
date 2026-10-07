import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import type { RootState, AppDispatch } from '../store';
import { logout } from '../store/authSlice';
import api from '../api/axios';

const Navbar = () => {
    const { user } = useSelector((state: RootState) => state.auth);
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const [logoutError, setLogoutError] = useState<string | null>(null);

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            dispatch(logout());
            navigate('/login');
        } catch {
            setLogoutError('Could not contact the server to end your session. Please try again.');
        }
    };

    return (
        <header className="h-14 bg-[#0d0d0d] border-b border-white/5 flex items-center px-6 sticky top-0 z-50">
            <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
                <div className="flex items-center justify-center w-7 h-7 bg-white rounded text-black">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l3 3-3 3m5 0h3" />
                    </svg>
                </div>
                <span className="text-white font-semibold text-base tracking-tight">repoquery</span>
            </Link>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
                {logoutError && (
                    <span role="alert" className="max-w-56 text-xs text-rose-300">
                        {logoutError}
                    </span>
                )}
                {user && (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-full px-3 py-1.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <span className="text-emerald-400 text-xs font-bold leading-none">
                                {user.email.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <span className="text-sm text-slate-300 max-w-[180px] truncate">
                            {user.email}
                        </span>
                    </div>
                )}

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white border border-white/8 hover:border-white/20 rounded-full px-3 py-1.5 transition-all cursor-pointer"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                </button>
            </div>
        </header>
    );
};

export default Navbar;
