import React from 'react';
import { ImageIcon, Copy, Download, X } from 'lucide-react';

export default function ExtractedList({
    isVertical,
    extractedImages,
    setExtractedImages,
    copyCoords
}) {
    return (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="p-3 border-b border-gray-700 bg-gray-800 shrink-0 flex justify-between">
                <h2 className="font-semibold text-white flex items-center text-xs"><ImageIcon size={14} className="mr-2 text-blue-400" /> Saved ({extractedImages.length})</h2>
            </div>
            <div className={`flex-1 overflow-auto p-4 gap-4 ${isVertical ? 'flex flex-row' : 'flex flex-col space-y-4'}`}>
                {extractedImages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-4 text-xs w-full"><p>No snapshots.</p></div>
                ) : (
                    extractedImages.map((img, idx) => (
                        <div key={img.id} className={`bg-gray-900 rounded-lg p-2 border border-gray-700 group shrink-0 ${isVertical ? 'w-64' : 'w-full'}`}>
                            <div className="relative aspect-video bg-black/50 rounded overflow-hidden mb-2 flex items-center justify-center">
                                <img src={img.src} alt={`Extracted ${idx}`} className="max-w-full max-h-full object-contain" />
                            </div>
                            <div className="mb-2">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold">Coords</span>
                                    <button onClick={() => copyCoords(img.points)} className="text-blue-400 hover:text-blue-300" title="Copy"><Copy size={10} /></button>
                                </div>
                                <div className="text-[10px] text-gray-400 font-mono bg-black/30 p-1 rounded grid grid-cols-2 gap-x-2">
                                    {img.points.map((p, i) => <span key={i}>P{i + 1}: {Math.round(p.x)}, {Math.round(p.y)}</span>)}
                                </div>
                            </div>
                            <div className="flex justify-between items-center border-t border-gray-800 pt-2">
                                <span className="text-xs text-gray-500">{img.width} x {img.height}</span>
                                <div className="flex space-x-1">
                                    <a href={img.src} download={`extract-${idx + 1}.png`} className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white transition"><Download size={12} /></a>
                                    <button onClick={() => setExtractedImages(prev => prev.filter(item => item.id !== img.id))} className="p-1.5 bg-gray-700 hover:bg-red-900 text-gray-300 hover:text-red-200 rounded transition"><X size={12} /></button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
