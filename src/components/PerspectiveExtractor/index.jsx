import React, { useState, useRef, useEffect, useCallback } from 'react';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import CanvasWorkspace from './CanvasWorkspace';
import {
    dist, add, sub, dot, normalize, scaleVec,
    distToSegment, projectToSegment, getLineIntersection,
    isPointInPolygon, projectPointToLine, areLinesParallel
} from '../../utils/mathUtils';
import { getHomographyMatrix, applyMatrix } from '../../utils/homographyUtils';
import { Download } from 'lucide-react';

export default function PerspectiveExtractor() {
    // --- State ---
    const [image, setImage] = useState(null);
    // displayImage state is now in CanvasWorkspace

    const [regions, setRegions] = useState([]);
    const [selectedRegionId, setSelectedRegionId] = useState(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Mode & Tools
    const [mode, setMode] = useState('select');
    const [tempPoints, setTempPoints] = useState([]);
    const [hoverInfo, setHoverInfo] = useState(null);
    const [cursorPos, setCursorPos] = useState(null);

    const [guideLines, setGuideLines] = useState([]);
    const [activeGuideId, setActiveGuideId] = useState(null);
    const [guideFocusIndex, setGuideFocusIndex] = useState(0);
    const [currentGuideAxis, setCurrentGuideAxis] = useState('auto');
    const [tempGuideStart, setTempGuideStart] = useState(null);
    const [vanishingPoints, setVanishingPoints] = useState({ x: null, y: null });

    const [extractedImages, setExtractedImages] = useState([]);
    const [livePreview, setLivePreview] = useState(null);
    const [previewTransform, setPreviewTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isPreviewPanning, setIsPreviewPanning] = useState(false);
    const [previewPanStart, setPreviewPanStart] = useState({ x: 0, y: 0 });

    const [viewSettings, setViewSettings] = useState({
        brightness: 0,
        contrast: 0,
        sharpness: 0,
        edgeDetect: false
    });

    const [layout, setLayout] = useState('horizontal');
    const [snapIncrement, setSnapIncrement] = useState(1);
    const [isSnapMenuOpen, setIsSnapMenuOpen] = useState(false);
    const [showViewSettings, setShowViewSettings] = useState(false);
    const [showGuides, setShowGuides] = useState(true);
    const [showPerspectiveRays, setShowPerspectiveRays] = useState(false);
    const [showVPInfo, setShowVPInfo] = useState(false);

    const [sidebarWidth, setSidebarWidth] = useState(384);
    const [previewPanelHeight, setPreviewPanelHeight] = useState(300);
    const [bottomPanelHeight, setBottomPanelHeight] = useState(300);
    const [verticalPreviewWidth, setVerticalPreviewWidth] = useState(500);

    const [resizingState, setResizingState] = useState(null);

    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const [isAltPressed, setIsAltPressed] = useState(false);
    const [dragState, setDragState] = useState(null);
    const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const previewContainerRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const [forceUpdate, setForceUpdate] = useState(0);

    // --- Coordinate Mapping ---

    const toImageSpace = useCallback((screenX, screenY) => {
        return {
            x: (screenX - offset.x) / scale,
            y: (screenY - offset.y) / scale
        };
    }, [offset, scale]);

    const toScreenSpace = useCallback((imageX, imageY) => {
        return {
            x: imageX * scale + offset.x,
            y: imageY * scale + offset.y
        };
    }, [offset, scale]);

    // --- Vanishing Point Calculation ---

    useEffect(() => {
        const calcVP = (axis) => {
            const lines = guideLines.filter(l => l.axis === axis);
            if (lines.length < 2) return null;

            // Check if lines are nearly parallel
            if (areLinesParallel(lines[0].p1, lines[0].p2, lines[1].p1, lines[1].p2, 2)) {
                return null; // Treat as parallel (VP at infinity)
            }

            return getLineIntersection(lines[0].p1, lines[0].p2, lines[1].p1, lines[1].p2);
        };

        setVanishingPoints({
            x: calcVP('x'),
            y: calcVP('y')
        });
    }, [guideLines]);

    // --- Extraction Logic ---

    const computeExtraction = useCallback((img, region) => {
        const points = region.points;
        if (!img || points.length !== 4) return null;

        const topW = dist(points[0], points[1]);
        const botW = dist(points[3], points[2]);
        const leftH = dist(points[0], points[3]);
        const rightH = dist(points[1], points[2]);

        let w = Math.round((topW + botW) / 2);
        let h = Math.round((leftH + rightH) / 2);

        w = Math.round(w * region.scaleX);
        h = Math.round(h * region.scaleY);

        if (w === 0 || h === 0) return null;

        const dstPts = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
        const H = getHomographyMatrix(dstPts, points);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width;
        srcCanvas.height = img.height;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0);
        const srcData = srcCtx.getImageData(0, 0, img.width, img.height).data;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const srcPt = applyMatrix(H, x, y);
                const sx = srcPt.x;
                const sy = srcPt.y;

                if (sx >= 0 && sx < img.width - 1 && sy >= 0 && sy < img.height - 1) {
                    const x0 = Math.floor(sx);
                    const y0 = Math.floor(sy);
                    const x1 = x0 + 1;
                    const y1 = y0 + 1;
                    const dx = sx - x0;
                    const dy = sy - y0;

                    const idx00 = (y0 * img.width + x0) * 4;
                    const idx10 = (y0 * img.width + x1) * 4;
                    const idx01 = (y1 * img.width + x0) * 4;
                    const idx11 = (y1 * img.width + x1) * 4;

                    for (let c = 0; c < 4; c++) {
                        const val =
                            srcData[idx00 + c] * (1 - dx) * (1 - dy) +
                            srcData[idx10 + c] * dx * (1 - dy) +
                            srcData[idx01 + c] * (1 - dx) * dy +
                            srcData[idx11 + c] * dx * dy;
                        data[(y * w + x) * 4 + c] = val;
                    }
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return { src: canvas.toDataURL(), width: w, height: h, points: points };
    }, []);

    // --- App Logic ---

    const loadImage = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setImage(img);
                // setDisplayImage(img); // Handled in CanvasWorkspace
                setRegions([]);
                setGuideLines([]);
                setExtractedImages([]);
                setLivePreview(null);

                const container = containerRef.current;
                if (container) {
                    const scaleX = (container.clientWidth - sidebarWidth) / img.width;
                    const scaleY = (container.clientHeight) / img.height;
                    const newScale = Math.min(scaleX, scaleY, 1);
                    setScale(newScale);
                    setOffset({
                        x: (container.clientWidth - img.width * newScale) / 2,
                        y: (container.clientHeight - img.height * newScale) / 2
                    });
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const snapValue = (val) => {
        return Math.round(val / snapIncrement) * snapIncrement;
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedRegionId && image) {
                const region = regions.find(r => r.id === selectedRegionId);
                if (region && region.points.length === 4) {
                    const result = computeExtraction(image, region);
                    setLivePreview(result);
                } else {
                    setLivePreview(null);
                }
            } else {
                setLivePreview(null);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [regions, selectedRegionId, image, computeExtraction]);

    useEffect(() => {
        const updateCanvasSize = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                setCanvasDims({ width: clientWidth, height: clientHeight });
            }
        };
        updateCanvasSize();
        const observer = new ResizeObserver(updateCanvasSize);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    // Resizing Logic
    useEffect(() => {
        const handleWindowMouseMove = (e) => {
            if (resizingState === 'sidebar') {
                const newWidth = window.innerWidth - e.clientX;
                setSidebarWidth(Math.max(250, Math.min(800, newWidth)));
            } else if (resizingState === 'preview') {
                const newHeight = e.clientY - 56;
                setPreviewPanelHeight(Math.max(150, Math.min(window.innerHeight - 200, newHeight)));
            } else if (resizingState === 'bottomPanel') {
                const newHeight = window.innerHeight - e.clientY;
                setBottomPanelHeight(Math.max(200, Math.min(window.innerHeight - 100, newHeight)));
            } else if (resizingState === 'preview-vertical') {
                const rect = document.getElementById('sidebar-panel')?.getBoundingClientRect();
                if (rect) {
                    const newWidth = e.clientX - rect.left;
                    setVerticalPreviewWidth(Math.max(200, Math.min(rect.width - 200, newWidth)));
                }
            }
        };

        const handleWindowMouseUp = () => {
            setResizingState(null);
        };

        if (resizingState) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
            if (resizingState === 'sidebar') document.body.style.cursor = 'col-resize';
            else if (resizingState === 'preview-vertical') document.body.style.cursor = 'col-resize';
            else document.body.style.cursor = 'row-resize';
        } else {
            document.body.style.cursor = 'default';
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [resizingState]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Alt') e.preventDefault();
            if (e.key === 'Control') setIsCtrlPressed(true);
            if (e.key === 'Shift') setIsShiftPressed(true);
            if (e.key === 'Alt') setIsAltPressed(true);

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (mode === 'guide') {
                    if (activeGuideId) {
                        setGuideLines(prev => prev.filter(l => l.id !== activeGuideId));
                        setActiveGuideId(null);
                    } else {
                        setGuideLines([]);
                    }
                } else if (selectedRegionId) {
                    const region = regions.find(r => r.id === selectedRegionId);
                    if (region && !region.locked) {
                        setRegions(prev => prev.filter(r => r.id !== selectedRegionId));
                        setSelectedRegionId(null);
                    }
                }
            }

            if (e.key === ' ' && mode === 'guide' && activeGuideId) {
                e.preventDefault();
                const g = guideLines.find(l => l.id === activeGuideId);
                if (g && containerRef.current) {
                    const target = guideFocusIndex === 0 ? g.p1 : g.p2;
                    const screenCenter = { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 };
                    setOffset({
                        x: screenCenter.x - target.x * scale,
                        y: screenCenter.y - target.y * scale
                    });
                    setGuideFocusIndex(prev => 1 - prev);
                }
                return;
            }

            if (e.key.toLowerCase() === 'q' && selectedRegionId) {
                setRegions(prev => prev.map(r =>
                    r.id === selectedRegionId ? { ...r, locked: !r.locked } : r
                ));
            }

            if (e.key.toLowerCase() === 'r') setMode('draw');
            if (e.key.toLowerCase() === 's') setMode('select');
            if (e.key.toLowerCase() === 'g') setMode('guide');

            if (e.key.toLowerCase() === 'x') {
                setCurrentGuideAxis(prev => {
                    if (prev === 'x') return 'y';
                    if (prev === 'y') return 'auto';
                    return 'x';
                });
            }
            if (e.key.toLowerCase() === 'y') setCurrentGuideAxis('y');

            if (['1', '2', '3', '4'].includes(e.key) && selectedRegionId) {
                const idx = parseInt(e.key) - 1;
                const region = regions.find(r => r.id === selectedRegionId);
                if (region && region.points[idx] && containerRef.current) {
                    const target = region.points[idx];
                    const screenCenter = { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 };
                    setOffset({
                        x: screenCenter.x - target.x * scale,
                        y: screenCenter.y - target.y * scale
                    });
                }
            }

            if (e.key === ' ' && selectedRegionId) {
                e.preventDefault();
                const region = regions.find(r => r.id === selectedRegionId);
                if (region && containerRef.current) {
                    const viewCenter = toImageSpace(containerRef.current.clientWidth / 2, containerRef.current.clientHeight / 2);
                    let closestIdx = 0;
                    let minD = Infinity;
                    region.points.forEach((p, i) => {
                        const d = dist(p, viewCenter);
                        if (d < minD) { minD = d; closestIdx = i; }
                    });
                    const nextIdx = (closestIdx + 1) % 4;
                    const target = region.points[nextIdx];
                    const screenCenter = { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 };
                    setOffset({
                        x: screenCenter.x - target.x * scale,
                        y: screenCenter.y - target.y * scale
                    });
                }
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Alt') e.preventDefault();
            if (e.key === 'Control') setIsCtrlPressed(false);
            if (e.key === 'Shift') setIsShiftPressed(false);
            if (e.key === 'Alt') setIsAltPressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedRegionId, regions, scale, offset, toImageSpace, mode, activeGuideId, guideLines, guideFocusIndex, sidebarWidth]);

    // --- Preview Interaction ---

    const handlePreviewWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = previewContainerRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;

        const zoomSpeed = 0.1;
        const currentScale = previewTransform.scale;
        const newScale = e.deltaY > 0
            ? currentScale * (1 - zoomSpeed)
            : currentScale * (1 + zoomSpeed);
        const clampedScale = Math.max(0.1, Math.min(10, newScale));

        const ds = clampedScale - currentScale;
        const newTX = previewTransform.x - ((mx - previewTransform.x) / currentScale) * ds;
        const newTY = previewTransform.y - ((my - previewTransform.y) / currentScale) * ds;

        setPreviewTransform({ scale: clampedScale, x: newTX, y: newTY });
    };

    const handlePreviewMouseDown = (e) => {
        if (e.button !== 0) return;
        setIsPreviewPanning(true);
        setPreviewPanStart({ x: e.clientX - previewTransform.x, y: e.clientY - previewTransform.y });
    };

    const handlePreviewMouseMove = (e) => {
        if (!isPreviewPanning) return;
        setPreviewTransform(prev => ({
            ...prev,
            x: e.clientX - previewPanStart.x,
            y: e.clientY - previewPanStart.y
        }));
    };

    const handlePreviewMouseUp = () => {
        setIsPreviewPanning(false);
    };

    // --- Interaction Logic ---

    const handleContextMenu = (e) => {
        e.preventDefault();
        const mousePos = getMousePos(e);
        const imgPos = toImageSpace(mousePos.x, mousePos.y);
        const hit = hitTest(imgPos);

        if (mode === 'guide' && hit && (hit.type === 'guide-edge' || hit.type === 'guide-vertex')) {
            setGuideLines(prev => prev.filter(l => l.id !== hit.id));
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            loadImage(e.dataTransfer.files[0]);
        }
    };

    const getMousePos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const hitTest = (imgPos) => {
        const vertexThreshold = 10 / scale;
        const edgeThreshold = 8 / scale;

        if (mode === 'guide') {
            if (activeGuideId) {
                const line = guideLines.find(l => l.id === activeGuideId);
                if (line) {
                    if (dist(imgPos, line.p1) < vertexThreshold) return { type: 'guide-vertex', id: line.id, point: 'p1' };
                    if (dist(imgPos, line.p2) < vertexThreshold) return { type: 'guide-vertex', id: line.id, point: 'p2' };
                    if (distToSegment(imgPos, line.p1, line.p2) < edgeThreshold) return { type: 'guide-edge', id: line.id };
                }
            }
            for (let line of guideLines) {
                if (dist(imgPos, line.p1) < vertexThreshold) return { type: 'guide-vertex', id: line.id, point: 'p1' };
                if (dist(imgPos, line.p2) < vertexThreshold) return { type: 'guide-vertex', id: line.id, point: 'p2' };
                if (distToSegment(imgPos, line.p1, line.p2) < edgeThreshold) return { type: 'guide-edge', id: line.id };
            }
            return null;
        }

        // Draw/Select Mode
        if (mode === 'select' || mode === 'draw') {
            const checkRegion = (r) => {
                for (let i = 0; i < r.points.length; i++) {
                    if (dist(imgPos, r.points[i]) < vertexThreshold) {
                        return { type: 'vertex', id: r.id, index: i };
                    }
                }
                for (let i = 0; i < r.points.length; i++) {
                    const p1 = r.points[i];
                    const p2 = r.points[(i + 1) % r.points.length];
                    if (distToSegment(imgPos, p1, p2) < edgeThreshold) {
                        return { type: 'edge', id: r.id, index: i };
                    }
                }
                return null;
            };

            if (selectedRegionId) {
                const selected = regions.find(r => r.id === selectedRegionId);
                if (selected) {
                    const res = checkRegion(selected);
                    if (res) return res;
                }
            }
            for (let r of regions) {
                if (r.id === selectedRegionId) continue;
                const res = checkRegion(r);
                if (res) return res;
            }
            if (selectedRegionId) {
                const selected = regions.find(r => r.id === selectedRegionId);
                if (selected && isPointInPolygon(imgPos, selected.points)) {
                    return { type: 'body', id: selected.id };
                }
            }
            for (let r of regions) {
                if (r.id === selectedRegionId) continue;
                if (isPointInPolygon(imgPos, r.points)) {
                    return { type: 'body', id: r.id };
                }
            }
        }
        return null;
    };



    const handleMouseDown = (e) => {
        if (!image) {
            fileInputRef.current.click();
            return;
        }

        const mousePos = getMousePos(e);
        const imgPos = toImageSpace(mousePos.x, mousePos.y);

        if (e.button === 1) {
            setDragState({ type: 'pan', startPos: mousePos, initialOffset: { ...offset } });
            return;
        }

        if (e.button !== 0) return;

        const hit = hitTest(imgPos);

        // Initial update for immediate drawing response
        mouseRef.current = mousePos;
        setCursorPos(mousePos);



        if (mode === 'guide') {
            if (tempGuideStart) {
                const p2 = imgPos;
                if (dist(tempGuideStart, p2) > 2 / scale) {
                    let axis = currentGuideAxis;
                    if (axis === 'auto') {
                        const dx = Math.abs(tempGuideStart.x - p2.x);
                        const dy = Math.abs(tempGuideStart.y - p2.y);
                        axis = dx > dy ? 'x' : 'y';
                    }
                    setGuideLines(prev => [...prev, { id: Date.now(), p1: tempGuideStart, p2: p2, axis }]);
                }
                setTempGuideStart(null);
                return;
            }

            if (hit && (hit.type === 'guide-vertex' || hit.type === 'guide-edge')) {
                setActiveGuideId(hit.id);
                setDragState({
                    type: hit.type,
                    id: hit.id,
                    point: hit.point,
                    startImgPos: imgPos,
                    initialLines: guideLines.map(l => ({ ...l, p1: { ...l.p1 }, p2: { ...l.p2 } }))
                });
                return;
            }

            if (!hit) {
                setActiveGuideId(null);
                setTempGuideStart(imgPos);
                setDragState({ type: 'create-guide', startImgPos: imgPos });
                return;
            }
        }

        if (mode === 'draw') {
            if (tempPoints.length < 3) {
                const snapped = { x: snapValue(imgPos.x), y: snapValue(imgPos.y) };
                setTempPoints([...tempPoints, snapped]);
            } else {
                const snapped = { x: snapValue(imgPos.x), y: snapValue(imgPos.y) };
                const newRegion = {
                    id: Date.now(),
                    points: [...tempPoints, snapped],
                    scaleX: 1,
                    scaleY: 1,
                    locked: false
                };
                setRegions([...regions, newRegion]);
                setTempPoints([]);
                setMode('select');
                setSelectedRegionId(newRegion.id);
            }
            return;
        }

        if (hit) {
            if (hit.type.startsWith('guide')) return;
            setSelectedRegionId(hit.id);
            const region = regions.find(r => r.id === hit.id);
            if (region.locked) return;

            let edgeRails = null;
            if (hit.type === 'edge') {
                const idx = hit.index;
                const p1_idx = idx;
                const p2_idx = (idx + 1) % 4;
                const prevPoint = region.points[(idx - 1 + 4) % 4];
                const nextPoint = region.points[(idx + 2) % 4];
                const p1_orig = region.points[p1_idx];
                const p2_orig = region.points[p2_idx];

                const rail1_shift = normalize(sub(p1_orig, prevPoint));
                const rail2_shift = normalize(sub(nextPoint, p2_orig));

                let vp1 = null, vp2 = null;
                if (vanishingPoints.x && vanishingPoints.y) {
                    const getClosestVP = (pStart, pEnd) => {
                        const v = normalize(sub(pEnd, pStart));
                        const vToX = normalize(sub(vanishingPoints.x, pStart));
                        const vToY = normalize(sub(vanishingPoints.y, pStart));
                        return Math.abs(dot(v, vToX)) > Math.abs(dot(v, vToY)) ? vanishingPoints.x : vanishingPoints.y;
                    };
                    vp1 = getClosestVP(prevPoint, p1_orig);
                    vp2 = getClosestVP(nextPoint, p2_orig);
                }
                edgeRails = { rail1_shift, rail2_shift, vp1, vp2 };
            }

            setDragState({
                type: hit.type,
                activeId: hit.id,
                activeIndex: hit.index,
                startImgPos: imgPos,
                startPos: mousePos,
                initialPoints: regions.find(r => r.id === hit.id).points.map(p => ({ ...p })),
                edgeRails
            });
        } else {
            setSelectedRegionId(null);
            setDragState({ type: 'pan', startPos: mousePos, initialOffset: { ...offset } });
        }
    };

    const handleMouseMove = useCallback((e) => {
        const mousePos = { x: e.clientX - canvasRef.current.getBoundingClientRect().left, y: e.clientY - canvasRef.current.getBoundingClientRect().top };
        mouseRef.current = mousePos;

        if (mode === 'guide' || mode === 'draw') {
            setCursorPos(mousePos);
            setForceUpdate(c => c + 1);
        }

        const rawImgPos = {
            x: (mousePos.x - offset.x) / scale,
            y: (mousePos.y - offset.y) / scale
        };
        const imgPos = rawImgPos;

        if (canvasRef.current) canvasRef.current._lastMouse = mousePos;

        if (dragState && dragState.type === 'pan') {
            const dx = mousePos.x - dragState.startPos.x;
            const dy = mousePos.y - dragState.startPos.y;
            setOffset({
                x: dragState.initialOffset.x + dx,
                y: dragState.initialOffset.y + dy
            });
            return;
        }

        if (dragState && (dragState.type === 'guide-vertex' || dragState.type === 'guide-edge')) {
            const dragVector = sub(imgPos, dragState.startImgPos);
            setGuideLines(prev => prev.map(l => {
                if (l.id !== dragState.id) return l;
                if (dragState.type === 'guide-vertex') {
                    return { ...l, [dragState.point]: imgPos };
                }
                if (dragState.type === 'guide-edge') {
                    const initial = dragState.initialLines.find(il => il.id === l.id);
                    return {
                        ...l,
                        p1: add(initial.p1, dragVector),
                        p2: add(initial.p2, dragVector)
                    };
                }
                return l;
            }));
            return;
        }

        if (dragState && ['vertex', 'edge', 'body'].includes(dragState.type)) {
            const activeRegion = regions.find(r => r.id === dragState.activeId);
            if (!activeRegion || activeRegion.locked) return;

            let newPoints = [...activeRegion.points];
            const dragVector = sub(imgPos, dragState.startImgPos);

            if (dragState.type === 'vertex') {
                const idx = dragState.activeIndex;
                let targetPos = { ...imgPos };

                if (isShiftPressed) {
                    const prevPt = dragState.initialPoints[(idx - 1 + 4) % 4];
                    const nextPt = dragState.initialPoints[(idx + 1) % 4];
                    const originPt = dragState.initialPoints[idx];
                    const v1 = normalize(sub(prevPt, originPt));
                    const v2 = normalize(sub(nextPt, originPt));
                    const moveVec = sub(imgPos, originPt);
                    const proj1 = dot(moveVec, v1);
                    const proj2 = dot(moveVec, v2);
                    if (Math.abs(proj1) > Math.abs(proj2)) targetPos = add(originPt, scaleVec(v1, proj1));
                    else targetPos = add(originPt, scaleVec(v2, proj2));
                }

                if (isAltPressed && vanishingPoints.x && vanishingPoints.y) {
                    const prevPt = newPoints[(idx - 1 + 4) % 4];
                    const nextPt = newPoints[(idx + 1) % 4];
                    const iA = getLineIntersection(nextPt, vanishingPoints.x, prevPt, vanishingPoints.y);
                    const iB = getLineIntersection(nextPt, vanishingPoints.y, prevPt, vanishingPoints.x);
                    if (iA && !iB) targetPos = iA;
                    else if (!iA && iB) targetPos = iB;
                    else if (iA && iB) {
                        if (dist(targetPos, iA) < dist(targetPos, iB)) targetPos = iA;
                        else targetPos = iB;
                    }
                } else {
                    targetPos.x = snapValue(targetPos.x);
                    targetPos.y = snapValue(targetPos.y);
                }

                if (isCtrlPressed) {
                    let bestSnap = null;
                    let minSnapDist = 15 / scale;
                    regions.forEach(r => {
                        if (r.id === dragState.activeId) return;
                        r.points.forEach(p => {
                            const d = dist(targetPos, p);
                            if (d < minSnapDist) { minSnapDist = d; bestSnap = p; }
                        });
                    });
                    if (!bestSnap) {
                        regions.forEach(r => {
                            if (r.id === dragState.activeId) return;
                            for (let i = 0; i < r.points.length; i++) {
                                const p1 = r.points[i];
                                const p2 = r.points[(i + 1) % r.points.length];
                                const d = distToSegment(targetPos, p1, p2);
                                if (d < minSnapDist) {
                                    minSnapDist = d;
                                    bestSnap = projectToSegment(targetPos, p1, p2);
                                }
                            }
                        });
                    }
                    if (bestSnap) targetPos = bestSnap;
                }
                newPoints[idx] = targetPos;
            }
            else if (dragState.type === 'edge') {
                const idx = dragState.activeIndex;
                const p1_idx = idx;
                const p2_idx = (idx + 1) % 4;
                const p1_orig = dragState.initialPoints[p1_idx];
                const p2_orig = dragState.initialPoints[p2_idx];

                let np1 = add(p1_orig, dragVector);
                let np2 = add(p2_orig, dragVector);

                const { rail1_shift, rail2_shift, vp1, vp2 } = dragState.edgeRails || {};

                if (isShiftPressed && rail1_shift && rail2_shift) {
                    const proj1 = scaleVec(rail1_shift, dot(dragVector, rail1_shift));
                    const proj2 = scaleVec(rail2_shift, dot(dragVector, rail2_shift));
                    np1 = add(p1_orig, proj1);
                    np2 = add(p2_orig, proj2);
                }
                else if (isAltPressed && vp1 && vp2) {
                    const prevPoint = dragState.initialPoints[(idx - 1 + 4) % 4];
                    const nextPoint = dragState.initialPoints[(idx + 2) % 4];

                    const target1 = add(p1_orig, dragVector);
                    const target2 = add(p2_orig, dragVector);

                    np1 = projectPointToLine(target1, prevPoint, vp1);
                    np2 = projectPointToLine(target2, nextPoint, vp2);
                }
                else {
                    np1 = { x: snapValue(np1.x), y: snapValue(np1.y) };
                    np2 = { x: snapValue(np2.x), y: snapValue(np2.y) };
                }

                if (isCtrlPressed) {
                    const midpoint = { x: (np1.x + np2.x) / 2, y: (np1.y + np2.y) / 2 };
                    let snapDelta = { x: 0, y: 0 };
                    let minSnapDist = 15 / scale;
                    let snapped = false;
                    regions.forEach(r => {
                        if (r.id === dragState.activeId) return;
                        r.points.forEach(p => {
                            const d = dist(midpoint, p);
                            if (d < minSnapDist) { minSnapDist = d; snapDelta = sub(p, midpoint); snapped = true; }
                        });
                    });
                    if (!snapped) {
                        regions.forEach(r => {
                            if (r.id === dragState.activeId) return;
                            for (let i = 0; i < r.points.length; i++) {
                                const ep1 = r.points[i];
                                const ep2 = r.points[(i + 1) % r.points.length];
                                const d = distToSegment(midpoint, ep1, ep2);
                                if (d < minSnapDist) {
                                    minSnapDist = d;
                                    const proj = projectToSegment(midpoint, ep1, ep2);
                                    snapDelta = sub(proj, midpoint);
                                    snapped = true;
                                }
                            }
                        });
                    }
                    if (snapped) { np1 = add(np1, snapDelta); np2 = add(np2, snapDelta); }
                }
                newPoints[p1_idx] = np1;
                newPoints[p2_idx] = np2;
            }
            else if (dragState.type === 'body') {
                newPoints = dragState.initialPoints.map(p => {
                    const np = add(p, dragVector);
                    return { x: snapValue(np.x), y: snapValue(np.y) };
                });
            }

            const updatedRegions = regions.map(r =>
                r.id === dragState.activeId ? { ...r, points: newPoints } : r
            );
            setRegions(updatedRegions);
            return;
        }
        if (!dragState && mode !== 'draw' && mode !== 'guide') {
            const hit = hitTest(imgPos);
            setHoverInfo(hit);
        }
    }, [dragState, mode, offset, scale, regions, vanishingPoints, isShiftPressed, isAltPressed, isCtrlPressed, guideLines, currentGuideAxis, snapValue]);

    const handleMouseUp = useCallback((e) => {
        if (dragState) {
            if (dragState.type === 'pan') {
                setDragState(null);
                return;
            }

            if (dragState.type === 'create-guide') {
                const mousePos = getMousePos(e);
                const p2 = toImageSpace(mousePos.x, mousePos.y);

                if (dist(dragState.startImgPos, p2) > 10 / scale) {
                    let axis = currentGuideAxis;
                    if (axis === 'auto') {
                        const dx = Math.abs(dragState.startImgPos.x - p2.x);
                        const dy = Math.abs(dragState.startImgPos.y - p2.y);
                        axis = dx > dy ? 'x' : 'y';
                    }
                    setGuideLines(prev => [...prev, { id: Date.now(), p1: dragState.startImgPos, p2: p2, axis }]);
                    setTempGuideStart(null);
                }
                setDragState(null);
                return;
            }

            if (isAltPressed && ['vertex', 'edge'].includes(dragState.type)) {
                const currentMouse = { x: e.clientX - canvasRef.current.getBoundingClientRect().left, y: e.clientY - canvasRef.current.getBoundingClientRect().top };
                const moveDist = dist(dragState.startPos, currentMouse);

                if (moveDist < 3) {
                    const region = regions.find(r => r.id === dragState.activeId);
                    if (region && !region.locked && vanishingPoints.x && vanishingPoints.y) {
                        const pts = region.points;
                        const newPts = [...pts];

                        if (dragState.type === 'vertex') {
                            const idx = dragState.activeIndex;
                            const prev = pts[(idx - 1 + 4) % 4];
                            const next = pts[(idx + 1) % 4];
                            const targetPos = pts[idx];
                            const iA = getLineIntersection(next, vanishingPoints.x, prev, vanishingPoints.y);
                            const iB = getLineIntersection(next, vanishingPoints.y, prev, vanishingPoints.x);
                            if (iA && !iB) newPts[idx] = iA;
                            else if (!iA && iB) newPts[idx] = iB;
                            else if (iA && iB) newPts[idx] = dist(targetPos, iA) < dist(targetPos, iB) ? iA : iB;
                        }
                        else if (dragState.type === 'edge') {
                            const p1Idx = dragState.activeIndex;
                            const p2Idx = (p1Idx + 1) % 4;

                            const getBestFit = (curr, pPrev, pNext) => {
                                const iA = getLineIntersection(pNext, vanishingPoints.x, pPrev, vanishingPoints.y);
                                const iB = getLineIntersection(pNext, vanishingPoints.y, pPrev, vanishingPoints.x);
                                if (iA && !iB) return iA;
                                if (!iA && iB) return iB;
                                if (iA && iB) return dist(curr, iA) < dist(curr, iB) ? iA : iB;
                                return curr;
                            };
                            const prev1 = pts[(p1Idx - 1 + 4) % 4];
                            const next1 = pts[(p1Idx + 1) % 4];
                            newPts[p1Idx] = getBestFit(pts[p1Idx], prev1, next1);
                            const prev2 = pts[(p2Idx - 1 + 4) % 4];
                            const next2 = pts[(p2Idx + 1) % 4];
                            newPts[p2Idx] = getBestFit(pts[p2Idx], prev2, next2);
                        }
                        setRegions(prev => prev.map(r => r.id === region.id ? { ...r, points: newPts } : r));
                    }
                }
            }
            setDragState(null);
        }
    }, [dragState, isAltPressed, regions, vanishingPoints, scale, currentGuideAxis, toImageSpace, mode, tempGuideStart]);

    // Global Drag Listeners
    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [dragState, handleMouseMove, handleMouseUp]);

    const handleWheel = (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const newScale = e.deltaY > 0
            ? scale * (1 - zoomSpeed)
            : scale * (1 + zoomSpeed);
        const clampedScale = Math.max(0.05, Math.min(50, newScale));
        const mousePos = getMousePos(e);
        const imgPos = { x: (mousePos.x - offset.x) / scale, y: (mousePos.y - offset.y) / scale };
        const newOffset = { x: mousePos.x - imgPos.x * clampedScale, y: mousePos.y - imgPos.y * clampedScale };
        setScale(clampedScale);
        setOffset(newOffset);
    };

    const snapshotCurrent = () => {
        if (livePreview) {
            setExtractedImages(prev => [...prev, { id: Date.now(), ...livePreview }]);
        }
    };

    const snapshotAll = () => {
        const snaps = regions.map(r => ({ id: r.id, ...computeExtraction(image, r) })).filter(x => x.src);
        setExtractedImages(prev => [...prev, ...snaps]);
    };

    const copyCoords = (points) => {
        const text = points.map(p => `(${Math.round(p.x)}, ${Math.round(p.y)})`).join(', ');
        navigator.clipboard.writeText(text);
    };

    const copyVPs = () => {
        if (!vanishingPoints.x && !vanishingPoints.y) return;
        const t = `VP X: ${vanishingPoints.x ? `(${Math.round(vanishingPoints.x.x)},${Math.round(vanishingPoints.x.y)})` : 'N/A'}\n` +
            `VP Y: ${vanishingPoints.y ? `(${Math.round(vanishingPoints.y.x)},${Math.round(vanishingPoints.y.y)})` : 'N/A'}`;
        navigator.clipboard.writeText(t);
    };

    const isVertical = layout === 'vertical';

    return (
        <div
            className={`flex h-screen w-screen bg-gray-900 text-white font-sans overflow-hidden ${isVertical ? 'flex-col' : 'flex-row'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
        >
            <Toolbar
                isVertical={isVertical}
                fileInputRef={fileInputRef}
                loadImage={loadImage}
                mode={mode}
                setMode={setMode}
                setLayout={setLayout}
                setSidebarWidth={setSidebarWidth}
                setPreviewPanelHeight={setPreviewPanelHeight}
                image={image}
                containerRef={containerRef}
                setOffset={setOffset}
                scale={scale}
                isSnapMenuOpen={isSnapMenuOpen}
                setIsSnapMenuOpen={setIsSnapMenuOpen}
                snapIncrement={snapIncrement}
                setSnapIncrement={setSnapIncrement}
                showViewSettings={showViewSettings}
                setShowViewSettings={setShowViewSettings}
                selectedRegionId={selectedRegionId}
                setRegions={setRegions}
                snapshotAll={snapshotAll}
                regions={regions}
            />

            {/* Main Workspace */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                {/* Horizontal Top Bar */}
                {!isVertical && (
                    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center space-x-4 text-sm text-gray-300">
                            <span className="font-bold text-white">Perspective Crop</span>
                            <div className="h-4 w-px bg-gray-600" />
                            <div className="flex items-center space-x-1 text-xs text-gray-400"><span className="px-1.5 py-0.5 bg-gray-700 rounded border border-gray-600 font-mono">Alt+Drag</span><span>Persp. Snap</span></div>
                            <div className="flex items-center space-x-1 text-xs text-gray-400"><span className="px-1.5 py-0.5 bg-gray-700 rounded border border-gray-600 font-mono">Space</span><span>Nav Guide</span></div>
                        </div>

                        <button onClick={snapshotAll} disabled={regions.length === 0} className={`flex items-center px-3 py-1.5 rounded text-sm font-medium transition ${regions.length > 0 ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                            <Download size={16} className="mr-2" /> Extract All
                        </button>
                    </div>
                )}

                <CanvasWorkspace
                    containerRef={containerRef}
                    canvasRef={canvasRef}
                    canvasDims={canvasDims}
                    image={image}
                    fileInputRef={fileInputRef}
                    handleMouseDown={handleMouseDown}
                    handleMouseMove={handleMouseMove}
                    handleWheel={handleWheel}
                    handleContextMenu={handleContextMenu}
                    showViewSettings={showViewSettings}
                    setShowViewSettings={setShowViewSettings}
                    showGuides={showGuides}
                    setShowGuides={setShowGuides}
                    showPerspectiveRays={showPerspectiveRays}
                    setShowPerspectiveRays={setShowPerspectiveRays}
                    setGuideLines={setGuideLines}
                    viewSettings={viewSettings}
                    setViewSettings={setViewSettings}
                    showVPInfo={showVPInfo}
                    setShowVPInfo={setShowVPInfo}
                    vanishingPoints={vanishingPoints}
                    guideLines={guideLines}
                    copyVPs={copyVPs}
                    mode={mode}
                    currentGuideAxis={currentGuideAxis}
                    snapIncrement={snapIncrement}
                    scale={scale}
                    offset={offset}
                    regions={regions}
                    selectedRegionId={selectedRegionId}
                    hoverInfo={hoverInfo}
                    activeGuideId={activeGuideId}
                    tempGuideStart={tempGuideStart}
                    tempPoints={tempPoints}
                    mouseRef={mouseRef}
                    forceUpdate={forceUpdate}
                    toImageSpace={toImageSpace}
                />
            </div>

            {/* Resizer (Main Splitter) */}
            <div
                className={`${isVertical
                    ? 'h-1 w-full cursor-row-resize bg-black hover:bg-blue-500 z-50 transition-colors'
                    : 'w-1 h-full cursor-col-resize bg-black hover:bg-blue-500 z-50 transition-colors'
                    }`}
                onMouseDown={() => setResizingState(isVertical ? 'bottomPanel' : 'sidebar')}
            />

            <Sidebar
                isVertical={isVertical}
                sidebarWidth={sidebarWidth}
                bottomPanelHeight={bottomPanelHeight}
                verticalPreviewWidth={verticalPreviewWidth}
                previewPanelHeight={previewPanelHeight}
                selectedRegion={regions.find(r => r.id === selectedRegionId)}
                selectedRegionId={selectedRegionId}
                setRegions={setRegions}
                previewContainerRef={previewContainerRef}
                handlePreviewWheel={handlePreviewWheel}
                handlePreviewMouseDown={handlePreviewMouseDown}
                handlePreviewMouseMove={handlePreviewMouseMove}
                handlePreviewMouseUp={handlePreviewMouseUp}
                livePreview={livePreview}
                previewTransform={previewTransform}
                isPreviewPanning={isPreviewPanning}
                setPreviewTransform={setPreviewTransform}
                snapshotCurrent={snapshotCurrent}
                setResizingState={setResizingState}
                extractedImages={extractedImages}
                setExtractedImages={setExtractedImages}
                copyCoords={copyCoords}
            />
        </div>
    );
}
