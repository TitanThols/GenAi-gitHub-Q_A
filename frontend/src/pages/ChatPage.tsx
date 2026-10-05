import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { addMessage, clearMessages, setLoading } from '../store/querySlice';
import { setCurrentRepo } from '../store/repoSlice';
import type { Source } from '../store/querySlice';
import api from '../api/axios';
import ChatInput from '../components/ChatInput';
import ChatMessage from '../components/ChatMessage';
import SourcePanel from '../components/SourcePanel';

const ChatPage: React.FC = () => {
    const { repoId } = useParams<{ repoId: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();

    const { currentRepo, repos } = useSelector((state: RootState) => state.repo);
    const { messages, isLoading } = useSelector((state: RootState) => state.query);

    const [selectedSource, setSelectedSource] = useState<Source | null>(null);
    const [isSourceOpen, setIsSourceOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        if (!currentRepo && repoId) {
            const found = repos.find((r) => r.id === repoId);
            if (found) {
                dispatch(setCurrentRepo(found));
            } else {
                api.get(`/repos/${repoId}`)
                    .then((res) => dispatch(setCurrentRepo(res.data)))
                    .catch(() => navigate('/dashboard'));
            }
        }
    }, [repoId, currentRepo, repos, dispatch, navigate]);

    const handleSendMessage = async (question: string) => {
        if (!repoId) return;

        const userMsg = {
            id: `user-${Date.now()}`,
            role: 'user' as const,
            content: question,
            createdAt: new Date().toISOString(),
        };
        dispatch(addMessage(userMsg));
        dispatch(setLoading(true));

        try {
            const res = await api.post('/query', {
                repoId,
                question,
            });

            const aiMsg = {
                id: `ai-${Date.now()}`,
                role: 'assistant' as const,
                content: res.data.answer,
                createdAt: new Date().toISOString(),
                steps: res.data.steps,
                sources: res.data.sources,
                totalHops: res.data.totalHops,
            };
            dispatch(addMessage(aiMsg));
        } catch (err: any) {
            const errorMsg = {
                id: `err-${Date.now()}`,
                role: 'assistant' as const,
                content: err.response?.data?.message || 'Sorry, I encountered an error while analyzing the repository. Please try again.',
                createdAt: new Date().toISOString(),
            };
            dispatch(addMessage(errorMsg));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleSelectSource = (source: Source) => {
        setSelectedSource(source);
        setIsSourceOpen(true);
    };

    const [owner, repoName] = (currentRepo?.name || '').includes('/')
        ? (currentRepo?.name || '').split('/')
        : ['', currentRepo?.name || 'Repository'];

    return (
        <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
            <header className="h-14 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                    <span>←</span>
                    <span className="hidden sm:inline">Back to repositories</span>
                </button>

                <div className="flex items-center gap-2 text-sm">
                    {owner && <span className="text-slate-500 font-mono">{owner} /</span>}
                    <span className="font-bold text-white">{repoName}</span>
                    <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-slate-400">
                        {currentRepo?.defaultBranch || 'main'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        INDEXED
                    </span>
                </div>

                <button
                    onClick={() => dispatch(clearMessages())}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Clear conversation"
                >
                    <span>Clear chat</span>
                    <span>↺</span>
                </button>
            </header>

            <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-8 pb-32">
                {messages.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 mx-auto text-xl">
                            ✦
                        </div>
                        <h2 className="text-2xl font-bold text-white">
                            What would you like to know about {repoName}?
                        </h2>
                        <p className="text-sm text-slate-400 max-w-md mx-auto">
                            Ask questions about architecture, API endpoints, logic flows, or specific functions.
                        </p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <ChatMessage
                            key={message.id}
                            message={message}
                            onSelectSource={handleSelectSource}
                        />
                    ))
                )}

                <div ref={messagesEndRef} />
            </main>

            <footer className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d] to-transparent pt-6 pb-4 px-4">
                <div className="max-w-4xl mx-auto w-full">
                    <ChatInput
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                    />
                </div>
            </footer>

            <SourcePanel
                source={selectedSource}
                isOpen={isSourceOpen}
                onClose={() => setIsSourceOpen(false)}
            />
        </div>
    );
};

export default ChatPage;
