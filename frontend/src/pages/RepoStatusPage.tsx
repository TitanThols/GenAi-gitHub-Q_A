import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import { setCurrentRepo } from '../store/repoSlice';
import type { Repo } from '../store/repoSlice';

const stages = [
    { id: 'pending', label: 'Queued' },
    { id: 'cloning', label: 'Clone repository' },
    { id: 'chunking', label: 'Parse and chunk source' },
    { id: 'embedding', label: 'Create and store embeddings' },
    { id: 'indexed', label: 'Ready to chat' },
] as const;

const RepoStatusPage = () => {
    const { repoId } = useParams<{ repoId: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const [repo, setRepo] = useState<Repo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshRepo = useCallback(async () => {
        if (!repoId) return;
        try {
            const response = await api.get<Repo>(`/repos/${repoId}`);
            setRepo(response.data);
            dispatch(setCurrentRepo(response.data));
            setError(null);
        } catch {
            setError('Unable to load this repository status.');
        } finally {
            setLoading(false);
        }
    }, [dispatch, repoId]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void refreshRepo(), 0);
        return () => window.clearTimeout(timeout);
    }, [refreshRepo]);

    useEffect(() => {
        if (!repo || repo.status === 'indexed' || repo.status === 'failed') return;
        const interval = window.setInterval(() => void refreshRepo(), 3000);
        return () => window.clearInterval(interval);
    }, [repo, refreshRepo]);

    const [owner, name] = (repo?.name ?? 'Repository').includes('/')
        ? (repo?.name ?? '').split('/')
        : ['', repo?.name ?? 'Repository'];
    const activeStageIndex = stages.findIndex((stage) => stage.id === repo?.status);

    return (
        <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
            <Navbar />
            <main className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                <Link
                    to="/dashboard"
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                    ← Back to repositories
                </Link>

                <section className="mt-8 rounded-2xl border border-white/10 bg-[#111111] p-5 sm:p-8">
                    <p className="text-xs uppercase tracking-widest text-emerald-400">
                        Indexing status
                    </p>
                    <h1 className="mt-2 text-2xl sm:text-3xl font-bold break-words">
                        {owner && <span className="text-slate-400">{owner} / </span>}
                        {name}
                    </h1>

                    {loading ? (
                        <p className="mt-8 text-sm text-slate-400">Loading status…</p>
                    ) : error ? (
                        <div className="mt-8 rounded-lg border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">
                            {error}
                            <button
                                type="button"
                                onClick={() => void refreshRepo()}
                                className="ml-3 underline underline-offset-4"
                            >
                                Retry
                            </button>
                        </div>
                    ) : repo?.status === 'failed' ? (
                        <div className="mt-8 rounded-lg border border-rose-500/30 bg-rose-950/20 p-4">
                            <p className="font-semibold text-rose-300">Indexing failed</p>
                            <p className="mt-2 break-words text-sm text-rose-200">
                                {repo.errorMessage || 'The repository could not be indexed.'}
                            </p>
                        </div>
                    ) : repo ? (
                        <>
                            <ol className="mt-8 space-y-4">
                                {stages.map((stage, index) => {
                                    const complete = index < activeStageIndex;
                                    const active = index === activeStageIndex;
                                    return (
                                        <li key={stage.id} className="flex items-center gap-3">
                                            <span
                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                                                    complete
                                                        ? 'border-emerald-400 bg-emerald-400 text-black'
                                                        : active
                                                          ? 'border-emerald-400 text-emerald-300'
                                                          : 'border-white/15 text-slate-500'
                                                }`}
                                            >
                                                {complete ? '✓' : index + 1}
                                            </span>
                                            <span
                                                className={`text-sm ${
                                                    active
                                                        ? 'font-semibold text-white'
                                                        : complete
                                                          ? 'text-emerald-300'
                                                          : 'text-slate-500'
                                                }`}
                                            >
                                                {stage.label}
                                                {active && stage.id !== 'indexed' ? ' — in progress' : ''}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ol>

                            {(repo.totalFiles > 0 || repo.totalChunks > 0) && (
                                <div className="mt-8 grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                        <p className="text-2xl font-bold">{repo.totalFiles}</p>
                                        <p className="text-xs text-slate-400">Source files found</p>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                                        <p className="text-2xl font-bold">{repo.totalChunks}</p>
                                        <p className="text-xs text-slate-400">Code chunks prepared</p>
                                    </div>
                                </div>
                            )}

                            {repo.status === 'indexed' && (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/chat/${repo.id}`)}
                                    className="mt-8 rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-300"
                                >
                                    Ask questions about this repository
                                </button>
                            )}
                        </>
                    ) : null}

                    <p className="mt-8 text-xs text-slate-500">
                        This status refreshes automatically while indexing is active.
                    </p>
                </section>
            </main>
        </div>
    );
};

export default RepoStatusPage;
