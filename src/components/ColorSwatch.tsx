import { useState } from "react";
import { rgbToHex } from "../utils";
import type { Color } from "../types";

export const ColorSwatch = ({ color, isHighlighted }: { color: Color, isHighlighted: boolean }) => {
    const [copied, setCopied] = useState(false);
    const hex = rgbToHex(color.r, color.g, color.b);
    return (
        <div
            onClick={() => { navigator.clipboard.writeText(hex); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className={`group relative flex flex-col items-center cursor-pointer transform transition-all duration-200 ${isHighlighted ? 'scale-110' : 'hover:scale-105'}`}
        >
            <div
                className={`w-16 h-16 shadow-md transition-colors ${isHighlighted ? 'border-4 border-blue-500 shadow-blue-900/50' : 'border-2 border-slate-700 group-hover:border-white'}`}
                style={{ backgroundColor: hex }}
            />
            <span className={`mt-2 text-xs font-mono select-text ${isHighlighted ? 'text-blue-400 font-bold' : 'text-slate-400 group-hover:text-white'}`}>
                {copied ? 'Copied!' : hex}
            </span>
        </div>
    );
};
