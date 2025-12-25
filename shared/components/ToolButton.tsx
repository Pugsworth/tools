import React from 'react';

export const ToolButton = ({ active, icon: Icon, onClick, label, shortcut }: { active: boolean, icon: any, onClick: () => void, label: string, shortcut: string }) => (
    <button
        onClick={onClick}
        className={`p-3 rounded-xl flex items-center justify-center transition-all duration-200 group relative cursor-pointer ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
        title={`${label} (${shortcut})`}
    >
        <Icon size={20} />
        <span className="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-xs text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700 flex flex-col items-start">
            <span className="font-semibold">{label}</span>
            <span className="text-[10px] text-slate-400">Shortcut: {shortcut}</span>
        </span>
    </button>
);
