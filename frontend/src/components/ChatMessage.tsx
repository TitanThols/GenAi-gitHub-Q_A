import React from 'react';
import type { ChatMessage as ChatMessageType, Source } from '../store/querySlice';
import AgentSteps from './AgentSteps';

interface ChatMessageProps {
    message: ChatMessageType;
    onSelectSource?: (source: Source) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSelectSource }) => {
    const isUser = message.role === 'user';

    const renderFormattedContent = (content: string) => {
        const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

        return parts.map((part, index) => {
            if (part.startsWith('`') && part.endsWith('`')) {
                const code = part.slice(1, -1);
                return (
                    <code
                        key={index}
                        className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded font-mono text-xs font-semibold mx-0.5"
                    >
                        {code}
                    </code>
                );
            }
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={index} className="font-bold text-white">
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };

    if (isUser) {
        return (
            <div className="w-full pb-6 mb-6 border-b border-white/5">
                <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                    <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] text-slate-300">
                        👤
                    </span>
                    <span>You</span>
                </div>
                <p className="text-white text-base leading-relaxed pl-7">
                    {message.content}
                </p>
            </div>
        );
    }

    return (
        <div className="w-full pb-8 mb-6">
            <div className="flex items-center gap-2 mb-3 text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
                <span className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">
                    ✦
                </span>
                <span>RepoQuery AI</span>
            </div>

            <div className="pl-7 space-y-4">
                {message.steps && message.steps.length > 0 && (
                    <AgentSteps steps={message.steps} totalHops={message.totalHops} />
                )}

                <div className="text-slate-200 text-sm sm:text-base leading-relaxed space-y-3">
                    {message.content.split('\n\n').map((paragraph, idx) => (
                        <p key={idx}>{renderFormattedContent(paragraph)}</p>
                    ))}
                </div>

                {message.sources && message.sources.length > 0 && (
                    <div className="pt-4">
                        <h5 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2.5">
                            {message.sources.length} Matching {message.sources.length === 1 ? 'Source' : 'Sources'}
                        </h5>

                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, index) => {
                                const fileName = source.filePath.split('/').pop() || source.filePath;
                                const label = `${fileName}${source.startLine ? `:${source.startLine}-${source.endLine}` : ''}`;

                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => onSelectSource?.(source)}
                                        className="bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                        title={`View ${source.filePath}`}
                                    >
                                        <span className="text-emerald-400 font-semibold">&lt;&gt;</span>
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;
