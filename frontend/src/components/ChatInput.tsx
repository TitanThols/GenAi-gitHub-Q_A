import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
    onSendMessage: (question: string) => void;
    isLoading: boolean;
    placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
    onSendMessage,
    isLoading,
    placeholder = "Ask anything about this codebase..."
}) => {
    const [question, setQuestion] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    }, [question]);

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = question.trim();
        if (!trimmed || isLoading) return;

        onSendMessage(trimmed);
        setQuestion('');

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="w-full">
            <form
                onSubmit={handleSubmit}
                className="bg-[#111111] border border-white/10 rounded-xl p-4 shadow-2xl focus-within:border-white/20 transition-colors"
            >
                <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={isLoading}
                    rows={2}
                    className="w-full bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none resize-none leading-relaxed min-h-[48px]"
                />

                <div className="h-[1px] bg-white/5 my-3" />

                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                        ↵ Enter to ask <span className="mx-1">•</span> Shift + Enter for new line
                    </span>

                    <button
                        type="submit"
                        disabled={!question.trim() || isLoading}
                        className="bg-[#00df81] hover:bg-[#00c572] disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:shadow-emerald-500/20"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin w-4 h-4 text-black" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <span>Thinking...</span>
                            </>
                        ) : (
                            <>
                                <span>Ask AI</span>
                                <span className="font-bold">↑</span>
                            </>
                        )}
                    </button>
                </div>
            </form>

            <p className="text-center text-[10px] uppercase tracking-widest text-slate-600 mt-3 font-mono">
                Answers are grounded directly in your indexed codebase
            </p>
        </div>
    );
};

export default ChatInput;
