import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import type { Repo } from '../store/repoSlice';
import { setCurrentRepo } from '../store/repoSlice';
import type { AppDispatch } from '../store';

interface RepoCardProps {
    repo: Repo;
    onDelete?: (id: string) => void;
}

const formatCount = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
};

const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'just now';
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

const RepoCard: React.FC<RepoCardProps> = ({ repo, onDelete }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();

    const [owner, repoName] = repo.name.includes('/')
        ? repo.name.split('/')
        : ['', repo.name];

    const isIndexed = repo.status === 'indexed';
    const isFailed = repo.status === 'failed';
    const isIndexing = !isIndexed && !isFailed;

    const handleOpenChat = () => {
        dispatch(setCurrentRepo(repo));
        navigate(`/chat/${repo.id}`);
    };

    return (
        <div className="bg-[#111111] border border-white/10 rounded-xl p-5 sm:p-6 flex flex-col justify-between hover:border-white/20 transition-all shadow-lg min-h-[260px]">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>

                    {isIndexed && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            INDEXED
                        </span>
                    )}
                    {isIndexing && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            INDEXING
                        </span>
                    )}
                    {isFailed && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            INDEX FAILED
                        </span>
                    )}
                </div>

                <div className="mb-4">
                    {owner && (
                        <p className="text-xs font-mono text-slate-400 mb-0.5 tracking-wider">
                            {owner} /
                        </p>
                    )}
                    <h3 className="text-xl font-bold text-white tracking-tight">
                        {repoName}
                    </h3>
                </div>

                {isIndexed && (
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3">
                            <p className="text-lg font-bold text-white">{repo.totalFiles || 0}</p>
                            <p className="text-xs text-slate-500">Files</p>
                        </div>
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3">
                            <p className="text-lg font-bold text-white">{formatCount(repo.totalChunks || 0)}</p>
                            <p className="text-xs text-slate-500">Chunks</p>
                        </div>
                    </div>
                )}

                {isIndexing && (
                    <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-3 mb-6">
                        <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                            <span className="capitalize">{repo.status}...</span>
                            <span className="text-emerald-400 font-mono">In progress</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-400 h-1.5 rounded-full w-2/3 animate-pulse" />
                        </div>
                    </div>
                )}

                {isFailed && (
                    <div className="bg-rose-950/20 border border-rose-900/30 rounded-lg p-3 mb-6 text-xs text-rose-300">
                        {repo.errorMessage || 'Failed to index this repository.'}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                <span className="text-xs text-slate-500">
                    {timeAgo(repo.createdAt)}
                </span>

                <div className="flex items-center gap-2">
                    {onDelete && (
                        <button
                            onClick={() => onDelete(repo.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded"
                            title="Delete repository"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}

                    {isIndexed && (
                        <button
                            onClick={handleOpenChat}
                            className="bg-[#00df81] hover:bg-[#00c572] text-black font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                            <span>Open chat</span>
                            <span>→</span>
                        </button>
                    )}

                    {isIndexing && (
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <svg className="animate-spin w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Processing
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RepoCard;
