import React from 'react';
import {
    X, Sun, Contrast, Activity, ScanLine, Eye
} from 'lucide-react';

export default function ViewSettings({
    showViewSettings,
    setShowViewSettings,
    showGuides,
    setShowGuides,
    showPerspectiveRays,
    setShowPerspectiveRays,
    setGuideLines,
    viewSettings,
    setViewSettings
}) {
    if (!showViewSettings) return null;

    return (
        <div className="absolute top-4 right-4 w-64 bg-gray-800/90 backdrop-blur border border-gray-700 rounded-lg shadow-2xl p-4 z-30 text-xs">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
                <h3 className="font-bold text-gray-300 flex items-center"><Eye size={12} className="mr-2" /> View Settings</h3>
                <button onClick={() => setShowViewSettings(false)} className="text-gray-500 hover:text-white"><X size={12} /></button>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">Guide Lines</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} />
                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-gray-400">Perspective Rays</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={showPerspectiveRays} onChange={e => setShowPerspectiveRays(e.target.checked)} />
                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <button onClick={() => setGuideLines([])} className="w-full py-1 bg-gray-700 rounded hover:bg-red-900/50 text-red-300">Clear Guides</button>
                <div className="h-px bg-gray-700 my-2"></div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <div className="flex items-center text-gray-400 mb-1"><Sun size={10} className="mr-1" /> Brightness</div>
                        <input type="range" min="-100" max="100" value={viewSettings.brightness}
                            onChange={e => setViewSettings({ ...viewSettings, brightness: parseInt(e.target.value) })}
                            className="w-full accent-yellow-500" />
                    </div>
                    <div>
                        <div className="flex items-center text-gray-400 mb-1"><Contrast size={10} className="mr-1" /> Contrast</div>
                        <input type="range" min="-100" max="100" value={viewSettings.contrast}
                            onChange={e => setViewSettings({ ...viewSettings, contrast: parseInt(e.target.value) })}
                            className="w-full accent-gray-400" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <div className="flex items-center text-gray-400 mb-1"><Activity size={10} className="mr-1" /> Sharpness</div>
                        <input type="range" min="0" max="1" step="0.1" value={viewSettings.sharpness}
                            onChange={e => setViewSettings({ ...viewSettings, sharpness: parseFloat(e.target.value) })}
                            className="w-full accent-red-400" />
                    </div>
                    <div className="flex items-end pb-1">
                        <label className="flex items-center cursor-pointer select-none">
                            <input type="checkbox" checked={viewSettings.edgeDetect}
                                onChange={e => setViewSettings({ ...viewSettings, edgeDetect: e.target.checked })}
                                className="mr-2" />
                            <ScanLine size={12} className="mr-1 text-green-400" /> Edge Detect
                        </label>
                    </div>
                </div>

                <button onClick={() => setViewSettings({ brightness: 0, contrast: 0, sharpness: 0, edgeDetect: false })} className="w-full py-1 bg-gray-700 rounded hover:bg-gray-600 text-gray-400">
                    Reset View
                </button>
            </div>
        </div>
    );
}
