import React, { useState } from 'react';
import type { AgentStep } from '../store/querySlice';

interface AgentStepsProps {
    steps: AgentStep[];
    totalHops?: number;
}

const AgentSteps: React.FC<AgentStepsProps> = ({ steps, totalHops }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (!steps || steps.length === 0) return null;

    const hopsCount = totalHops || steps.length;

    const formatToolCall = (step: AgentStep) => {
        const firstArg = Object.values(step.toolArgs || {})[0];
        const argStr = typeof firstArg === 'string' ? `"${firstArg}"` : JSON.stringify(firstArg || '');
        return `${step.toolName}(${argStr})`;
    };

    return (
        <div className="border border-white/10 bg-[#121212] rounded-xl overflow-hidden mb-5 max-w-2xl">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/5 transition-colors cursor-pointer"
            >
                <svg
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>

                <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-white tracking-wide">
                        Reasoning: {hopsCount} {hopsCount === 1 ? 'hop' : 'hops'}
                    </span>
                    <span className="text-slate-500">
                        Inspected symbols and {steps.length} {steps.length === 1 ? 'step' : 'steps'}
                    </span>
                </div>
            </button>

            {isOpen && (
                <div className="px-4 pb-3.5 pt-1 space-y-2 font-mono text-xs border-t border-white/5">
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-slate-300">
                            <span className="text-emerald-400 font-semibold select-none">
                                {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-slate-300 break-all">
                                {formatToolCall(step)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AgentSteps;
