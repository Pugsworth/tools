import React from 'react';
import { X, Copy } from 'lucide-react';

export default function VPInfo({
    showVPInfo,
    setShowVPInfo,
    vanishingPoints,
    guideLines,
    copyVPs
}) {
    if (!showVPInfo) return null;

    return (
        <div className="absolute top-4 left-64 w-72 bg-gray-800/95 backdrop-blur border border-gray-700 rounded-lg shadow-2xl p-4 z-30 text-xs font-mono overflow-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
                <h3 className="font-bold text-gray-300">Vanishing Point Data</h3>
                <button onClick={() => setShowVPInfo(false)} className="text-gray-500 hover:text-white"><X size={12} /></button>
            </div>
            <div className="space-y-3">
                <div>
                    <div className="text-red-400 font-bold mb-1">
                        VP X: {guideLines.filter(l => l.axis === 'x').length < 2 ? 'Need 2 lines' : (vanishingPoints.x ? `(${Math.round(vanishingPoints.x.x)}, ${Math.round(vanishingPoints.x.y)})` : 'Parallel (Infinity)')}
                    </div>
                    <div className="pl-2 border-l border-red-900/50 space-y-1">
                        {guideLines.filter(l => l.axis === 'x').map((l, i) => (
                            <div key={l.id} className="text-gray-500">L{i + 1}: ({Math.round(l.p1.x)},{Math.round(l.p1.y)}) {"->"} ({Math.round(l.p2.x)},{Math.round(l.p2.y)})</div>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="text-green-400 font-bold mb-1">
                        VP Y: {guideLines.filter(l => l.axis === 'y').length < 2 ? 'Need 2 lines' : (vanishingPoints.y ? `(${Math.round(vanishingPoints.y.x)}, ${Math.round(vanishingPoints.y.y)})` : 'Parallel (Infinity)')}
                    </div>
                    <div className="pl-2 border-l border-green-900/50 space-y-1">
                        {guideLines.filter(l => l.axis === 'y').map((l, i) => (
                            <div key={l.id} className="text-gray-500">L{i + 1}: ({Math.round(l.p1.x)},{Math.round(l.p1.y)}) {"->"} ({Math.round(l.p2.x)},{Math.round(l.p2.y)})</div>
                        ))}
                    </div>
                </div>
                <button onClick={copyVPs} className="w-full py-1 mt-2 bg-blue-900/50 rounded hover:bg-blue-800/50 text-blue-300 border border-blue-800 flex items-center justify-center gap-2">
                    <Copy size={10} /> Copy Data
                </button>
            </div>
        </div>
    );
}
