import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { setCredentials } from '../store/authSlice';
import type { AppDispatch } from '../store';

const HeroPanel = () => (
    <div className="hidden lg:flex flex-col justify-between bg-[#0d0d0d] p-12 h-full">
        <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 bg-white rounded text-black">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 9l3 3-3 3m5 0h3" />
                </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">repoquery</span>
        </div>

        <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Built for GitHub repositories
            </p>
            <h1 className="text-5xl font-bold leading-tight text-white mb-6">
                Understand code
                <span className="text-slate-500"> without the guesswork.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
                Search and ask questions across your repositories. Every answer links back to the files it came from.
            </p>

            <div className="mt-10 bg-[#161616] border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-[#111]">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    <div className="flex items-center gap-1.5 mx-auto text-xs text-slate-500">
                        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                        acme/api-platform
                    </div>
                    <span className="text-xs text-slate-600">main</span>
                </div>
                <div className="p-5">
                    <div className="flex gap-3 mb-4">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-slate-300 text-xs flex items-center justify-center font-bold">Q</span>
                        <p className="text-sm text-slate-300">Where is rate limiting handled for API requests?</p>
                    </div>
                    <div className="ml-9">
                        <p className="text-xs text-emerald-400 font-medium mb-2">● 3 matching sources</p>
                        <p className="text-xs text-slate-400 leading-relaxed mb-3">
                            Rate limiting is applied in{' '}
                            <code className="bg-slate-700/60 text-emerald-400 px-1 py-0.5 rounded text-xs">middleware/rateLimit.ts</code>
                            {' '}using a Redis-backed sliding window. The default is{' '}
                            <span className="text-sky-400">100 requests</span>
                            {' '}/{' '}
                            <span className="text-sky-400">minute</span>
                            , configured per route.
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {['rateLimit.ts:14-48', 'routes/api.ts:9', 'config.ts:31'].map(f => (
                                <span key={f} className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded">{f}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex gap-8 text-xs text-slate-600">
            {['File-level citations', 'Private repositories supported', 'Read-only access'].map(f => (
                <span key={f} className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                    {f}
                </span>
            ))}
        </div>
    </div>
);

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password });
            const { accessToken, user } = response.data;
            dispatch(setCredentials({ user, accessToken }));
            navigate('/dashboard');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#0d0d0d]">
            <div className="flex-1">
                <HeroPanel />
            </div>

            <div className="w-full lg:w-[480px] flex-shrink-0 flex flex-col justify-center px-10 py-14 bg-[#111111] border-l border-white/5">
                <div className="hidden lg:flex absolute top-5 right-6 items-center gap-1.5 text-xs text-slate-400 bg-[#1a1a1a] border border-white/8 rounded-full px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    All systems operational
                </div>

                <div className="max-w-sm w-full mx-auto">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500 mb-2">Sign in</p>
                    <h2 className="text-3xl font-bold text-white mb-1">Welcome back</h2>
                    <p className="text-sm text-slate-400 mb-8">
                        New to RepoQuery?{' '}
                        <Link to="/register" className="text-sky-400 hover:text-sky-300 transition-colors">
                            Create an account
                        </Link>
                    </p>

                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-lg mb-5 flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex-1 h-px bg-white/8" />
                        <span className="text-xs uppercase tracking-widest text-slate-600">Or use email</span>
                        <div className="flex-1 h-px bg-white/8" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-300 mb-1.5">Work email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@company.dev"
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-sm text-slate-300">Password</label>
                                <button type="button" className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer">
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="Enter your password"
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 pr-11 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer mt-1"
                        >
                            {loading ? (
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            ) : (
                                <>
                                    <span>Sign in</span>
                                    <span>→</span>
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-xs uppercase tracking-widest text-slate-600">
                        Your code is encrypted and never used to train models
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
