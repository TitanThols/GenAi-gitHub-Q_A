import React, { useEffect, useState } from 'react';
import type { Source } from '../store/querySlice';
import api from '../api/axios';

interface SourcePanelProps {
    source: Source | null;
    isOpen: boolean;
    repoId: string;
    repositoryUrl: string;
    branch: string;
    onClose: () => void;
}

const SourcePanel: React.FC<SourcePanelProps> = ({
    source,
    isOpen,
    repoId,
    repositoryUrl,
    branch,
    onClose,
}) => {
    const [loadedSource, setLoadedSource] = useState<{
        key: string;
        content: string | null;
        error: string | null;
    } | null>(null);
    const filePath = source?.filePath;
    const startLine = source?.startLine;
    const sourceKey = `${repoId}:${filePath}:${startLine}`;

    useEffect(() => {
        if (!isOpen || !filePath || startLine === undefined) return;

        const controller = new AbortController();
        api.get(`/repos/${repoId}/source`, {
            params: { path: filePath, line: startLine },
            signal: controller.signal,
        })
            .then((response) => {
                if (response.data?.content) {
                    setLoadedSource({
                        key: sourceKey,
                        content: response.data.content,
                        error: null,
                    });
                } else {
                    setLoadedSource({
                        key: sourceKey,
                        content: null,
                        error: 'No indexed code chunk covers this citation.',
                    });
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setLoadedSource({
                        key: sourceKey,
                        content: null,
                        error: 'Unable to load this indexed source.',
                    });
                }
            });

        return () => controller.abort();
    }, [filePath, isOpen, repoId, sourceKey, startLine]);

    if (!isOpen || !source) return null;

    const currentSource =
        loadedSource?.key === sourceKey ? loadedSource : null;
    const isLoading = currentSource === null;
    const sourceCode = currentSource?.content ?? null;
    const error = currentSource?.error ?? null;
    const githubUrl = `${repositoryUrl.replace(/\.git$/, '')}/blob/${branch
        .split('/')
        .map(encodeURIComponent)
        .join('/')}/${source.filePath
            .split('/')
            .map(encodeURIComponent)
            .join('/')}#L${source.startLine}`;

    return (
        <aside className="fixed inset-y-0 right-0 w-full sm:w-[480px] max-w-full bg-[#111111] border-l border-white/10 shadow-2xl z-50 flex flex-col animate-slideIn">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#141414]">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-emerald-400">&lt;/&gt;</span>
                    <div className="min-w-0">
                        <h4 className="text-xs font-mono font-semibold text-white truncate max-w-[min(70vw,320px)]">
                            {source.filePath}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                            Lines {source.startLine} - {source.endLine} / {source.name || 'chunk'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    aria-label="Close code panel"
                >
                    ✕
                </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto font-mono text-xs bg-[#0c0c0c] text-slate-300 leading-relaxed">
                <div className="bg-[#141414] border border-white/5 rounded-lg p-4 overflow-x-auto">
                    <p className="text-[11px] text-slate-500 mb-2 font-mono">
                        {source.filePath}
                    </p>
                    {isLoading ? (
                        <p className="text-slate-400">Loading indexed source…</p>
                    ) : error ? (
                        <p className="text-amber-300">{error}</p>
                    ) : (
                        <pre className="text-emerald-300 whitespace-pre-wrap break-words">
                            {sourceCode}
                        </pre>
                    )}
                </div>

                <div className="mt-6 text-slate-500 text-[11px]">
                    <a
                        href={githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 underline underline-offset-4"
                    >
                        Open source on GitHub at line {source.startLine}
                        <span aria-hidden="true">↗</span>
                    </a>
                </div>
            </div>
        </aside>
    );
};

export default SourcePanel;
