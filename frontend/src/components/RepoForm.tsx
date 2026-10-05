import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import api from '../api/axios';
import { addRepo } from '../store/repoSlice';
import type { AppDispatch } from '../store';

const RepoForm: React.FC = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dispatch = useDispatch<AppDispatch>();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmed = url.trim();
        if (!trimmed) {
            setError('Please enter a GitHub repository URL.');
            return;
        }

        let formattedUrl = trimmed;
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = `https://${formattedUrl}`;
        }

        if (!formattedUrl.startsWith('https://github.com/')) {
            setError('Enter a valid GitHub repository, like github.com/owner/repo.');
            return;
        }

        setLoading(true);

        try {
            const res = await api.post('/repos', { url: formattedUrl });
            dispatch(addRepo(res.data));
            setUrl('');
        } catch (err: any) {
            const message = err.response?.data?.message || 'Failed to connect repository. Please try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full space-y-3">
            <div className="bg-[#111111] border border-white/10 rounded-xl p-5 sm:p-6 shadow-xl">
                <h3 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-3">
                    Add a GitHub repository
                </h3>

                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="github.com/owner/repository"
                            className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-[#00df81] hover:bg-[#00c572] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-5 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-emerald-500/20 whitespace-nowrap"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin w-4 h-4 text-black" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                                <span>Adding...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-base leading-none font-bold">+</span>
                                <span>Add repository</span>
                            </>
                        )}
                    </button>
                </form>

                <p className="text-xs text-slate-500 mt-3">
                    Public repositories are ready immediately. Private repositories require GitHub access.
                </p>
            </div>

            {error && (
                <div className="bg-[#161214] border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-lg flex items-center justify-between animate-fadeIn">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{error}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setError(null)}
                        className="text-slate-400 hover:text-white transition-colors ml-4 text-sm"
                        aria-label="Dismiss error"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
};

export default RepoForm;
