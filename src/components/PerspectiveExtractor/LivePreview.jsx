import React from 'react';
import { MonitorPlay, Maximize, Download } from 'lucide-react';

export default function LivePreview({
    isVertical,
    verticalPreviewWidth,
    previewPanelHeight,
    selectedRegion,
    selectedRegionId,
    setRegions,
    previewContainerRef,
    handlePreviewWheel,
    handlePreviewMouseDown,
    handlePreviewMouseMove,
    handlePreviewMouseUp,
    livePreview,
    previewTransform,
    isPreviewPanning,
    setPreviewTransform,
    snapshotCurrent,
    setResizingState
}) {
    return (
        <div
            className="bg-gray-900 border-gray-700 flex flex-col shrink-0 overflow-hidden relative"
            style={isVertical ? { width: verticalPreviewWidth, height: '100%', borderRight: '1px solid #374151' } : { height: previewPanelHeight }}
        >
            <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800 shrink-0">
                <h2 className="text-xs uppercase tracking-wider text-gray-400 font-bold flex items-center">
                    <MonitorPlay size={14} className="mr-2" /> Live Preview
                </h2>
            </div>

            {/* Output Settings */}
            {selectedRegion && (
                <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 text-xs space-y-3 shrink-0">
                    <div className="space-y-1">
                        <div className="flex justify-between text-gray-400">
                            <span>Aspect Correction</span>
                            <span className="text-gray-500">
                                {selectedRegion.scaleX > 1 ? `+${((selectedRegion.scaleX - 1) * 100).toFixed(0)}% Width` : (selectedRegion.scaleY > 1 ? `+${((selectedRegion.scaleY - 1) * 100).toFixed(0)}% Height` : '1:1')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600">Width</span>
                            <input
                                type="range" min="-100" max="100" step="1"
                                value={selectedRegion.scaleX > 1 ? -1 * (selectedRegion.scaleX - 1) * 100 : (selectedRegion.scaleY - 1) * 100}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    let sx = 1, sy = 1;
                                    if (val < 0) sx = 1 + (Math.abs(val) / 100);
                                    if (val > 0) sy = 1 + (val / 100);
                                    setRegions(prev => prev.map(r => r.id === selectedRegionId ? { ...r, scaleX: sx, scaleY: sy } : r));
                                }}
                                className="w-full accent-blue-500"
                            />
                            <span className="text-[10px] text-gray-600">Height</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Container */}
            <div
                ref={previewContainerRef}
                className="flex-1 relative bg-black/40 overflow-hidden group cursor-move"
                onWheel={handlePreviewWheel}
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={handlePreviewMouseUp}
                onMouseLeave={handlePreviewMouseUp}
            >
                {livePreview ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <img
                            src={livePreview.src}
                            alt="Live"
                            style={{
                                transform: `translate(${previewTransform.x}px, ${previewTransform.y}px) scale(${previewTransform.scale})`,
                                transition: isPreviewPanning ? 'none' : 'transform 0.1s'
                            }}
                            draggable={false}
                            className="max-w-none shadow-lg border border-gray-800 select-none"
                        />
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs text-center px-4 pointer-events-none">Select a region</div>
                )}

                {livePreview && (
                    <>
                        <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-[10px] text-gray-300 pointer-events-none flex flex-col">
                            <span>Zoom: {Math.round(previewTransform.scale * 100)}%</span>
                            <span>{livePreview.width} x {livePreview.height}px</span>
                        </div>

                        <button onClick={() => setPreviewTransform({ scale: 1, x: 0, y: 0 })} className="absolute top-2 right-2 bg-gray-700/80 hover:bg-gray-600 text-white p-1.5 rounded shadow opacity-0 group-hover:opacity-100 transition" title="Reset View">
                            <Maximize size={12} />
                        </button>

                        <button onClick={snapshotCurrent} className="absolute bottom-3 right-3 bg-blue-600 hover:bg-blue-500 text-white p-2 rounded shadow opacity-0 group-hover:opacity-100 transition" title="Save Snapshot">
                            <Download size={16} />
                        </button>
                    </>
                )}
            </div>

            {/* Vertical Mode: Width Resizer Handle */}
            {isVertical && (
                <div
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 z-20 transition-colors"
                    onMouseDown={() => setResizingState('preview-vertical')}
                />
            )}
        </div>
    );
}
