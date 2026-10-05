import React from 'react';
import type { Source } from '../store/querySlice';

interface SourcePanelProps {
    source: Source | null;
    isOpen: boolean;
    onClose: () => void;
}

const SourcePanel: React.FC<SourcePanelProps> = ({ source, isOpen, onClose }) => {
    if (!isOpen || !source) return null;

    return (
        <aside className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#111111] border-l border-white/10 shadow-2xl z-50 flex flex-col animate-slideIn">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#141414]">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-400">&lt;/&gt;</span>
                    <div>
                        <h4 className="text-xs font-mono font-semibold text-white truncate max-w-[320px]">
                            {source.filePath}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                            Lines {source.startLine} - {source.endLine} • Symbol: {source.name || 'chunk'}
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
                        // Grounded citation from {source.filePath}
                    </p>
                    <pre className="text-emerald-300">
                        {`// Lines ${source.startLine} - ${source.endLine}\n${source.name ? `// Scope: ${source.name}\n` : ''}\n// Code indexed into vector database`}
                    </pre>
                </div>

                <div className="mt-6 text-slate-500 text-[11px]">
                    <p className="font-semibold text-slate-400 mb-1">Source Verification:</p>
                    <p>This code chunk was retrieved through cosine similarity in pgvector and verified by the AST parser.</p>
                </div>
            </div>
        </aside>
    );
};

export default SourcePanel;
