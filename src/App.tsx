import React from 'react';
import { useState, useRef, useEffect, useMemo, type JSX } from 'react'
import './App.css'

import {
  Upload,
  Circle as CircleIcon,
  Square,
  Minus,
  Spline,
  Brush,
  MousePointer2,
  Trash2,
  Copy,
  Settings,
  Image as ImageIcon,
  Link as LinkIcon,
  X,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  FileUp,
  Globe,
  Unlink,
  Download,
  FileJson,
  FileImage,
  AlertTriangle,
  FileSearch,
  ExternalLink
} from 'lucide-react';

import { MouseButton, type Color, type Group, type Link, type OpaqueID, type Patch, type Point, type Shape, type ShapeType } from './types';
import { getAverageColorInCircle, getAverageColorInRect, getSafeImageData } from './canvas';
import { getShapeBounds, distance, getQuadraticBezierPoint, normalizeRect, rotatePoint, pointInPolygon } from './geometry';
import { rgbToHex } from './utils';
import { ColorSwatch } from './components/ColorSwatch';
import { ToolButton } from './components/ToolButton';


const SEPARATOR = "|||GEMINI_DATA|||";



const App = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [imageSource, setImageSource] = useState<{ type: 'file' | 'url'; url?: string | null } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState('select');
  const [lastShapeTool, setLastShapeTool] = useState('circle');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<OpaqueID | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [linkStartId, setLinkStartId] = useState<OpaqueID | null>(null);
  const [linkCurrentPos, setLinkCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [importModal, setImportModal] = useState<JSX.Element | null>(null);
  const [debugInfo, setDebugInfo] = useState<JSX.Element | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const debugInputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_SAMPLES = 5;
  const DEFAULT_THICKNESS = 10;

  // --- Internal Logic Helpers ---

  const getConnectedGroups = (allShapes: Shape[], allLinks: Link[]) => {
    const parent: Record<OpaqueID, OpaqueID> = {};
    const find = (id: OpaqueID) => {
      if (parent[id] === undefined) parent[id] = id;
      if (parent[id] !== id) parent[id] = find(parent[id]);
      return parent[id];
    };
    const union = (id1: OpaqueID, id2: OpaqueID) => {
      const root1 = find(id1);
      const root2 = find(id2);
      if (root1 !== root2) parent[root1] = root2;
    };
    allShapes.forEach(s => find(s.id));
    allLinks.forEach(([id1, id2]) => union(id1, id2));
    const groups: Record<OpaqueID, Group> = {};
    allShapes.forEach(s => {
      const root = find(s.id);
      if (!groups[root]) groups[root] = { id: root, shapes: [], links: [] };
      groups[root].shapes.push(s.id);
    });
    allLinks.forEach(([id1, id2]) => {
      const root1 = find(id1);
      const root2 = find(id2);
      if (root1 !== root2) {
        groups[root1].links.push([id1, id2]);
        groups[root2].links.push([id2, id1]);
      }
    });
    return Object.values(groups);
  };

  const toggleLink = (id1: OpaqueID, id2: OpaqueID) => {
    setLinks(prev => {
      const exists = prev.find(([id1, id2]) => (id1 === id1 && id2 === id2) || (id1 === id2 && id2 === id1));
      return exists ? prev.filter(([id1, id2]) => id1 !== exists[0] && id2 !== exists[1]) : [...prev, [id1, id2]];
    });
    setCanvasVersion(prev => prev + 1);
  };

  const deleteSelected = () => {
    setSelectedShapeId((currentId: OpaqueID | null) => {
      if (currentId) {
        setShapes(prev => prev.filter(s => s.id !== currentId));
        setLinks(prev => prev.filter(([id1, id2]) => id1 !== currentId && id2 !== currentId));
      }
      return null;
    });
  };

  const unlinkSelected = () => {
    if (selectedShapeId) {
      setLinks(prev => prev.filter(([id1, id2]) => id1 !== selectedShapeId && id2 !== selectedShapeId));
    }
  };

  const updateShape = (id: OpaqueID, changes: any) => {
    setShapes(prev => prev.map(s => {
      if (s.id !== id) return s;
      if (changes.samples && changes.samples !== s.samples) {
        const newRadii: number[] = [...(s.radii || [])];
        while (newRadii.length < changes.samples) newRadii.push(s.thickness / 2);
        return { ...s, ...changes, radii: newRadii.slice(0, changes.samples) };
      }
      if (changes.thickness && !s.variableRadii && !changes.variableRadii) {
        const newRadii: number[] = Array(s.samples).fill(changes.thickness / 2);
        return { ...s, ...changes, radii: newRadii };
      }
      return { ...s, ...changes };
    }));
  };

  const createShape = (type: ShapeType, startPt: Point) => {
    const id = Date.now().toString();
    let newShape: Shape;
    if (type === 'circle') {
      newShape = { id, type, x: startPt.x, y: startPt.y, r: 0, handleAngle: 0 };
    } else if (type === 'rect') {
      newShape = { id, type, x: startPt.x, y: startPt.y, w: 0, h: 0, rotation: 0 };
    } else if (type === 'line') {
      newShape = {
        id, type, x1: startPt.x, y1: startPt.y, x2: startPt.x, y2: startPt.y,
        samples: DEFAULT_SAMPLES, thickness: DEFAULT_THICKNESS,
        radii: Array(DEFAULT_SAMPLES).fill(DEFAULT_THICKNESS / 2),
        mergeColors: false, variableRadii: false
      };
    } else if (type === 'curve') {
      newShape = {
        id, type, p0: { x: startPt.x, y: startPt.y }, p1: { x: startPt.x, y: startPt.y }, p2: { x: startPt.x, y: startPt.y },
        samples: DEFAULT_SAMPLES, thickness: DEFAULT_THICKNESS,
        radii: Array(DEFAULT_SAMPLES).fill(DEFAULT_THICKNESS / 2),
        mergeColors: false, variableRadii: false
      };
    } else {
      newShape = { id, type: 'brush', points: [{ x: startPt.x, y: startPt.y }] };
    }
    setShapes(prev => [...prev, newShape]);
    setSelectedShapeId(id);
    return id;
  };

  const fitImageToView = (w: number, h: number) => {
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const scaleW = (cw - 40) / w;
      const scaleH = (ch - 40) / h;
      const newZoom = Math.min(scaleW, scaleH, 1);
      setZoom(newZoom);
      setPan({ x: (cw - w * newZoom) / 2, y: (ch - h * newZoom) / 2 });
    }
  };

  const handleResetView = () => {
    if (imageSize.w && imageSize.h) fitImageToView(imageSize.w, imageSize.h);
  };

  const handleFocusShape = () => {
    if (!selectedShapeId || !containerRef.current) return;
    const shape = shapes.find(s => s.id === selectedShapeId);
    if (!shape) return;
    const { x, y, w, h } = getShapeBounds(shape);
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const padding = 100;
    const scaleW = (containerW - padding) / Math.max(1, w);
    const scaleH = (containerH - padding) / Math.max(1, h);
    let newZoom = Math.min(scaleW, scaleH);
    newZoom = Math.min(Math.max(0.1, newZoom), 20);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const newPanX = (containerW / 2) - (cx * newZoom);
    const newPanY = (containerH / 2) - (cy * newZoom);
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const loadImage = (src: string, type: 'file' | 'url', reset: boolean) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        setImage(img);
        setImageSize({ w: img.width, h: img.height });
        setImageSource({ type, url: type === 'url' ? src : null });
        if (reset) {
          setShapes([]);
          setLinks([]);
          fitImageToView(img.width, img.height);
        }
        resolve(img);
      };
      img.onerror = (e) => {
        alert("Could not load image. Check CORS or URL.");
        reject(e);
      };
      img.src = src;
    });
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const target = e.target as FileReader;
      const buffer = target.result as ArrayBuffer;
      const u8 = new Uint8Array(buffer);
      const sepBytes = new TextEncoder().encode(SEPARATOR);
      let foundIdx = -1;
      for (let i = u8.length - sepBytes.length; i >= Math.max(0, u8.length - 10000000); i--) {
        let match = true;
        for (let j = 0; j < sepBytes.length; j++) {
          if (u8[i + j] !== sepBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) { foundIdx = i; break; }
      }

      if (foundIdx !== -1) {
        const jsonBytes = u8.slice(foundIdx + sepBytes.length);
        const jsonStr = new TextDecoder().decode(jsonBytes);
        try {
          const data = JSON.parse(jsonStr);
          const imageBytes = u8.slice(0, foundIdx);
          const blob = new Blob([imageBytes], { type: file.type });
          const url = URL.createObjectURL(blob);

          loadImage(url, 'file', false).then((imgElement: HTMLImageElement) => {
            if (data.patches && data.patches.length > 0) {
              restoreFromPatches(imgElement, data.patches).then((restoredUrl: string) => {
                loadImage(restoredUrl, 'file', false);
              });
            }
            setShapes(data.shapes || []);
            setLinks(data.links || []);
          });
        } catch (err) {
          console.error("Failed to parse embedded data", err);
          loadImage(URL.createObjectURL(file), 'file', false);
        }
      } else {
        loadImage(URL.createObjectURL(file), 'file', false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const restoreFromPatches = (baseImg: HTMLImageElement, patches: Patch[]) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = baseImg.width;
      canvas.height = baseImg.height;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.drawImage(baseImg, 0, 0);
      let loaded = 0;
      if (patches.length === 0) resolve(canvas.toDataURL());
      patches.forEach(p => {
        const patchImg = new Image();
        patchImg.onload = () => {
          ctx.drawImage(patchImg, p.x, p.y);
          loaded++;
          if (loaded === patches.length) resolve(canvas.toDataURL());
        };
        patchImg.src = p.data;
      });
    });
  };

  const generateThumbnail = (img: HTMLImageElement) => {
    const thumbCanvas = document.createElement('canvas');
    const maxDim = 300;
    let w = img.width, h = img.height;
    if (w > maxDim || h > maxDim) {
      const ratio = Math.min(maxDim / w, maxDim / h);
      w *= ratio; h *= ratio;
    }
    thumbCanvas.width = w; thumbCanvas.height = h;
    const ctx = thumbCanvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0, w, h);
    return thumbCanvas.toDataURL('image/jpeg', 0.6);
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // --- Debug Logic ---
  const handleDebugImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const target = e.target as FileReader;
      const buffer = target.result as ArrayBuffer;
      const u8 = new Uint8Array(buffer);
      const sepBytes = new TextEncoder().encode(SEPARATOR);
      let foundIdx = -1;
      for (let i = u8.length - sepBytes.length; i >= Math.max(0, u8.length - 10000000); i--) {
        let match = true;
        for (let j = 0; j < sepBytes.length; j++) {
          if (u8[i + j] !== sepBytes[j]) { match = false; break; }
        }
        if (match) { foundIdx = i; break; }
      }

      if (foundIdx !== -1) {
        const jsonBytes = u8.slice(foundIdx + sepBytes.length);
        const jsonStr = new TextDecoder().decode(jsonBytes);
        try {
          const data = JSON.parse(jsonStr);
          setDebugInfo(data); // Fixed variable name
        } catch (err) {
          alert("Found data segment but failed to parse JSON.");
        }
      } else {
        alert("No embedded data found in this image.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
    setMenuOpen(false);
  };

  // --- Interaction Handlers ---

  const getMousePos = (e: MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: (clientX - pan.x) / zoom,
      y: (clientY - pan.y) / zoom
    };
  };

  const handleWheel = (e: WheelEvent) => {
    if (!image || !containerRef.current) return;
    e.preventDefault();
    const zoomIntensity = 0.1;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (mouseY - pan.y) / zoom;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newZoom = zoom + (direction * zoomIntensity * zoom);
    newZoom = Math.min(Math.max(0.1, newZoom), 20);
    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!image || !containerRef.current) return;
    if (e.button === MouseButton.Middle) {
      setIsPanning(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const target = e.target as HTMLElement;
    const pos = getMousePos(e);

    if (tool === 'link') {
      const clickedShape = shapes.find((s: Shape) => {
        let cx, cy;
        if (s.type === 'circle') { cx = s.x; cy = s.y; }
        else if (s.type === 'rect') { cx = s.x + s.w / 2; cy = s.y + s.h / 2; }
        else if (s.type === 'line') { cx = (s.x1 + s.x2) / 2; cy = (s.y1 + s.y2) / 2; }
        else if (s.type === 'curve') { cx = s.p1.x; cy = s.p1.y; }
        else if (s.type === 'brush') { cx = s.points[0].x; cy = s.points[0].y; }
        return distance({ x: cx, y: cy }, pos) < 50 / zoom;
      });
      if (clickedShape) {
        if (linkStartId && linkStartId !== clickedShape.id) {
          toggleLink(linkStartId, clickedShape.id);
          setLinkStartId(null);
          setLinkCurrentPos(null);
        } else {
          setLinkStartId(clickedShape.id);
          setLinkCurrentPos(pos);
          setDragStart({ x: e.clientX, y: e.clientY });
          setIsDragging(true);
        }
      } else {
        setLinkStartId(null);
        setLinkCurrentPos(null);
      }
      return;
    }

    if (target.dataset.handle && selectedShapeId) {
      setIsDragging(true);
      setActiveHandle(target.dataset.handle);
      if (target.dataset.handle === 'move') {
        const shape = shapes.find(s => s.id === selectedShapeId);
        if (shape.type === 'circle') setDragOffset({ x: pos.x - shape.x, y: pos.y - shape.y });
        else if (shape.type === 'rect') setDragOffset({ x: pos.x - shape.x, y: pos.y - shape.y });
        else if (shape.type === 'brush') setDragOffset({ x: pos.x - shape.points[0].x, y: pos.y - shape.points[0].y });
      }
      if (target.dataset.handle.startsWith('rad-')) setActiveHandle(target.dataset.handle);
      return;
    }

    if (target.dataset.shapeId) {
      if (tool === 'select') {
        const id = target.dataset.shapeId;
        setSelectedShapeId(id);
        setIsDragging(true);
        setActiveHandle('move');
        const shape = shapes.find(s => s.id === id);
        if (shape.type === 'circle') setDragOffset({ x: pos.x - shape.x, y: pos.y - shape.y });
        else if (shape.type === 'rect') setDragOffset({ x: pos.x - shape.x, y: pos.y - shape.y });
        else if (shape.type === 'line') setDragOffset({ x: pos.x - shape.x1, y: pos.y - shape.y1 });
        else if (shape.type === 'curve') setDragOffset({ x: pos.x - shape.p0.x, y: pos.y - shape.p0.y });
        else if (shape.type === 'brush') setDragOffset({ x: pos.x - shape.points[0].x, y: pos.y - shape.points[0].y });
        return;
      }
    }

    if (tool !== 'select' && tool !== 'link') {
      createShape(tool, pos);
      setIsDragging(true);
      setActiveHandle('create');
    } else {
      if (target.tagName === 'svg' || target === containerRef.current) {
        setSelectedShapeId(null);
        setIsPanning(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    if (!isDragging && !linkStartId) return;
    const pos = getMousePos(e);
    if (tool === 'link' && linkStartId) {
      setLinkCurrentPos(pos);
      return;
    }
    if (!isDragging || !selectedShapeId) return;
    const shape = shapes.find(s => s.id === selectedShapeId);
    if (!shape) return;

    if (activeHandle === 'create') {
      if (shape.type === 'circle') {
        const r = distance({ x: shape.x, y: shape.y }, pos);
        const angleRad = Math.atan2(pos.y - shape.y, pos.x - shape.x);
        updateShape(shape.id, { r, handleAngle: angleRad });
      } else if (shape.type === 'rect') {
        updateShape(shape.id, { w: pos.x - shape.x, h: pos.y - shape.y });
      } else if (shape.type === 'line') {
        updateShape(shape.id, { x2: pos.x, y2: pos.y });
      } else if (shape.type === 'curve') {
        const midX = (shape.p0.x + pos.x) / 2;
        const midY = (shape.p0.y + pos.y) / 2 - 50;
        updateShape(shape.id, { p2: pos, p1: { x: midX, y: midY } });
      } else if (shape.type === 'brush') {
        updateShape(shape.id, { points: [...shape.points, pos] });
      }
    }
    else if (activeHandle === 'move') {
      if (shape.type === 'circle') updateShape(shape.id, { x: pos.x - dragOffset.x, y: pos.y - dragOffset.y });
      else if (shape.type === 'rect') updateShape(shape.id, { x: pos.x - dragOffset.x, y: pos.y - dragOffset.y });
      else if (shape.type === 'line') {
        const dx = (pos.x - dragOffset.x) - shape.x1;
        const dy = (pos.y - dragOffset.y) - shape.y1;
        updateShape(shape.id, { x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy });
      } else if (shape.type === 'curve') {
        const dx = (pos.x - dragOffset.x) - shape.p0.x;
        const dy = (pos.y - dragOffset.y) - shape.p0.y;
        updateShape(shape.id, { p0: { x: shape.p0.x + dx, y: shape.p0.y + dy }, p1: { x: shape.p1.x + dx, y: shape.p1.y + dy }, p2: { x: shape.p2.x + dx, y: shape.p2.y + dy } });
      } else if (shape.type === 'brush') {
        const dx = (pos.x - dragOffset.x) - shape.points[0].x;
        const dy = (pos.y - dragOffset.y) - shape.points[0].y;
        const newPoints = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        updateShape(shape.id, { points: newPoints });
      }
    }
    else if (activeHandle) {
      if (activeHandle.startsWith('rad-')) {
        const idx = parseInt(activeHandle.split('-')[1]);
        let center;
        if (shape.type === 'line') {
          const t = shape.samples > 1 ? idx / (shape.samples - 1) : 0.5;
          center = { x: shape.x1 + (shape.x2 - shape.x1) * t, y: shape.y1 + (shape.y2 - shape.y1) * t };
        } else if (shape.type === 'curve') {
          const t = shape.samples > 1 ? idx / (shape.samples - 1) : 0.5;
          center = getQuadraticBezierPoint(t, shape.p0, shape.p1, shape.p2);
        }
        if (center) {
          const newR = distance(center, pos);
          const newRadii = [...shape.radii];
          newRadii[idx] = newR;
          updateShape(shape.id, { radii: newRadii });
        }
      }
      if (shape.type === 'line') {
        if (activeHandle === 'h1') updateShape(shape.id, { x1: pos.x, y1: pos.y });
        if (activeHandle === 'h2') updateShape(shape.id, { x2: pos.x, y2: pos.y });
      }
      if (shape.type === 'curve') {
        if (activeHandle === 'p0') updateShape(shape.id, { p0: pos });
        if (activeHandle === 'p1') updateShape(shape.id, { p1: pos });
        if (activeHandle === 'p2') updateShape(shape.id, { p2: pos });
      }
      if (shape.type === 'circle') {
        if (activeHandle === 'r') {
          const r = distance({ x: shape.x, y: shape.y }, pos);
          const angleRad = Math.atan2(pos.y - shape.y, pos.x - shape.x);
          updateShape(shape.id, { r, handleAngle: angleRad });
        }
      }
      if (shape.type === 'rect') {
        if (activeHandle === 'rotate') {
          const { x, y, w, h } = normalizeRect(shape.x, shape.y, shape.w, shape.h);
          const cx = x + w / 2; const cy = y + h / 2;
          const angleRad = Math.atan2(pos.y - cy, pos.x - cx);
          let angleDeg = angleRad * (180 / Math.PI) + 90;
          updateShape(shape.id, { rotation: angleDeg });
        } else {
          const { x, y, w, h } = normalizeRect(shape.x, shape.y, shape.w, shape.h);
          const cx = x + w / 2; const cy = y + h / 2;
          const localPos = rotatePoint(pos.x, pos.y, cx, cy, -(shape.rotation || 0));
          let anchorX = cx, anchorY = cy; let newW = w, newH = h, newX = x, newY = y;
          if (activeHandle === 'e') { anchorX = x; anchorY = cy; newW = Math.max(1, localPos.x - x); }
          else if (activeHandle === 'w') { anchorX = x + w; anchorY = cy; const dx = localPos.x - x; newW = Math.max(1, w - dx); newX = x + dx; }
          else if (activeHandle === 's') { anchorX = cx; anchorY = y; newH = Math.max(1, localPos.y - y); }
          else if (activeHandle === 'n') { anchorX = cx; anchorY = y + h; const dy = localPos.y - y; newH = Math.max(1, h - dy); newY = y + dy; }
          else if (activeHandle === 'br') { anchorX = x; anchorY = y; newW = Math.max(1, localPos.x - x); newH = Math.max(1, localPos.y - y); }
          const anchorWorldOld = rotatePoint(anchorX, anchorY, cx, cy, shape.rotation || 0);
          const { x: fx, y: fy, w: fw, h: fh } = normalizeRect(newX, newY, newW, newH);
          const newCx = fx + fw / 2; const newCy = fy + fh / 2;
          const anchorWorldNew = rotatePoint(anchorX, anchorY, newCx, newCy, shape.rotation || 0);
          updateShape(shape.id, { x: newX + (anchorWorldOld.x - anchorWorldNew.x), y: newY + (anchorWorldOld.y - anchorWorldNew.y), w: newW, h: newH });
        }
      }
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (tool === 'link' && linkStartId) {
      const pos = getMousePos(e);
      const endShape = shapes.find(s => {
        if (s.id === linkStartId) return false;
        let cx, cy;
        if (s.type === 'circle') { cx = s.x; cy = s.y; }
        else if (s.type === 'rect') { cx = s.x + s.w / 2; cy = s.y + s.h / 2; }
        else if (s.type === 'line') { cx = (s.x1 + s.x2) / 2; cy = (s.y1 + s.y2) / 2; }
        else if (s.type === 'curve') { cx = s.p1.x; cy = s.p1.y; }
        else if (s.type === 'brush') { cx = s.points[0].x; cy = s.points[0].y; }
        return distance({ x: cx, y: cy }, pos) < 50 / zoom;
      });
      if (endShape) {
        toggleLink(linkStartId, endShape.id);
        setLinkStartId(null); setLinkCurrentPos(null);
      } else {
        const screenDist = distance({ x: e.clientX, y: e.clientY }, dragStart || { x: e.clientX, y: e.clientY });
        if (screenDist > 5) { setLinkStartId(null); setLinkCurrentPos(null); }
      }
    }
    setIsDragging(false);
    setIsPanning(false);
    setActiveHandle(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    setMenuOpen(false);
  };

  const handleExport = () => {
    if (!image) return;
    const exportData = {
      version: 1,
      imageData: {
        url: imageSource?.type === 'url' ? imageSource.url : null,
        width: imageSize.w, height: imageSize.h,
        aspectRatio: imageSize.w / imageSize.h,
        thumbnail: generateThumbnail(image)
      },
      shapes: shapes, links: links
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadFile(blob, 'color-extraction-project.json');
    setMenuOpen(false);
  };

  const handleExportImageWithData = () => {
    if (!image || !svgRef.current) return;
    setMenuOpen(false);
    // 1. Generate Patches
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = image.width; sourceCanvas.height = image.height;
    const sourceCtx = sourceCanvas.getContext('2d') as CanvasRenderingContext2D;
    sourceCtx.drawImage(image, 0, 0);
    const patches = shapes.map(shape => {
      const bounds = getShapeBounds(shape, 10);
      const x = Math.max(0, bounds.x), y = Math.max(0, bounds.y);
      const w = Math.min(image.width - x, bounds.w), h = Math.min(image.height - y, bounds.h);
      if (w <= 0 || h <= 0) return null;
      const patchData = sourceCtx.getImageData(x, y, w, h) as ImageData;
      const pCanvas = document.createElement('canvas');
      pCanvas.width = w; pCanvas.height = h;
      pCanvas.getContext('2d')?.putImageData(patchData, 0, 0);
      return { x, y, data: pCanvas.toDataURL('image/png') };
    }).filter(Boolean);

    // 2. Prepare Visual
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(image, 0, 0);

    const svgClone = svgRef.current.cloneNode(true) as SVGElement;
    svgClone.setAttribute("width", image.width.toString());
    svgClone.setAttribute("height", image.height.toString());
    svgClone.setAttribute("viewBox", `0 0 ${image.width.toString()} ${image.height.toString()}`);
    const gizmos = svgClone.querySelectorAll('[data-handle], .cursor-move, .cursor-ew-resize, .cursor-ns-resize, .cursor-nwse-resize, [stroke-dasharray="2,2"]');
    gizmos.forEach(el => el.remove());
    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const svgImg = new Image();
    svgImg.onload = () => {
      ctx.drawImage(svgImg, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob: Blob | null) => {
        // TODO: Error handling
        if (!blob) return;
        const json = JSON.stringify({ shapes, links, patches, version: 1, imageData: { url: imageSource?.type === 'url' ? imageSource.url : null, width: imageSize.w, height: imageSize.h, aspectRatio: imageSize.w / imageSize.h } });
        const finalBlob = new Blob([blob, SEPARATOR, json], { type: 'image/png' });
        downloadFile(finalBlob, 'smart-image-export.png');
      }, 'image/png');
    };
    svgImg.src = url;
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      // TODO: Error handling
      if (!e.target?.result) return;
      try {
        const data = JSON.parse(e.target.result as string);
        const importedAspect = data.imageData.width ? data.imageData.width / data.imageData.height : (data.imageData.aspectRatio || 1);
        const doImport = () => { setShapes(data.shapes || []); setLinks(data.links || []); setImportModal(null); };
        if (data.imageData?.url) { await loadImage(data.imageData.url, 'url', true); doImport(); }
        else {
          if (image) {
            const currentAspect = image.width / image.height;
            if (Math.abs(currentAspect - importedAspect) > 0.01) {
              setImportModal({ type: 'mismatch', thumbnail: data.imageData.thumbnail, onConfirm: doImport });
            } else { doImport(); }
          } else {
            setImportModal({ type: 'no-image', thumbnail: data.imageData.thumbnail, onConfirm: doImport });
          }
        }
      } catch (err) { alert("Failed to parse project file."); }
    };
    reader.readAsText(file);
    target.value = '';
    setMenuOpen(false);
  };

  // --- Effects ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') return;
      const key = e.key.toLowerCase();
      if (key === 's') { setTool('select'); setSelectedShapeId(null); }
      else if (key === 'r') { setTool('rect'); setSelectedShapeId(null); }
      else if (key === 'c') { setTool('circle'); setSelectedShapeId(null); }
      else if (key === 'u') { setTool('curve'); setSelectedShapeId(null); }
      else if (key === 'l') { setTool('line'); setSelectedShapeId(null); }
      else if (key === 'k') { setTool('link'); setSelectedShapeId(null); }
      else if (key === 'h') { setTool('brush'); setSelectedShapeId(null); }
      else if (key === 'escape') {
        if (debugInfo) setDebugInfo(null);
        else if (importModal) setImportModal(null);
        else if (menuOpen) setMenuOpen(false);
        else { setSelectedShapeId(null); setLinkStartId(null); setLinkCurrentPos(null); }
      }
      else if (key === 'f') handleFocusShape();
      else if (key === 'tab') { e.preventDefault(); setTool(prev => prev === 'select' ? lastShapeTool : 'select'); }
      else if (key === 'delete' || key === 'backspace') deleteSelected();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool, lastShapeTool, selectedShapeId, shapes, importModal, menuOpen, debugInfo]);

  useEffect(() => { if (tool !== 'select' && tool !== 'link') setLastShapeTool(tool); }, [tool]);
  useEffect(() => { if (image && canvasRef.current) { const ctx = canvasRef.current.getContext('2d') as CanvasRenderingContext2D; canvasRef.current.width = image.width; canvasRef.current.height = image.height; ctx.drawImage(image, 0, 0); setCanvasVersion(v => v + 1); } }, [image]);
  useEffect(() => { const handlePaste = (e: ClipboardEvent) => { const items = e.clipboardData.items; for (let i = 0; i < items.length; i++) { if (items[i].type.indexOf('image') !== -1) { const blob = items[i].getAsFile(); processFile(blob); break; } } }; window.addEventListener('paste', handlePaste); return () => window.removeEventListener('paste', handlePaste); }, []);

  // --- Palette Calculation ---
  const { computedShapes, customPalette } = useMemo(() => {
    if (!image || !canvasRef.current) return { computedShapes: shapes, customPalette: [] };
    try {
      const ctx = canvasRef.current.getContext('2d') as CanvasRenderingContext2D;
      const processed = shapes.map(shape => {
        let samples: any[] = [];
        if (shape.type === 'circle') {
          samples = [getAverageColorInCircle(ctx, shape.x, shape.y, shape.r)];
        } else if (shape.type === 'rect') {
          samples = [getAverageColorInRect(ctx, shape.x, shape.y, shape.w, shape.h, shape.rotation || 0)];
        } else if (shape.type === 'brush' && shape.points.length > 2) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          shape.points.forEach((p: Point) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });

          const img = getSafeImageData(ctx, minX, minY, maxX - minX, maxY - minY);

          if (img) {
            let r = 0, g = 0, b = 0, c = 0;
            for (let y = 0; y < img.height; y++) {
              for (let x = 0; x < img.width; x++) {
                if (pointInPolygon({ x: img.x + x, y: img.y + y }, shape.points)) {
                  const i = (y * img.width + x) * 4;
                  r += img.data[i];
                  g += img.data[i + 1];
                  b += img.data[i + 2];
                  c++;
                }
              }
            }
            if (c > 0) {
              samples = [{ r: Math.round(r / c), g: Math.round(g / c), b: Math.round(b / c), count: c, rT: r, gT: g, bT: b }];
            } else {
              samples = [{ r: 0, g: 0, b: 0, count: 0 }];
            }
          } else {
            samples = [{ r: 0, g: 0, b: 0, count: 0 }];
          }
        } else if (shape.type === 'line') {
          for (let i = 0; i < shape.samples; i++) {
            const t = shape.samples > 1 ? i / (shape.samples - 1) : 0.5;
            const px = shape.x1 + (shape.x2 - shape.x1) * t, py = shape.y1 + (shape.y2 - shape.y1) * t;
            const rad = shape.variableRadii && shape.radii ? shape.radii[i] : shape.thickness / 2;
            samples.push(getAverageColorInCircle(ctx, px, py, rad));
          }
        } else if (shape.type === 'curve') {
          for (let i = 0; i < shape.samples; i++) {
            const t = shape.samples > 1 ? i / (shape.samples - 1) : 0.5;
            const p = getQuadraticBezierPoint(t, shape.p0, shape.p1, shape.p2);
            const rad = shape.variableRadii && shape.radii ? shape.radii[i] : shape.thickness / 2;
            samples.push(getAverageColorInCircle(ctx, p.x, p.y, rad));
          }
        }
        if ((shape.type === 'line' || shape.type === 'curve') && shape.mergeColors) {
          let rT = 0, gT = 0, bT = 0, cT = 0;
          samples.forEach(s => { rT += s.rT || (s.r * s.count); gT += s.gT || (s.g * s.count); bT += s.bT || (s.b * s.count); cT += s.count; });
          if (cT > 0) samples = [{ r: Math.round(rT / cT), g: Math.round(gT / cT), b: Math.round(bT / cT), count: cT, rT, gT, bT }];
          else samples = [{ r: 0, g: 0, b: 0, count: 0 }];
        }
        return { ...shape, rawSamples: samples };
      });
      const groups = getConnectedGroups(processed, links);
      const paletteItems: Color[] = [];
      groups.forEach((group: Group) => {
        if (group.shapes.length > 1) {
          let rT = 0, gT = 0, bT = 0, cT = 0;
          group.shapes.forEach((shapeId: OpaqueID) => {
            const s = processed.find(p => p.id === shapeId);
            if (s && s.rawSamples) {
              s.rawSamples.forEach((sam: any) => { rT += sam.rT || (sam.r * sam.count); gT += sam.gT || (sam.g * sam.count); bT += sam.bT || (sam.b * sam.count); cT += sam.count; });
            }
          });
          if (cT > 0) paletteItems.push({ r: Math.round(rT / cT), g: Math.round(gT / cT), b: Math.round(bT / cT), shapeIds: group.shapes, isGroup: true });
        } else {
          const shapeId = group.shapes[0];
          const s = processed.find(p => p.id === shapeId);
          if (s && s.rawSamples) {
            s.rawSamples.forEach((sam: any) => { paletteItems.push({ ...sam, shapeIds: [shapeId] }); });
          }
        }
      });
      return { computedShapes: processed, customPalette: paletteItems };
    } catch (e) { return { computedShapes: shapes, customPalette: [] }; }
  }, [shapes, image, canvasVersion, links]);

  const globalPalette = useMemo(() => {
    return customPalette;
  }, [customPalette]);

  // --- Render Functions (Defined inside App) ---

  const renderLinks = () => {
    return links.map((link: Link, idx: number) => {
      const s1 = shapes.find((s: Shape) => s.id === link[0]);
      const s2 = shapes.find((s: Shape) => s.id === link[1]);
      if (!s1 || !s2) return null;
      let c1 = { x: 0, y: 0 }, c2 = { x: 0, y: 0 };
      if (s1.type === 'circle') { c1.x = s1.x; c1.y = s1.y; }
      else if (s1.type === 'rect') { c1.x = s1.x + s1.w / 2; c1.y = s1.y + s1.h / 2; }
      else if (s1.type === 'line') { c1.x = (s1.x1 + s1.x2) / 2; c1.y = (s1.y1 + s1.y2) / 2; }
      else if (s1.type === 'curve') { c1.x = s1.p1.x; c1.y = s1.p1.y; }
      else if (s1.type === 'brush') { c1.x = s1.points[0].x; c1.y = s1.points[0].y; }
      if (s2.type === 'circle') { c2.x = s2.x; c2.y = s2.y; }
      else if (s2.type === 'rect') { c2.x = s2.x + s2.w / 2; c2.y = s2.y + s2.h / 2; }
      else if (s2.type === 'line') { c2.x = (s2.x1 + s2.x2) / 2; c2.y = (s2.y1 + s2.y2) / 2; }
      else if (s2.type === 'curve') { c2.x = s2.p1.x; c2.y = s2.p1.y; }
      else if (s2.type === 'brush') { c2.x = s2.points[0].x; c2.y = s2.points[0].y; }
      return <line key={idx} x1={c1.x} y1={c1.y} x2={c2.x} y2={c2.y} stroke="#f59e0b" strokeWidth={1 / zoom} strokeDasharray="4,4" />;
    });
  };

  const renderShape = (shape: Shape, isSelected: boolean) => {
    const strokeColor = isSelected ? '#3b82f6' : 'white';
    const strokeWidth = 2 / zoom;
    const handleR = 6 / zoom;
    const computed = computedShapes.find((s: Shape) => s.id === shape.id);

    const renderVariableRadiiHandles = (points: Point[]) => {
      return points.map((p: Point, i: number) => (
        <React.Fragment key={i}>
          <line x1={p.x} y1={p.y} x2={p.x + (shape.radii?.[i] || shape.thickness / 2)} y2={p.y} stroke="#3b82f6" strokeWidth={1 / zoom} strokeDasharray="2,2" />
          <circle cx={p.x + (shape.radii?.[i] || shape.thickness / 2)} cy={p.y} r={handleR} fill="#fff" stroke="#3b82f6" strokeWidth={1 / zoom} data-handle={`rad-${i}`} className="cursor-ew-resize" />
        </React.Fragment>
      ));
    };

    if (shape.type === 'circle') {
      const angle = shape.handleAngle || 0;
      const hx = shape.x + Math.cos(angle) * shape.r;
      const hy = shape.y + Math.sin(angle) * shape.r;
      return (
        <g key={shape.id}>
          <circle cx={shape.x} cy={shape.y} r={shape.r} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="5,5" />
          <circle cx={shape.x} cy={shape.y} r={shape.r} fill="transparent" data-shape-id={shape.id} />
          {isSelected && (
            <>
              <circle cx={shape.x} cy={shape.y} r={handleR} fill="#3b82f6" data-handle="move" className="cursor-move" />
              <line x1={shape.x} y1={shape.y} x2={hx} y2={hy} stroke="#3b82f6" strokeWidth={1 / zoom} strokeDasharray="2,2" />
              <circle cx={hx} cy={hy} r={handleR} fill="#fff" stroke="#3b82f6" strokeWidth={strokeWidth} data-handle="r" className="cursor-ew-resize" />
            </>
          )}
        </g>
      );
    }
    if (shape.type === 'rect') {
      const { x, y, w, h } = normalizeRect(shape.x, shape.y, shape.w, shape.h);
      const cx = x + w / 2;
      const cy = y + h / 2;
      return (
        <g key={shape.id} transform={`rotate(${shape.rotation || 0}, ${cx}, ${cy})`}>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="5,5" />
          <rect x={x} y={y} width={w} height={h} fill="transparent" data-shape-id={shape.id} />
          {isSelected && (
            <>
              <circle cx={cx} cy={cy} r={handleR} fill="#3b82f6" data-handle="move" className="cursor-move" />
              <rect x={x + w - handleR} y={cy - handleR} width={handleR * 2} height={handleR * 2} fill="#fff" stroke="#3b82f6" strokeWidth={strokeWidth} data-handle="e" className="cursor-ew-resize" />
              <rect x={x - handleR} y={cy - handleR} width={handleR * 2} height={handleR * 2} fill="#fff" stroke="#3b82f6" strokeWidth={strokeWidth} data-handle="w" className="cursor-ew-resize" />
              <rect x={cx - handleR} y={y - handleR} width={handleR * 2} height={handleR * 2} fill="#fff" stroke="#3b82f6" strokeWidth={strokeWidth} data-handle="n" className="cursor-ns-resize" />
              <rect x={cx - handleR} y={y + h - handleR} width={handleR * 2} height={handleR * 2} fill="#fff" stroke="#3b82f6" strokeWidth={strokeWidth} data-handle="s" className="cursor-ns-resize" />
              <rect x={x + w - handleR} y={y + h - handleR} width={handleR * 2} height={handleR * 2} fill="#fff" stroke="#3b82f6" strokeWidth={strokeWidth} data-handle="br" className="cursor-nwse-resize" />
              <line x1={cx} y1={y} x2={cx} y2={y - 25 / zoom} stroke="#3b82f6" strokeWidth={1 / zoom} />
              <circle cx={cx} cy={y - 25 / zoom} r={handleR} fill="#10b981" stroke="white" strokeWidth={1 / zoom} data-handle="rotate" className="cursor-grab" />
            </>
          )}
        </g>
      );
    }
    if (shape.type === 'line' || shape.type === 'curve') {
      let points: Point[] = [];
      if (shape.type === 'line') {
        for (let i = 0; i < shape.samples; i++) {
          const t = shape.samples > 1 ? i / (shape.samples - 1) : 0.5;
          points.push({ x: shape.x1 + (shape.x2 - shape.x1) * t, y: shape.y1 + (shape.y2 - shape.y1) * t });
        }
      } else {
        for (let i = 0; i < shape.samples; i++) {
          const t = shape.samples > 1 ? i / (shape.samples - 1) : 0.5;
          points.push(getQuadraticBezierPoint(t, shape.p0, shape.p1, shape.p2));
        }
      }
      const pathEl = shape.type === 'line' ? <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={strokeColor} strokeWidth={strokeWidth} /> : <path d={`M ${shape.p0.x} ${shape.p0.y} Q ${shape.p1.x} ${shape.p1.y} ${shape.p2.x} ${shape.p2.y}`} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />;
      const ghostEl = shape.type === 'line' ? <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke="transparent" strokeWidth={15 / zoom} data-shape-id={shape.id} /> : <path d={`M ${shape.p0.x} ${shape.p0.y} Q ${shape.p1.x} ${shape.p1.y} ${shape.p2.x} ${shape.p2.y}`} fill="none" stroke="transparent" strokeWidth={15 / zoom} data-shape-id={shape.id} />;
      return (
        <g key={shape.id}>
          {points.map((p: Point, i: number) => {
            const rad = shape.variableRadii && shape.radii ? shape.radii[i] : shape.thickness / 2;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={rad} fill="none" stroke="black" strokeWidth={(2 / zoom) + 1} opacity="0.5" />
                <circle cx={p.x} cy={p.y} r={rad} fill="none" stroke="white" strokeWidth={1.5 / zoom} />
              </g>
            );
          })}
          {pathEl}
          {ghostEl}
          {isSelected && (
            <>
              {shape.type === 'line' && (
                <>
                  <circle cx={shape.x1} cy={shape.y1} r={handleR} fill="#3b82f6" data-handle="h1" className="cursor-move" />
                  <circle cx={shape.x2} cy={shape.y2} r={handleR} fill="#3b82f6" data-handle="h2" className="cursor-move" />
                </>
              )}
              {shape.type === 'curve' && (
                <>
                  <path d={`M ${shape.p0.x} ${shape.p0.y} L ${shape.p1.x} ${shape.p1.y} L ${shape.p2.x} ${shape.p2.y}`} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1 / zoom} strokeDasharray="2,2" />
                  <circle cx={shape.p0.x} cy={shape.p0.y} r={handleR} fill="#3b82f6" data-handle="p0" className="cursor-move" />
                  <circle cx={shape.p1.x} cy={shape.p1.y} r={handleR} fill="#10b981" data-handle="p1" className="cursor-move" />
                  <circle cx={shape.p2.x} cy={shape.p2.y} r={handleR} fill="#3b82f6" data-handle="p2" className="cursor-move" />
                </>
              )}
              {shape.variableRadii && renderVariableRadiiHandles(points)}
            </>
          )}
        </g>
      );
    }
    if (shape.type === 'brush') {
      const pointsStr = shape.points.map((p: Point) => `${p.x},${p.y}`).join(' ');
      return (
        <g key={shape.id}>
          <polygon points={pointsStr} fill="rgba(255,255,255,0.1)" stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray="5,5" />
          <polygon points={pointsStr} fill="transparent" data-shape-id={shape.id} />
          {isSelected && (
            <circle cx={shape.points[0].x} cy={shape.points[0].y} r={handleR} fill="#3b82f6" data-handle="move" className="cursor-move" />
          )}
        </g>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">

      {/* --- Warning Modal --- */}
      {importModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-md w-full text-center">
            <div className="bg-yellow-500/10 p-3 rounded-full inline-block mb-3">
              <AlertTriangle className="text-yellow-500 w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Import Warning</h3>
            {importModal.type === 'mismatch' ? (
              <p className="text-sm text-slate-400 mb-4">The loaded image aspect ratio does not match the project file. The shapes might be misaligned.</p>
            ) : (
              <p className="text-sm text-slate-400 mb-4">No image is currently loaded. Please load the correct image before importing shapes.</p>
            )}
            {importModal.thumbnail && (
              <div className="mb-4 bg-black/50 p-1 rounded-lg border border-slate-700 inline-block">
                <img src={importModal.thumbnail} alt="Project Thumbnail" className="max-h-40 rounded object-contain" />
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">Project Thumbnail</p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={() => setImportModal(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              <button onClick={importModal.onConfirm} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors">Import Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Debug Info Modal --- */}
      {debugInfo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Debug Smart Image Data</h3>
              <button onClick={() => setDebugInfo(null)}><X className="text-slate-400 hover:text-white" /></button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Metadata</h4>
                  <pre className="text-xs text-green-400 font-mono overflow-auto max-h-40">
                    {JSON.stringify({ ...debugInfo, patches: `[${debugInfo.patches?.length || 0} patches found]` }, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Embedded Patches ({debugInfo.patches?.length || 0})</h4>
                <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {debugInfo.patches?.map((p, i) => (
                    <div key={i} className="relative group border border-slate-800 bg-black/50 p-1 rounded">
                      <img src={p.data} className="w-full h-auto object-contain" alt={`Patch ${i}`} />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[10px] font-mono text-white">x:{p.x} y:{p.y}</span>
                      </div>
                    </div>
                  ))}
                  {(!debugInfo.patches || debugInfo.patches.length === 0) && (
                    <p className="text-xs text-slate-600 col-span-3 text-center py-4">No patches found in this file.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setDebugInfo(null)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm">Close Debugger</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Sidebar / Tools --- */}
      <div className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-4 z-20 shadow-xl relative">
        <div className="relative mb-4">
          <button onClick={() => setMenuOpen(!menuOpen)} className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg hover:brightness-110 transition-all">
            <ImageIcon className="text-white" />
          </button>
          {menuOpen && (
            <div className="absolute top-14 left-0 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
              <button onClick={() => { fileInputRef.current.click(); }} className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded text-sm text-left"><FileUp size={16} /> New / Upload</button>
              <div className="border-t border-slate-700 my-1"></div>
              <button onClick={handleExport} className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded text-sm text-left"><Download size={16} /> Export Project</button>
              <button onClick={handleExportImageWithData} className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded text-sm text-left"><FileImage size={16} /> Export Smart Image</button>
              <button onClick={() => importInputRef.current.click()} className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded text-sm text-left"><FileJson size={16} /> Import JSON</button>
              <div className="border-t border-slate-700 my-1"></div>
              <button onClick={() => debugInputRef.current.click()} className="flex items-center gap-2 p-2 hover:bg-slate-700 rounded text-sm text-left text-blue-400"><FileSearch size={16} /> Inspect Smart Img</button>
              <div className="border-t border-slate-700 my-1"></div>
              <button onClick={() => { setShapes([]); setLinks([]); setMenuOpen(false); }} className="flex items-center gap-2 p-2 hover:bg-red-900/50 text-red-400 rounded text-sm text-left"><Trash2 size={16} /> Clear Canvas</button>
              {image && (
                <div className="mt-2 p-1">
                  <input type="text" placeholder="Image URL" className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { loadImage(urlInput, 'url'); setUrlInput(''); setMenuOpen(false); } }} />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="w-10 h-[1px] bg-slate-800 mb-2"></div>
        <ToolButton active={tool === 'select'} icon={MousePointer2} onClick={() => setTool('select')} label="Select/Move" shortcut="S" />
        <ToolButton active={tool === 'link'} icon={LinkIcon} onClick={() => { setTool('link'); setSelectedShapeId(null); }} label="Link Shapes" shortcut="K" />
        <ToolButton active={tool === 'circle'} icon={CircleIcon} onClick={() => setTool('circle')} label="Circle Sampler" shortcut="C" />
        <ToolButton active={tool === 'rect'} icon={Square} onClick={() => setTool('rect')} label="Rect Sampler" shortcut="R" />
        <ToolButton active={tool === 'line'} icon={Minus} onClick={() => setTool('line')} label="Line Path" shortcut="L" />
        <ToolButton active={tool === 'curve'} icon={Spline} onClick={() => setTool('curve')} label="Curve Path" shortcut="U" />
        <ToolButton active={tool === 'brush'} icon={Brush} onClick={() => setTool('brush')} label="Freehand Region" shortcut="H" />
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <input ref={importInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        <input ref={debugInputRef} type="file" accept="image/*" onChange={handleDebugImage} className="hidden" />
      </div>

      {/* --- Main Workspace --- */}
      <div className="flex-1 flex flex-col relative h-full">
        <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-6 justify-between z-10 shadow-sm">
          <h1 className="text-sm font-semibold text-slate-400 tracking-wider flex items-center gap-2">CANVAS <span className="text-slate-600">|</span> <span className="text-xs text-slate-500 font-normal">{Math.round(zoom * 100)}%</span></h1>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 items-center">
              <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-700 rounded"><ZoomOut size={14} /></button>
              <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>
              <button onClick={handleResetView} className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-700 rounded" title="Reset View"><Maximize size={14} /></button>
              <div className="w-[1px] h-4 bg-slate-700 mx-1"></div>
              <button onClick={() => setZoom(z => Math.min(20, z + 0.1))} className="p-1.5 hover:text-white text-slate-400 hover:bg-slate-700 rounded"><ZoomIn size={14} /></button>
            </div>
            {selectedShapeId && (
              <div className="flex items-center gap-4 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 animate-in fade-in slide-in-from-top-4">
                <Settings size={14} className="text-slate-400" />
                {(shapes.find((s: Shape) => s.id === selectedShapeId)?.type === 'line' || shapes.find((s: Shape) => s.id === selectedShapeId)?.type === 'curve') && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Samples:</span>
                      <input type="range" min="2" max="20" value={shapes.find((s: Shape) => s.id === selectedShapeId)?.samples} onChange={(e) => updateShape(selectedShapeId, { samples: parseInt(e.target.value) })} className="w-20 accent-blue-500" />
                      <span className="text-xs font-mono w-4">{shapes.find((s: Shape) => s.id === selectedShapeId)?.samples}</span>
                    </div>
                    <div className="w-[1px] h-4 bg-slate-600"></div>
                    <label className="flex items-center gap-2 cursor-pointer" title="Merge all samples into one color">
                      <span className="text-xs text-slate-400">Merge</span>
                      <input type="checkbox" checked={shapes.find((s: Shape) => s.id === selectedShapeId)?.mergeColors || false} onChange={(e) => updateShape(selectedShapeId, { mergeColors: e.target.checked })} className="accent-blue-500" />
                    </label>
                    <div className="w-[1px] h-4 bg-slate-600"></div>
                    <label className="flex items-center gap-2 cursor-pointer" title="Variable Radii">
                      <span className="text-xs text-slate-400">Var.R</span>
                      <input type="checkbox" checked={shapes.find((s: Shape) => s.id === selectedShapeId)?.variableRadii || false} onChange={(e) => updateShape(selectedShapeId, { variableRadii: e.target.checked })} className="accent-blue-500" />
                    </label>
                    {!shapes.find((s: Shape) => s.id === selectedShapeId)?.variableRadii && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Size:</span>
                        <input type="range" min="1" max="50" value={shapes.find((s: Shape) => s.id === selectedShapeId)?.thickness} onChange={(e) => updateShape(selectedShapeId, { thickness: parseInt(e.target.value) })} className="w-20 accent-blue-500" />
                      </div>
                    )}
                  </>
                )}
                {shapes.find((s: Shape) => s.id === selectedShapeId)?.type === 'rect' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Rot:</span>
                    <input type="number" className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-xs" value={Math.round(shapes.find((s: Shape) => s.id === selectedShapeId)?.rotation || 0)} onChange={(e) => updateShape(selectedShapeId, { rotation: parseFloat(e.target.value) })} />
                  </div>
                )}
                <div className="w-[1px] h-4 bg-slate-600 mx-1"></div>
                <button onClick={unlinkSelected} className="text-orange-400 hover:text-orange-300" title="Unlink All"><Unlink size={16} /></button>
                <button onClick={deleteSelected} className="text-red-400 hover:text-red-300" title="Delete (Del/Backspace)"><Trash2 size={16} /></button>
              </div>
            )}
          </div>
        </div>

        <div
          ref={containerRef}
          className={`flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center ${isPanning ? 'cursor-grab active:cursor-grabbing' : tool === 'link' ? 'cursor-copy' : 'cursor-crosshair'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {!image && (
            <div className="flex flex-col items-center gap-4">
              <div onClick={() => fileInputRef.current.click()} className="text-center p-10 border-2 border-dashed border-slate-800 rounded-3xl cursor-pointer hover:border-slate-600 hover:bg-slate-900/50 transition-all group">
                <div className="bg-slate-900 p-6 rounded-full inline-block mb-4 shadow-inner group-hover:scale-110 transition-transform">
                  <Upload size={48} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
                </div>
                <h2 className="text-xl font-medium text-slate-300">Click to upload</h2>
                <p className="text-slate-500 mt-2">or drag an image here</p>
              </div>
              <div className="flex gap-2 w-full max-w-sm">
                <input type="text" placeholder="Or paste an Image URL..." className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { loadImage(urlInput, 'url'); setUrlInput(''); } }} />
                <button onClick={() => { loadImage(urlInput, 'url'); setUrlInput(''); }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm border border-slate-700">Go</button>
              </div>
            </div>
          )}
          {image && (
            <div className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: imageSize.w, height: imageSize.h, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
              <img src={image.src} className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" alt="Workplace" />
              <svg ref={svgRef} className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="none">
                {renderLinks()}
                {shapes.map((s: Shape) => renderShape(s, s.id === selectedShapeId))}
                {tool === 'link' && linkStartId && linkCurrentPos && (
                  <line
                    x1={(() => {
                      const s = shapes.find((sh: Shape) => sh.id === linkStartId);
                      if (!s) return 0;
                      if (s.type === 'circle') return s.x;
                      if (s.type === 'rect') return s.x + s.w / 2;
                      if (s.type === 'line') return (s.x1 + s.x2) / 2;
                      if (s.type === 'curve') return s.p1.x;
                      return s.x || 0;
                    })()}
                    y1={(() => {
                      const s = shapes.find((sh: Shape) => sh.id === linkStartId);
                      if (!s) return 0;
                      if (s.type === 'circle') return s.y;
                      if (s.type === 'rect') return s.y + s.h / 2;
                      if (s.type === 'line') return (s.y1 + s.y2) / 2;
                      if (s.type === 'curve') return s.p1.y;
                      return s.y || 0;
                    })()}
                    x2={linkCurrentPos.x} y2={linkCurrentPos.y} stroke="#f59e0b" strokeWidth={2 / zoom} strokeDasharray="5,5"
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-xl">
        <div className="h-14 border-b border-slate-800 flex items-center px-6">
          <h2 className="font-semibold text-slate-200">Palette</h2>
          <span className="ml-auto bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">{globalPalette.length} colors</span>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700">
          {globalPalette.length === 0 ? (
            <div className="text-center mt-10 opacity-50">
              <p className="text-sm text-slate-400">No colors yet.</p>
              <p className="text-xs text-slate-600 mt-1">Use tools to sample the image.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 auto-rows-min">
              {globalPalette.map((item: Color, idx: number) => (
                <ColorSwatch key={idx} color={item} isHighlighted={item.shapeIds && item.shapeIds.includes(selectedShapeId)} />
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          {globalPalette.length > 0 && globalPalette.length <= 10 && (
            <a
              href={`https://coolors.co/${globalPalette.map((c: Color) => rgbToHex(c.r, c.g, c.b).replace('#', '')).join('-')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              <ExternalLink size={16} /> Open in Coolors
            </a>
          )}
          <button
            onClick={() => {
              const allHex = globalPalette.map((c: Color) => rgbToHex(c.r, c.g, c.b)).join(', ');
              navigator.clipboard.writeText(allHex);
            }}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
          >
            <Copy size={16} /> Copy All HEX
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;