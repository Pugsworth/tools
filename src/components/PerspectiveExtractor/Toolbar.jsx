import React from 'react';
import {
    Upload, MousePointer2, Square, Trash2, Download,
    Layout, Grid, Eye
} from 'lucide-react';

export default function Toolbar({
    isVertical,
    fileInputRef,
    loadImage,
    mode,
    setMode,
    setLayout,
    setSidebarWidth,
    setPreviewPanelHeight,
    image,
    containerRef,
    setOffset,
    scale,
    isSnapMenuOpen,
    setIsSnapMenuOpen,
    snapIncrement,
    setSnapIncrement,
    showViewSettings,
    setShowViewSettings,
    selectedRegionId,
    setRegions,
    snapshotAll,
    regions
}) {
    return (
        <div className={`
        bg-gray-800 border-gray-700 z-20 shadow-lg flex items-center 
        ${isVertical ? 'w-full h-14 border-b px-4 flex-row justify-between' : 'h-full flex-col border-r py-4'}
      `}
            style={!isVertical ? { width: 64 } : {}}
        >

            {/* Upload Group */}
            <div className={`group relative flex items-center ${isVertical ? 'mr-4' : 'flex-col mb-6'}`}>
                <div
                    className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-500 transition shadow-lg shadow-blue-900/50"
                    onClick={() => fileInputRef.current.click()}
                    title="Upload Image"
                >
                    <Upload size={20} />
                </div>
                <input type="file" ref={fileInputRef} onChange={(e) => loadImage(e.target.files[0])} className="hidden" accept="image/*" />
            </div>

            {/* Tools Group */}
            <div className={`flex items-center ${isVertical ? 'space-x-2' : 'flex-col space-y-4'}`}>
                <button onClick={() => setMode('select')} className={`p-2 rounded-lg transition ${mode === 'select' ? 'bg-gray-700 text-blue-400 shadow-inner' : 'hover:bg-gray-700 text-gray-400'}`} title="Select & Edit (S)">
                    <MousePointer2 size={20} />
                </button>
                <button onClick={() => setMode('draw')} className={`p-2 rounded-lg transition ${mode === 'draw' ? 'bg-gray-700 text-blue-400 shadow-inner' : 'hover:bg-gray-700 text-gray-400'}`} title="Draw Region (R)">
                    <Square size={20} />
                </button>
                <button onClick={() => setMode('guide')} className={`p-2 rounded-lg transition ${mode === 'guide' ? 'bg-gray-700 text-blue-400 shadow-inner' : 'hover:bg-gray-700 text-gray-400'}`} title="Perspective Guides (G)">
                    {/* Ruler icon is not imported in the original snippet for Toolbar but used in main file. Assuming Ruler is needed or I can use another icon if Ruler was imported there. 
                        Wait, Ruler WAS imported in the original file. I should import it here. */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ruler"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" /><path d="m14.5 12.5 2-2" /><path d="m11.5 9.5 2-2" /><path d="m8.5 6.5 2-2" /><path d="m17.5 15.5 2-2" /></svg>
                </button>

                {!isVertical && <div className="h-px w-8 bg-gray-700 mx-auto my-2" />}
                {isVertical && <div className="w-px h-8 bg-gray-700 mx-2" />}

                <button
                    onClick={() => {
                        setLayout(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
                        setSidebarWidth(384);
                        setPreviewPanelHeight(300);
                        setTimeout(() => {
                            if (image && containerRef.current) {
                                const c = containerRef.current;
                                setOffset({ x: (c.clientWidth - image.width * scale) / 2, y: (c.clientHeight - image.height * scale) / 2 });
                            }
                        }, 50);
                    }}
                    className="p-2 hover:bg-gray-700 text-gray-400 rounded-lg"
                    title="Toggle Layout"
                >
                    <Layout size={20} />
                </button>

                <div className="relative flex items-center justify-center">
                    <button
                        className={`p-2 rounded-lg transition ${isSnapMenuOpen ? 'bg-gray-700 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
                        onClick={() => setIsSnapMenuOpen(!isSnapMenuOpen)}
                        title="Snap Grid Settings"
                    >
                        <Grid size={20} />
                    </button>
                    {isSnapMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsSnapMenuOpen(false)}></div>
                            <div className={`absolute bg-gray-800 border border-gray-600 p-2 rounded shadow-xl flex flex-col gap-1 min-w-[100px] z-50 ${isVertical ? 'top-12 left-0' : 'left-14 top-0'}`}>
                                <span className="text-xs text-gray-400 mb-1">Snap Size (px)</span>
                                {[0.1, 0.5, 1, 2, 4, 8, 16, 32].map(v => (
                                    <button key={v} onClick={() => { setSnapIncrement(v); setIsSnapMenuOpen(false); }} className={`text-xs text-left px-2 py-1 rounded ${snapIncrement === v ? 'bg-blue-900 text-blue-200' : 'hover:bg-gray-700'}`}>
                                        {v} px
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <button
                    onClick={() => setShowViewSettings(!showViewSettings)}
                    className={`p-2 rounded-lg transition ${showViewSettings ? 'bg-gray-700 text-blue-400' : 'hover:bg-gray-700 text-gray-400'}`}
                    title="View Adjustments"
                >
                    <Eye size={20} />
                </button>

                <button
                    onClick={() => selectedRegionId && setRegions(prev => prev.filter(r => r.id !== selectedRegionId))}
                    className={`p-2 rounded-lg transition ${selectedRegionId ? 'hover:bg-red-900 text-red-400' : 'opacity-30 cursor-default'}`}
                    title="Delete Selected (Del)"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            {isVertical && (
                <div className="ml-auto flex items-center space-x-4 text-xs text-gray-400">
                    <button onClick={snapshotAll} disabled={regions.length === 0} className="ml-4 flex items-center px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white transition">
                        <Download size={16} className="mr-2" /> Extract All
                    </button>
                </div>
            )}
        </div>
    );
}
