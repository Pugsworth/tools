import React, { useEffect, useRef, useState } from 'react';
import { Upload, Square, MousePointer2, Ruler, GitCommit, Info } from 'lucide-react';
import ViewSettings from './ViewSettings';
import VPInfo from './VPInfo';
import { convolve } from '../../utils/imageProcessingUtils';
import { dist } from '../../utils/mathUtils';

export default function CanvasWorkspace({
    containerRef,
    canvasRef,
    canvasDims,
    image,
    fileInputRef,
    handleMouseDown,
    handleMouseMove,
    handleWheel,
    handleContextMenu,
    showViewSettings,
    setShowViewSettings,
    showGuides,
    setShowGuides,
    showPerspectiveRays,
    setShowPerspectiveRays,
    setGuideLines,
    viewSettings,
    setViewSettings,
    showVPInfo,
    setShowVPInfo,
    vanishingPoints,
    guideLines,
    copyVPs,
    mode,
    currentGuideAxis,
    snapIncrement,
    scale,
    offset,
    regions,
    selectedRegionId,
    hoverInfo,
    activeGuideId,
    tempGuideStart,
    tempPoints,
    mouseRef,
    forceUpdate,
    toImageSpace
}) {
    const [displayImage, setDisplayImage] = useState(null);
    const [isProcessingDisplay, setIsProcessingDisplay] = useState(false);

    // --- Image Processing ---
    useEffect(() => {
        if (!image) return;

        const processImage = async () => {
            setIsProcessingDisplay(true);
            await new Promise(r => setTimeout(r, 10));

            if (!viewSettings.edgeDetect && viewSettings.sharpness === 0) {
                setDisplayImage(image);
                setIsProcessingDisplay(false);
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;

            if (viewSettings.edgeDetect) {
                convolve(data, canvas.width, canvas.height, [-1, -1, -1, -1, 8, -1, -1, -1, -1]);
            }
            else if (viewSettings.sharpness > 0) {
                const s = viewSettings.sharpness;
                const kernel = [
                    0, -s, 0,
                    -s, 1 + 4 * s, -s,
                    0, -s, 0
                ];
                convolve(data, canvas.width, canvas.height, kernel);
            }

            ctx.putImageData(imgData, 0, 0);
            const processed = new Image();
            processed.onload = () => {
                setDisplayImage(processed);
                setIsProcessingDisplay(false);
            };
            processed.src = canvas.toDataURL();
        };

        const timer = setTimeout(processImage, 200);
        return () => clearTimeout(timer);

    }, [image, viewSettings.edgeDetect, viewSettings.sharpness]);

    // --- Main Render Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { brightness, contrast } = viewSettings;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background Grid
        ctx.filter = 'none';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        for (let y = 0; y < canvas.height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        ctx.stroke();

        if (displayImage) {
            ctx.save();
            ctx.translate(offset.x, offset.y);
            ctx.scale(scale, scale);
            ctx.imageSmoothingEnabled = false;

            ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%)`;
            ctx.drawImage(displayImage, 0, 0);
            ctx.filter = 'none';

            const drawGuides = () => {
                if (!showGuides) return;

                const drawGuideLine = (p1, p2, axis, lineId) => {
                    let color = '#ffffff';
                    if (axis === 'x') color = '#ff4444';
                    if (axis === 'y') color = '#44ff44';
                    if (axis === 'auto') {
                        const dx = Math.abs(p1.x - p2.x);
                        const dy = Math.abs(p1.y - p2.y);
                        color = dx > dy ? '#ff4444' : '#44ff44';
                    }

                    const isActive = activeGuideId === lineId;
                    const isHoverLine = hoverInfo?.type === 'guide-edge' && hoverInfo.id === lineId;

                    ctx.strokeStyle = color;
                    ctx.lineWidth = (isActive || isHoverLine) ? 3 / scale : 1.5 / scale;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();

                    ctx.save();
                    ctx.setLineDash([5 / scale, 5 / scale]);
                    ctx.strokeStyle = color;
                    ctx.globalAlpha = isActive ? 0.8 : 0.5;
                    ctx.lineWidth = 1.5 / scale;
                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    if (len > 0) {
                        const extScale = 100000;
                        ctx.beginPath();
                        ctx.moveTo(p1.x - dx * extScale, p1.y - dy * extScale);
                        ctx.lineTo(p2.x + dx * extScale, p2.y + dy * extScale);
                        ctx.stroke();
                    }
                    ctx.restore();

                    if (lineId !== undefined) {
                        [p1, p2].forEach((p, i) => {
                            const isHoverPoint = hoverInfo?.type === 'guide-vertex' && hoverInfo.id === lineId && hoverInfo.point === (i === 0 ? 'p1' : 'p2');
                            ctx.fillStyle = (isHoverPoint || isActive) ? 'white' : color;
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, (isHoverPoint ? 5 : 3) / scale, 0, Math.PI * 2);
                            ctx.fill();
                        });
                    }
                };

                // Existing Guides
                guideLines.forEach(line => {
                    drawGuideLine(line.p1, line.p2, line.axis, line.id);
                });

                // In-progress Guide (Using Ref for smooth render)
                if (tempGuideStart && mode === 'guide') {
                    const m = toImageSpace(mouseRef.current.x, mouseRef.current.y);
                    drawGuideLine(tempGuideStart, m, currentGuideAxis, undefined);
                }

                // Draw VPs
                [vanishingPoints.x, vanishingPoints.y].forEach((vp, i) => {
                    if (vp) {
                        const color = i === 0 ? '#ff4444' : '#44ff44';
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(vp.x, vp.y, 6 / scale, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.font = `bold ${12 / scale}px sans-serif`;
                        ctx.fillStyle = 'white';
                        ctx.fillText(i === 0 ? 'VP X' : 'VP Y', vp.x + 10 / scale, vp.y);
                    }
                });
            };

            const drawRegions = () => {
                regions.forEach(r => {
                    const isSelected = r.id === selectedRegionId;
                    const isHover = hoverInfo?.id === r.id;
                    const isLocked = r.locked;

                    if (isSelected) {
                        ctx.strokeStyle = isLocked ? '#ff4444' : '#00ffcc';
                        ctx.fillStyle = isLocked ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 204, 0.15)';
                        if (isLocked) ctx.setLineDash([5, 5]);
                    } else {
                        ctx.strokeStyle = isHover ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)';
                        ctx.fillStyle = isHover ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0)';
                    }

                    ctx.lineWidth = (isSelected ? 2.5 : 1.5) / scale;

                    ctx.beginPath();
                    r.points.forEach((p, i) => {
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.setLineDash([]);

                    if (isLocked) {
                        const cx = (r.points[0].x + r.points[2].x) / 2;
                        const cy = (r.points[0].y + r.points[2].y) / 2;
                        ctx.fillStyle = '#ff4444';
                        ctx.font = `${16 / scale}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('🔒', cx, cy);
                    }

                    if (!isLocked && hoverInfo?.type === 'edge' && hoverInfo.id === r.id) {
                        const p1 = r.points[hoverInfo.index];
                        const p2 = r.points[(hoverInfo.index + 1) % 4];
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = '#ffff00';
                        ctx.lineWidth = 4 / scale;
                        ctx.stroke();
                    }

                    if (isSelected || isHover) {
                        r.points.forEach((p, i) => {
                            const isHoverVertex = hoverInfo?.type === 'vertex' && hoverInfo.id === r.id && hoverInfo.index === i;
                            ctx.beginPath();
                            const rSize = isHoverVertex ? 6 : 4;
                            ctx.arc(p.x, p.y, rSize / scale, 0, Math.PI * 2);

                            ctx.fillStyle = isLocked
                                ? '#ff4444'
                                : (isHoverVertex ? '#ffff00' : (isSelected ? '#00ffcc' : '#ffffff'));

                            if (isHoverVertex && !isLocked) {
                                ctx.shadowColor = "rgba(0,0,0,0.5)";
                                ctx.shadowBlur = 5;
                            } else {
                                ctx.shadowColor = "transparent";
                            }
                            ctx.fill();

                            if (isSelected && !isLocked) {
                                ctx.fillStyle = isHoverVertex ? 'black' : '#333';
                                ctx.font = `bold ${8 / scale}px sans-serif`;
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(i + 1, p.x, p.y);
                            }
                            ctx.shadowColor = "transparent";
                            ctx.shadowBlur = 0;
                        });
                    }

                    if (showPerspectiveRays && isSelected && !isLocked && vanishingPoints.x && vanishingPoints.y) {
                        ctx.save();
                        ctx.lineWidth = 1 / scale;
                        ctx.globalAlpha = 0.4;
                        r.points.forEach(p => {
                            ctx.strokeStyle = '#ff4444';
                            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(vanishingPoints.x.x, vanishingPoints.x.y); ctx.stroke();
                            ctx.strokeStyle = '#44ff44';
                            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(vanishingPoints.y.x, vanishingPoints.y.y); ctx.stroke();
                        });
                        ctx.restore();
                    }
                });
            }

            // Layering Order
            if (mode === 'guide') {
                drawRegions(); // Regions behind
                drawGuides();  // Guides top
            } else {
                drawGuides();  // Guides behind
                drawRegions(); // Regions top
            }

            if (tempPoints.length > 0 && mode === 'draw') {
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 2 / scale;
                ctx.beginPath();
                tempPoints.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
                tempPoints.forEach(p => {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 3 / scale, 0, Math.PI * 2);
                    ctx.fillStyle = '#ff00ff';
                    ctx.fill();
                });
            }

            ctx.restore();
        }
    }, [displayImage, regions, offset, scale, hoverInfo, selectedRegionId, tempPoints, viewSettings.brightness, viewSettings.contrast, guideLines, showGuides, tempGuideStart, currentGuideAxis, vanishingPoints, activeGuideId, showPerspectiveRays, mode, forceUpdate, toImageSpace, canvasRef]);

    const getVPStatus = () => {
        const vx = vanishingPoints.x;
        const vy = vanishingPoints.y;
        if (!vx && !vy) return { text: "Add Guides", color: "text-gray-500" };
        if (vx && vy) return { text: "Valid VPs", color: "text-green-400" };
        if ((guideLines.filter(l => l.axis === 'x').length >= 2 && !vx) || (guideLines.filter(l => l.axis === 'y').length >= 2 && !vy)) {
            return { text: "Parallel Lines", color: "text-yellow-400" };
        }
        return { text: "Need 2 lines/axis", color: "text-blue-400" };
    };
    const vpStatus = getVPStatus();

    return (
        <div
            ref={containerRef}
            className="flex-1 relative bg-gray-900 cursor-crosshair overflow-hidden"
            onDragOver={(e) => e.preventDefault()}
        >
            {!image && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:text-gray-400 transition" onClick={() => fileInputRef.current.click()}>
                    <Upload size={64} className="mb-4 opacity-50" />
                    <p className="text-lg">Click or Drag image here</p>
                </div>
            )}
            <canvas
                ref={canvasRef}
                width={canvasDims.width}
                height={canvasDims.height}
                className="block touch-none"
                style={{ width: canvasDims.width, height: canvasDims.height }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onWheel={handleWheel}
                onContextMenu={handleContextMenu}
            />

            {/* View Settings Floating Panel */}
            <ViewSettings
                showViewSettings={showViewSettings}
                setShowViewSettings={setShowViewSettings}
                showGuides={showGuides}
                setShowGuides={setShowGuides}
                showPerspectiveRays={showPerspectiveRays}
                setShowPerspectiveRays={setShowPerspectiveRays}
                setGuideLines={setGuideLines}
                viewSettings={viewSettings}
                setViewSettings={setViewSettings}
            />

            {/* VP Info Panel */}
            <VPInfo
                showVPInfo={showVPInfo}
                setShowVPInfo={setShowVPInfo}
                vanishingPoints={vanishingPoints}
                guideLines={guideLines}
                copyVPs={copyVPs}
            />

            {/* Mode Indicator */}
            <div className="absolute bottom-4 left-4 pointer-events-none flex flex-col gap-2 items-start">
                <div className="bg-black/80 backdrop-blur text-white px-3 py-2 rounded-lg text-xs border border-white/10 flex flex-col gap-1 shadow-xl">
                    <div className="flex items-center font-semibold">
                        {mode === 'draw' && <><Square size={12} className="mr-2 text-pink-400" /> Drawing Mode</>}
                        {mode === 'select' && <><MousePointer2 size={12} className="mr-2 text-blue-400" /> Edit Mode</>}
                        {mode === 'guide' && <><Ruler size={12} className="mr-2 text-green-400" /> Guide Mode</>}
                    </div>
                    <div className="text-gray-400">
                        {mode === 'guide'
                            ? <span>Draw 2 lines per axis. Current: <span className={currentGuideAxis === 'x' ? 'text-red-400' : (currentGuideAxis === 'y' ? 'text-green-400' : 'text-white')}>{currentGuideAxis.toUpperCase()}-Axis</span> (Auto)</span>
                            : <span>Snap: {snapIncrement}px | Zoom: {(scale * 100).toFixed(0)}%</span>
                        }
                    </div>
                </div>

                {/* VPs Indicator */}
                <div className="bg-black/80 backdrop-blur text-white px-3 py-2 rounded-lg text-xs border border-white/10 shadow-xl flex gap-3 items-center pointer-events-auto">
                    {vanishingPoints.x || vanishingPoints.y ? (
                        <>
                            <div className="flex items-center gap-1">
                                <GitCommit size={12} className={vanishingPoints.x ? 'text-red-400' : 'text-gray-600'} />
                                <span className={vanishingPoints.x ? 'text-gray-200' : 'text-gray-500'}>VP X</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <GitCommit size={12} className={vanishingPoints.y ? 'text-green-400' : 'text-gray-600'} />
                                <span className={vanishingPoints.y ? 'text-gray-200' : 'text-gray-500'}>VP Y</span>
                            </div>
                        </>
                    ) : null}
                    <span className={`border-l border-gray-600 pl-2 ml-1 ${vpStatus.color}`}>{vpStatus.text}</span>
                    <button onClick={() => setShowVPInfo(!showVPInfo)} className="ml-2 hover:text-blue-400" title="View VP Data"><Info size={12} /></button>
                </div>
            </div>
        </div>
    );
}
