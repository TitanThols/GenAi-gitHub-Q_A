import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { setRepos } from '../store/repoSlice';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import RepoForm from '../components/RepoForm';
import RepoCard from '../components/RepoCard';

const DashboardPage: React.FC = () => {
    const { repos } = useSelector((state: RootState) => state.repo);
    const dispatch = useDispatch<AppDispatch>();
    const [loading, setLoading] = useState(true);

    const fetchRepos = async () => {
        try {
            const res = await api.get('/repos');
            dispatch(setRepos(res.data));
        } catch (err) {
            console.error('Failed to load repositories:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRepos();
    }, []);

    useEffect(() => {
        const hasActiveJobs = repos.some(
            (r) => !['indexed', 'failed'].includes(r.status)
        );

        if (!hasActiveJobs) return;

        const interval = setInterval(() => {
            fetchRepos();
        }, 3000);

        return () => clearInterval(interval);
    }, [repos]);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this repository?')) return;
        try {
            await api.delete(`/repos/${id}`);
            dispatch(setRepos(repos.filter((r) => r.id !== id)));
        } catch (err) {
            console.error('Failed to delete repository:', err);
        }
    };

    const indexedCount = repos.filter((r) => r.status === 'indexed').length;

    return (
        <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
            <Navbar />

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold tracking-widest text-emerald-400 uppercase flex items-center gap-2 mb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Repository Workspace
                        </p>
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                            Your repositories
                        </h1>
                        <p className="text-sm text-slate-400 mt-2 max-w-xl">
                            Connect a GitHub repository, index its code, and start asking questions with file-level sources.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto bg-[#141414] border border-white/10 px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>
                            <strong className="text-white font-bold">{indexedCount}</strong> {indexedCount === 1 ? 'repo' : 'repos'} indexed
                        </span>
                    </div>
                </div>

                <RepoForm />

                <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <h2 className="text-sm font-semibold tracking-wide text-white">
                            Connected repositories
                        </h2>
                        <span className="text-xs font-mono text-slate-500">
                            {String(repos.length).padStart(2, '0')} total
                        </span>
                    </div>

                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
                            <svg className="animate-spin w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <p className="text-xs">Loading repositories...</p>
                        </div>
                    ) : repos.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-white/10 rounded-xl bg-[#111111]/40">
                            <p className="text-slate-400 text-sm">No repositories connected yet.</p>
                            <p className="text-slate-600 text-xs mt-1">Paste a GitHub link above to index your first codebase.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {repos.map((repo) => (
                                <RepoCard
                                    key={repo.id}
                                    repo={repo}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default DashboardPage;
