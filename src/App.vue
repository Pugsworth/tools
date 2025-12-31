<script setup lang="ts">

import { ref, computed, watch, onMounted, nextTick, type ComputedRef } from 'vue';
import {
    Upload, Palette, ChevronUp, ChevronDown, Grid, RefreshCw, Wand2,
    Shuffle, ArrowLeftRight, Target, Activity, Image as ImageIcon,
    Lock, Unlock
} from 'lucide-vue-next';
import { hexToRgb, rgbToHsl, rgbToCmyk, rgbToOklab, rgbToLab, parseColorStr, rgbToHsv, clamp, hsvToRgb, hslToRgb, oklabToRgb, labToRgb, rgbToHex, rgbDistance, oklabDistance } from './utils';
import type { CMYKColor, Color, HSLColor, HSVColor, LABColor, OKLABColor, RGBColor } from './types';


// Utils

const appContainer = ref<HTMLElement | null>(null);
const uiState = ref({ showUpload: true, showPalette: true, showSwatches: true });
const originalImage = ref<HTMLImageElement | null>(null);
const paletteRaw = ref("#0d2b45, #203c56, #544e68, #8d697a, #d08159, #ffaa5e, #ffd4a3, #ffecd1");
const activePalette = ref<{ id: string; hex: string; locked: boolean }[]>([]);
const usedIndices = ref(new Set<number>());

const segMethod = ref("luminance");
const segCount = ref(8);
const segMap = ref<Uint8Array | null>(null);
const segCentroids = ref<{ r: number; g: number; b: number }[]>([]);
const isComputingSeg = ref(false);

const imageUrlInput = ref("");
const isSplitView = ref(false);
const splitPercent = ref(50);
const isLoading = ref(false);
const error = ref("");
const dragOver = ref(false);
const activeSwatchIndex = ref(null);
const hoveredIndex = ref(null);

const selectedSwatchId = ref(null);
const pickerMode = ref('HSV');
const pickerState = ref({ hex: "#000000", hsv: { h: 0, s: 0, v: 0 } });

const isDraggingSplit = ref(false);
const dragState = ref<{
    isDragging: boolean;
    isPending: boolean;
    startX: number;
    startY: number;
    index: number | null;
    id: string | null;
    color: string | null;
    x: number;
    y: number;
    snapshot: { id: string; hex: string; locked: boolean }[];
}>({ isDragging: false, isPending: false, startX: 0, startY: 0, index: null, id: null, color: null, x: 0, y: 0, snapshot: [] });
const isPickerDragging = ref(false);
const isHueDragging = ref(false);

const scale = ref(1);
const offset = ref({ x: 0, y: 0 });
const isPanning = ref(false);
const startPan = ref({ x: 0, y: 0 });

const canvasMain = ref<HTMLCanvasElement | null>(null);
const canvasOriginal = ref<HTMLCanvasElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const transformContainer = ref<HTMLElement | null>(null);
const satValBox = ref<HTMLElement | null>(null);
const visualCanvas = ref<HTMLCanvasElement | null>(null);

const transformStyle = computed(() => ({
    transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`,
    transition: isPanning.value ? 'none' : 'transform 0.1s ease-out',
    willChange: 'transform'
}));

const isLabMode = computed(() => ['LAB', 'OKLAB'].includes(pickerMode.value));

const currentModeValues: ComputedRef<Color | null> = computed(() => {
    const { r, g, b } = hexToRgb(pickerState.value.hex);
    if (pickerMode.value === 'RGB')
        return ({ type: 'RGB', r, g, b }) as RGBColor;
    if (pickerMode.value === 'HSV')
        return ({ type: 'HSV', ...pickerState.value.hsv }) as HSVColor;
    if (pickerMode.value === 'HSL')
        return ({ type: 'HSL', ...rgbToHsl(r, g, b) }) as HSLColor;
    if (pickerMode.value === 'CMYK')
        return ({ type: 'CMYK', ...rgbToCmyk(r, g, b) }) as CMYKColor;
    if (pickerMode.value === 'OKLAB') {
        const o = rgbToOklab(r, g, b);
        return ({ type: 'OKLAB', L: o.L * 100, a: o.a * 100, b: o.b * 100 }) as OKLABColor;
    }
    if (pickerMode.value === 'LAB')
        return ({ type: 'LAB', ...rgbToLab(r, g, b) }) as LABColor;

    return null;
});

const visualBoxStyle = computed(() => {
    const mode = pickerMode.value;
    const vals = currentModeValues.value;
    if (!vals) return { background: '#000' };
    if (mode === 'HSV' && 'h' in vals) return { background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)`, backgroundColor: `hsl(${vals.h}, 100%, 50%)` };
    if (mode === 'HSL' && 'h' in vals) return { background: `linear-gradient(to top, #000, transparent, #fff)`, backgroundColor: `hsl(${vals.h}, 100%, 50%)` };
    if (mode === 'RGB' && 'b' in vals) return {
        backgroundColor: `rgb(0,0,${Math.round(vals.b)})`,
        backgroundImage: `linear-gradient(to right, rgba(255,0,0,0), rgba(255,0,0,1)), linear-gradient(to top, rgba(0,255,0,0), rgba(0,255,0,1))`,
        backgroundBlendMode: 'screen'
    };
    if (isLabMode.value) return { backgroundColor: '#333' };
    return { background: '#000' };
});
const visualCursorStyle = computed(() => {
    const mode = pickerMode.value;
    const v = currentModeValues.value;
    if (!v) return { left: '0%', top: '0%' };
    let x = 0, y = 0;
    if (mode === 'HSV' && 's' in v && 'v' in v) { x = v.s; y = 100 - v.v; }
    else if (mode === 'HSL' && 's' in v && 'l' in v) { x = v.s; y = 100 - v.l; }
    else if (mode === 'RGB' && 'r' in v && 'g' in v) { x = (v.r / 255) * 100; y = 100 - (v.g / 255) * 100; }
    else if (isLabMode.value && 'a' in v && 'b' in v) { x = ((v.a + 128) / 255) * 100; y = 100 - ((v.b + 128) / 255) * 100; }
    return { left: x + '%', top: y + '%' };
});
const visualSliderBgStyle = computed(() => {
    const mode = pickerMode.value;
    if (mode === 'HSV' || mode === 'HSL') return { background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' };
    if (mode === 'RGB') return { background: 'linear-gradient(to right, #000, #00f)' };
    if (isLabMode.value) return { background: 'linear-gradient(to right, #000, #fff)' };
    return { background: '#555' };
});
const visualSliderPos = computed(() => {
    const mode = pickerMode.value;
    const v = currentModeValues.value;
    if (!v) return 0;
    if ((mode === 'HSV' || mode === 'HSL') && 'h' in v) return (v.h / 360) * 100;
    if (mode === 'RGB' && 'b' in v) return (v.b / 255) * 100;
    if (isLabMode.value && 'L' in v) return v.L;
    return 0;
});

const syncFromRaw = () => {
    // Snapshot existing locks to preserve them
    // We store them as a pool of hex codes that are locked
    const lockedPool = activePalette.value.filter(c => c.locked).map(c => c.hex);

    const found = [];
    const regex = /(?:#)?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b|(?:rgb|color|)?[\(\{\[]?\s*([0-9\.]+)\s*,\s*([0-9\.]+)\s*,\s*([0-9\.]+)\s*[\)\}\]]?/gi;
    let match;

    while ((match = regex.exec(paletteRaw.value)) !== null) {
        const hex = parseColorStr(match[0]);
        if (hex) {
            let isLocked = false;
            // Check if this hex exists in our locked pool
            const poolIndex = lockedPool.indexOf(hex);
            if (poolIndex !== -1) {
                isLocked = true;
                lockedPool.splice(poolIndex, 1); // Consume the lock so duplicates don't all get locked
            }
            found.push({ id: Math.random().toString(36).substr(2, 9), hex: hex, locked: isLocked });
        }
    }

    if (found.length > 0 || paletteRaw.value.trim() === '') {
        activePalette.value = found;
        if (found.length > 0 && found.length !== segCount.value) {
            // Only auto-sync seg count on initial load or large paste, not every keystroke usually
            // But here we are in syncFromRaw which is load/paste-like
            segCount.value = found.length;
            recomputeSegmentation();
        }
    }
};

const syncToRaw = () => { paletteRaw.value = activePalette.value.map(c => c.hex).join(', '); };

const onRawInput = () => {
    // Snapshot existing locks
    const lockedPool = activePalette.value.filter(c => c.locked).map(c => c.hex);

    const found = [];
    const regex = /(?:#)?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b|(?:rgb|color|)?[\(\{\[]?\s*([0-9\.]+)\s*,\s*([0-9\.]+)\s*,\s*([0-9\.]+)\s*[\)\}\]]?/gi;
    let match;

    while ((match = regex.exec(paletteRaw.value)) !== null) {
        const hex = parseColorStr(match[0]);
        if (hex) {
            let isLocked = false;
            const poolIndex = lockedPool.indexOf(hex);
            if (poolIndex !== -1) {
                isLocked = true;
                lockedPool.splice(poolIndex, 1);
            }
            found.push({ id: Math.random().toString(36).substr(2, 9), hex: hex, locked: isLocked });
        }
    }

    activePalette.value = found;

    // Auto-sync segmentation if count matches reasonable heuristic (e.g. user finished pasting)
    // Or just always sync for responsiveness
    if (found.length > 0 && found.length !== segCount.value) {
        segCount.value = found.length;
        recomputeSegmentation();
    }
};

const selectSwatch = (id: string, hex: string) => { selectedSwatchId.value = id; const { r, g, b } = hexToRgb(hex); pickerState.value = { hex: hex, hsv: rgbToHsv(r, g, b) } as HSVColor; };
const applyColorToPalette = (hex: string) => { if (selectedSwatchId.value) { const idx = activePalette.value.findIndex(c => c.id === selectedSwatchId.value); if (idx !== -1) { activePalette.value[idx].hex = hex; syncToRaw(); processImage(); } } };

const startSwatchInteraction = (e: MouseEvent, index: number, color: Color) => {
    // Check if clicked the lock button specifically? No, lock button has @mousedown.stop
    // But we still need to handle drag vs click here for the rest of the swatch

    const startX = e.clientX; const startY = e.clientY; let isDrag = false;
    const onMove = (evt: MouseEvent) => {
        const dist = Math.sqrt((evt.clientX - startX) ** 2 + (evt.clientY - startY) ** 2);
        if (!isDrag && dist > 5) { isDrag = true; dragState.value = { ...dragState.value, isDragging: true, index, id: color.id, color: color.hex, x: evt.clientX, y: evt.clientY, snapshot: [...activePalette.value] }; }
        if (isDrag) {
            dragState.value.x = evt.clientX; dragState.value.y = evt.clientY;
            const el = document.elementsFromPoint(evt.clientX, evt.clientY).find(el => el.classList.contains('swatch-item'));
            if (el) {
                const targetIdx = Array.from(document.querySelectorAll('.swatch-item')).indexOf(el);
                if (targetIdx !== -1 && index !== null && !activePalette.value[targetIdx].locked && !color.locked) {
                    // Only allow dragging if source (color) is not locked AND target is not locked
                    const arr = [...dragState.value.snapshot];
                    const temp = arr[index];
                    arr[index] = arr[targetIdx];
                    arr[targetIdx] = temp;
                    activePalette.value = arr; processImage();
                }
            }
        }
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); if (!isDrag) { selectSwatch(color.id, color.hex); } else { dragState.value.isDragging = false; syncToRaw(); } };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
};

const startCanvasPan = (e: MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    isPanning.value = true;
    startPan.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y };
    const onMove = (evt: MouseEvent) => { offset.value = { x: evt.clientX - startPan.value.x, y: evt.clientY - startPan.value.y }; };
    const onUp = () => { isPanning.value = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
};

const updateVisualPicker = (e) => {
    if (!satValBox.value) return;
    const rect = satValBox.value.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const mode = pickerMode.value; let { r, g, b } = hexToRgb(pickerState.value.hex);
    if (mode === 'HSV') { const hsv = { ...pickerState.value.hsv }; hsv.s = x * 100; hsv.v = (1 - y) * 100; const rgb = hsvToRgb(hsv.h / 360, hsv.s / 100, hsv.v / 100); r = rgb.r; g = rgb.g; b = rgb.b; pickerState.value.hsv = hsv; }
    else if (mode === 'RGB') { r = Math.round(x * 255); g = Math.round((1 - y) * 255); }
    else if (mode === 'HSL') { const hsl = rgbToHsl(r, g, b); hsl.s = x * 100; hsl.l = (1 - y) * 100; const rgb = hslToRgb(hsl.h / 360, hsl.s / 100, hsl.l / 100); r = rgb.r; g = rgb.g; b = rgb.b; }
    else if (isLabMode.value) { const vals = currentModeValues.value; if (!vals || !('L' in vals)) return; const a = x * 255 - 128; const bb = (1 - y) * 255 - 128; let rgb; if (mode === 'OKLAB') rgb = oklabToRgb(vals.L / 100, a / 100, bb / 100); else rgb = labToRgb(vals.L, a, bb); r = rgb.r; g = rgb.g; b = rgb.b; }
    const hex = rgbToHex(r, g, b); pickerState.value.hex = hex; if (mode !== 'HSV') pickerState.value.hsv = rgbToHsv(r, g, b); applyColorToPalette(hex);
};
const startPickerDrag = (e: MouseEvent) => { updateVisualPicker(e); const onMove = (evt: MouseEvent) => updateVisualPicker(evt); const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); };

const updateSliderPicker = (e: MouseEvent) => {
    const el = e.target.closest('.relative'); if (!el) return;
    const rect = el.getBoundingClientRect(); const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const mode = pickerMode.value; let { r, g, b } = hexToRgb(pickerState.value.hex);
    if (mode === 'HSV' || mode === 'HSL') { const h = x * 360; if (mode === 'HSV') { const hsv = { ...pickerState.value.hsv }; hsv.h = h; const rgb = hsvToRgb(h / 360, hsv.s / 100, hsv.v / 100); r = rgb.r; g = rgb.g; b = rgb.b; pickerState.value.hsv = hsv; } else { const hsl = rgbToHsl(r, g, b); const rgb = hslToRgb(h / 360, hsl.s / 100, hsl.l / 100); r = rgb.r; g = rgb.g; b = rgb.b; } }
    else if (mode === 'RGB') { b = Math.round(x * 255); }
    else if (isLabMode.value) { const vals = currentModeValues.value; if (!vals || !('a' in vals) || !('b' in vals)) return; const L = x * 100; let rgb; if (mode === 'OKLAB') rgb = oklabToRgb(L / 100, vals.a / 100, vals.b / 100); else rgb = labToRgb(L, vals.a, vals.b); r = rgb.r; g = rgb.g; b = rgb.b; }
    const hex = rgbToHex(r, g, b); pickerState.value.hex = hex; if (mode !== 'HSV') pickerState.value.hsv = rgbToHsv(r, g, b); applyColorToPalette(hex);
};
const startHueDrag = (e: MouseEvent) => { updateSliderPicker(e); const onMove = (evt: MouseEvent) => updateSliderPicker(evt); const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); };

const startSplitDrag = (e: MouseEvent) => { isDraggingSplit.value = true; const onMove = (evt: MouseEvent) => { if (canvasMain.value) { const rect = canvasMain.value.getBoundingClientRect(); splitPercent.value = Math.max(0, Math.min(100, ((evt.clientX - rect.left) / rect.width) * 100)); } }; const onUp = () => { isDraggingSplit.value = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }; document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); };

const handleCanvasHover = (e: MouseEvent) => {
    if (canvasMain.value && activePalette.value.length) {
        const rect = canvasMain.value.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const x = Math.floor((e.clientX - rect.left) * (canvasMain.value.width / rect.width));
            const y = Math.floor((e.clientY - rect.top) * (canvasMain.value.height / rect.height));
            let ctx = (isSplitView.value && canvasOriginal.value && x < canvasMain.value.width * (splitPercent.value / 100)) ? canvasOriginal.value.getContext('2d') : canvasMain.value.getContext('2d');
            const p = ctx.getImageData(x, y, 1, 1).data;
            let minD = Infinity, best = -1;
            activePalette.value.forEach((c, i) => { const rgb = hexToRgb(c.hex); const d = rgbDistance(rgb, { r: p[0], g: p[1], b: p[2] }); if (d < minD) { minD = d; best = i; } });
            activeSwatchIndex.value = best;
        } else activeSwatchIndex.value = null;
    }
};
const handleCanvasLeave = () => activeSwatchIndex.value = null;
const handleWheel = (e: WheelEvent) => { if (!containerRef.value) return; const rect = containerRef.value.getBoundingClientRect(); const mX = e.clientX - rect.left, mY = e.clientY - rect.top; const oldS = scale.value; const newS = Math.min(Math.max(0.02, oldS * (1 + (e.deltaY > 0 ? -0.1 : 0.1))), 40); const iX = (mX - offset.value.x) / oldS, iY = (mY - offset.value.y) / oldS; offset.value = { x: mX - (iX * newS), y: mY - (iY * newS) }; scale.value = newS; };

const recomputeSegmentation = async () => {
    if (!originalImage.value) return;
    isComputingSeg.value = true;
    await nextTick();
    setTimeout(() => {
        const img = originalImage.value as HTMLImageElement;
        const w = img.width, h = img.height;
        if (segMethod.value === 'kmeans' || segMethod.value === 'kmeans-oklab') {
            const isOklab = segMethod.value === 'kmeans-oklab';

            // 1. Downscale for Speed
            const smallW = 100, smallH = Math.round(100 * (h / w));
            const c = document.createElement('canvas'); c.width = smallW; c.height = smallH;
            const ctxSmall = c.getContext('2d');
            if (!ctxSmall) return;
            ctxSmall.drawImage(img, 0, 0, smallW, smallH);
            const smallData = ctxSmall.getImageData(0, 0, smallW, smallH).data;

            // 2. Prepare Data Points (RGB or OKLAB)
            const points = [];
            for (let i = 0; i < smallData.length; i += 4) {
                if (isOklab) {
                    points.push(rgbToOklab(smallData[i], smallData[i + 1], smallData[i + 2]));
                } else {
                    points.push({ r: smallData[i], g: smallData[i + 1], b: smallData[i + 2] });
                }
            }

            // 3. Initialize Centroids (Random Pick)
            let centroids = [];
            for (let i = 0; i < segCount.value; i++) {
                centroids.push({ ...points[Math.floor(Math.random() * points.length)] });
            }

            // 4. K-Means Iterations
            const distFn = isOklab ? oklabDistance : rgbDistance;

            for (let iter = 0; iter < 5; iter++) {
                const sums: any[] = centroids.map(() => isOklab ? ({ L: 0, a: 0, b: 0, c: 0 }) : ({ r: 0, g: 0, b: 0, c: 0 }));

                for (let i = 0; i < points.length; i++) {
                    const p = points[i];
                    let minDist = Infinity, bestIdx = 0;
                    // Optimization: Unroll loop slightly or just simple loop
                    for (let ci = 0; ci < centroids.length; ci++) {
                        const d = distFn(p, centroids[ci]);
                        if (d < minDist) { minDist = d; bestIdx = ci; }
                    }

                    if (isOklab) {
                        sums[bestIdx].L += (p as any).L; sums[bestIdx].a += (p as any).a; sums[bestIdx].b += (p as any).b; sums[bestIdx].c++;
                    } else {
                        sums[bestIdx].r += (p as any).r; sums[bestIdx].g += (p as any).g; sums[bestIdx].b += (p as any).b; sums[bestIdx].c++;
                    }
                }

                // Update Centroids
                centroids = sums.map(s => {
                    if (s.c === 0) return isOklab ? { L: 0.5, a: 0, b: 0 } : { r: 128, g: 128, b: 128 }; // Fallback for empty cluster
                    if (isOklab) return { L: s.L / s.c, a: s.a / s.c, b: s.b / s.c };
                    return { r: s.r / s.c, g: s.g / s.c, b: s.b / s.c };
                });
            }

            // 5. Sort Centroids by Lightness/Luminance for consistent mapping
            if (isOklab) {
                centroids.sort((a, b) => a.L - b.L);
                // Convert back to RGB for UI/Matching
                segCentroids.value = centroids.map(o => oklabToRgb(o.L, o.a, o.b));
            } else {
                centroids.sort((a, b) => (0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b) - (0.2126 * b.r + 0.7152 * b.g + 0.0722 * b.b));
                segCentroids.value = centroids;
            }

            // 6. Generate Full Resolution Map
            const fullC = document.createElement('canvas'); fullC.width = w; fullC.height = h;
            const fullCtx = fullC.getContext('2d');
            if (!fullCtx) return;
            fullCtx.drawImage(img, 0, 0);
            const fullData = fullCtx.getImageData(0, 0, w, h).data;
            const map = new Uint8Array(w * h);

            for (let i = 0; i < fullData.length; i += 4) {
                let p;
                if (isOklab) p = rgbToOklab(fullData[i], fullData[i + 1], fullData[i + 2]);
                else p = { r: fullData[i], g: fullData[i + 1], b: fullData[i + 2] };

                let minDist = Infinity, bestIdx = 0;
                for (let ci = 0; ci < centroids.length; ci++) {
                    const d = distFn(p, centroids[ci]);
                    if (d < minDist) { minDist = d; bestIdx = ci; }
                }
                map[i / 4] = bestIdx;
            }
            segMap.value = map;
        } else {
            // Luminance Mode
            segMap.value = null;
            const centroids = [];
            for (let i = 0; i < segCount.value; i++) { const val = ((i + 0.5) / segCount.value) * 255; centroids.push({ r: val, g: val, b: val }); }
            segCentroids.value = centroids;
        }
        isComputingSeg.value = false;
        processImage();
    }, 50);
};

const processImage = () => {
    if (!originalImage.value || !canvasMain.value || !canvasOriginal.value) return;
    const img = originalImage.value;
    const ctx = canvasMain.value.getContext('2d', { willReadFrequently: true });
    const ctxOrig = canvasOriginal.value.getContext('2d');
    if (!ctx || !ctxOrig) return;
    if (canvasMain.value.width !== img.width) {
        canvasMain.value.width = img.width; canvasMain.value.height = img.height;
        canvasOriginal.value.width = img.width; canvasOriginal.value.height = img.height;
        ctxOrig.drawImage(img, 0, 0);
    }
    if (activePalette.value.length < 1) { usedIndices.value = new Set(); return; }
    try {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        const pal = activePalette.value.map(c => { const i = parseInt(c.hex.replace('#', ''), 16); return [(i >> 16) & 255, (i >> 8) & 255, i & 255]; });
        const segments = segCount.value;
        const map = segMap.value;
        const isAnyKMeans = (segMethod.value === 'kmeans' || segMethod.value === 'kmeans-oklab') && map && map.length === (img.width * img.height);
        const usage = new Set<number>();
        for (let i = 0; i < data.length; i += 4) {
            let segIdx = 0;
            if (isAnyKMeans && map) {
                segIdx = map[i / 4];
            } else {
                // Luminance mode
                segIdx = Math.min(segments - 1, Math.floor(((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.1 * data[i + 2]) / 256) * segments));
            }

            let palIdx = segments !== pal.length ? Math.min(pal.length - 1, Math.floor(segIdx * (pal.length / segments))) : segIdx;
            usage.add(palIdx);
            const t = pal[palIdx] || pal[0];
            data[i] = t[0]; data[i + 1] = t[1]; data[i + 2] = t[2];
        }
        ctx.putImageData(new ImageData(data, img.width, img.height), 0, 0);
        usedIndices.value = usage;
    } catch (e) { console.error(e); }
};

const updateColorFromSlider = (key: string, val: number | string) => {
    const vNum = typeof val === 'string' ? parseFloat(val) : val;
    let { r, g, b } = hexToRgb(pickerState.value.hex);
    if (pickerMode.value === 'RGB') { const c: any = { r, g, b }; c[key] = vNum; r = c.r; g = c.g; b = c.b; }
    else if (pickerMode.value === 'HSV') { const c: any = { ...pickerState.value.hsv }; c[key] = vNum; const rgb = hsvToRgb(c.h / 360, c.s / 100, c.v / 100); r = rgb.r; g = rgb.g; b = rgb.b; }
    else if (pickerMode.value === 'HSL') { const c: any = rgbToHsl(r, g, b); c[key] = vNum; const rgb = hslToRgb(c.h / 360, c.s / 100, c.l / 100); r = rgb.r; g = rgb.g; b = rgb.b; }
    const hex = rgbToHex(r, g, b);
    pickerState.value.hex = hex;
    pickerState.value.hsv = rgbToHsv(r, g, b);
    applyColorToPalette(hex);
};

const sortPalette = (method: string) => {
    const items = activePalette.value;
    const unlocked = items.filter(i => !i.locked);
    const lockedMap = items.map((item, idx) => item.locked ? { item, idx } : null).filter(x => x);
    if (method === 'reverse') unlocked.reverse();
    else if (method === 'random') unlocked.sort(() => Math.random() - 0.5);
    else if (method === 'match') {
        const targets = segCentroids.value;
        if (targets.length === 0) return; // Guard
        const reordered = []; const sourcePool = [...unlocked];
        for (let i = 0; i < unlocked.length; i++) {
            const tIdx = Math.floor(i * (targets.length / unlocked.length));
            const target = targets[Math.min(tIdx, targets.length - 1)];
            let bestIdx = -1, minDist = Infinity;
            sourcePool.forEach((p, pi) => { const pc = hexToRgb(p.hex); const d = (pc.r - target.r) ** 2 + (pc.g - target.g) ** 2 + (pc.b - target.b) ** 2; if (d < minDist) { minDist = d; bestIdx = pi; } });
            if (bestIdx !== -1) { reordered.push(sourcePool[bestIdx]); sourcePool.splice(bestIdx, 1); }
        }
        unlocked.splice(0, unlocked.length, ...reordered as any[]);
    }
    else if (['luminance', 'hue', 'saturation', 'mean', 'red', 'green', 'blue', 'center'].includes(method)) {
        unlocked.sort((a, b) => {
            const getVal = (hex: string) => {
                const { r, g, b } = hexToRgb(hex);
                if (method === 'luminance') return 0.2126 * r + 0.7152 * g + 0.0722 * b;
                if (method === 'mean') return (r + g + b) / 3;
                if (method === 'red') return r;
                if (method === 'green') return g;
                if (method === 'blue') return b;
                if (method === 'center') return Math.sqrt((r - 128) ** 2 + (g - 128) ** 2 + (b - 128) ** 2);
                const max = Math.max(r, g, b), min = Math.min(r, g, b);
                if (method === 'saturation') return max === 0 ? 0 : (max - min) / max;
                if (method === 'hue') { if (max === min) return 0; let h = (max === r) ? (g - b) / (max - min) : (max === g) ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min); return h < 0 ? h + 6 : h; }
                return 0;
            };
            return (getVal(a.hex) || 0) - (getVal(b.hex) || 0);
        });
    }
    let uIdx = 0; const newArr = [];
    for (let i = 0; i < items.length; i++) { const l = lockedMap.find(x => x.idx === i); newArr.push(l ? l.item : unlocked[uIdx++]); }
    activePalette.value = newArr; syncToRaw(); processImage();
};

const handleDragEnter = (e: DragEvent) => { e.preventDefault(); if (!dragOver.value && e.dataTransfer && e.dataTransfer.types.includes('Files')) dragOver.value = true; };
const handleDragLeave = (e: DragEvent) => { if (e.relatedTarget === null || !appContainer.value?.contains(e.relatedTarget)) dragOver.value = false; };
const handleDrop = (e: DragEvent) => { dragOver.value = false; if (e.dataTransfer && e.dataTransfer.files.length) { const r = new FileReader(); r.onload = v => loadImage((v.target as FileReader).result as string); r.readAsDataURL(e.dataTransfer.files[0]); } else if (e.dataTransfer) { const u = e.dataTransfer.getData('URL'); if (u) loadImage(u, true); } };
const loadImage = (src: string, isExt = false) => { isLoading.value = true; error.value = ""; const i = new Image(); if (isExt) i.crossOrigin = "anonymous"; i.onload = () => { originalImage.value = i; uiState.value.showUpload = false; nextTick(() => { const cw = containerRef.value?.clientWidth || 800; const ch = containerRef.value?.clientHeight || 600; const ns = Math.min((cw - 50) / i.width, (ch - 50) / i.height, 1); scale.value = ns; offset.value = { x: (cw - i.width * ns) / 2, y: (ch - i.height * ns) / 2 }; recomputeSegmentation(); }); isLoading.value = false; }; i.onerror = () => { error.value = "Failed"; isLoading.value = false; }; i.src = src; };
const resetView = () => { if (originalImage.value) loadImage(originalImage.value.src); };
const syncSegToPalette = () => { if (activePalette.value.length) segCount.value = activePalette.value.length; recomputeSegmentation(); };
const toggleLock = (i: number) => activePalette.value[i].locked = !activePalette.value[i].locked;
const getMin = (k: string) => (pickerMode.value === 'OKLAB' || pickerMode.value === 'LAB') ? (k === 'L' ? 0 : -128) : 0;
const getMax = (k: string) => (pickerMode.value.includes('L') && k !== 'L') ? 127 : (pickerMode.value === 'RGB' ? 255 : (k === 'h' ? 360 : 100));
const getStep = () => 1;
const drawVisualCanvas = () => { if (!visualCanvas.value || !isLabMode.value) return; const ctx = visualCanvas.value.getContext('2d'); if (!ctx) return; const w = 64, h = 64; const imgData = ctx.createImageData(w, h); const d = imgData.data; const v = currentModeValues.value; if (!v || !('L' in v)) return; const L = v.L; const isOk = pickerMode.value === 'OKLAB'; for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const a = (x / w) * 255 - 128; const b = ((h - y) / h) * 255 - 128; let rgb = isOk ? oklabToRgb(L / 100, a / 100, b / 100) : labToRgb(L, a, b); const idx = (y * w + x) * 4; d[idx] = rgb.r; d[idx + 1] = rgb.g; d[idx + 2] = rgb.b; d[idx + 3] = 255; } } ctx.putImageData(imgData, 0, 0); };
const handleFileChange = (e: Event) => { const files = (e.target as HTMLInputElement).files; if (files && files[0]) { const r = new FileReader(); r.onload = v => loadImage((v.target as FileReader).result as string); r.readAsDataURL(files[0]); } };
const handlePaste = (e: ClipboardEvent) => { if (!e.clipboardData) return; for (let i of e.clipboardData.items) if (i.type.indexOf("image") !== -1) { const b = i.getAsFile(); if (!b) continue; const r = new FileReader(); r.onload = v => loadImage((v.target as FileReader).result as string); r.readAsDataURL(b); } };
const loadUrl = () => { if (imageUrlInput.value) loadImage(imageUrlInput.value, true); };

const globalMouseUp = () => {
    if (dragState.value.isPending) selectSwatch(dragState.value.id, dragState.value.color);
    dragState.value.isDragging = false; dragState.value.isPending = false; isPickerDragging.value = false; isHueDragging.value = false; isDraggingSplit.value = false; isPanning.value = false; syncToRaw();
};

const globalMouseMove = (e: MouseEvent) => {
    // Central coordination logic if needed
};

watch(activePalette, () => processImage(), { deep: true });
watch([pickerMode, currentModeValues], () => { if (isLabMode.value) nextTick(drawVisualCanvas); });
onMounted(() => { syncFromRaw(); });
</script>

<template>

    <div id="app" ref="appContainer" class="p-2 w-full h-screen flex flex-col gap-2 relative" @paste="handlePaste"
        @dragenter.prevent="handleDragEnter" @dragover.prevent @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop" @mouseup="globalMouseUp" @mousemove="globalMouseMove">
        <!-- Ghost Element for Custom Drag -->
        <div v-if="dragState.isDragging" class="drag-ghost w-12 h-12 rounded-lg border-2 border-white" :style="{
            left: dragState.x + 'px',
            top: dragState.y + 'px',
            backgroundColor: dragState.color
        }"></div>

        <!-- Drag Over Overlay -->
        <div v-show="dragOver" class="fixed inset-0 z-50 drag-target-indicator flex items-center justify-center">
            <div class="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl animate-pulse text-xl">
                Drop image to load
            </div>
        </div>

        <!-- Top Section: Upload & Palette -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 shrink-0">

            <!-- 1. Upload Image (Collapsible) -->
            <div class="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col transition-all">
                <div @click="uiState.showUpload = !uiState.showUpload"
                    class="px-3 py-2 bg-slate-900/50 flex justify-between items-center cursor-pointer hover:bg-slate-700/50 transition select-none">
                    <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Upload class="w-3 h-3" /> Upload
                    </h2>
                    <ChevronUp v-if="uiState.showUpload" class="w-3 h-3 text-slate-500" />
                    <ChevronDown v-else class="w-3 h-3 text-slate-500" />
                </div>

                <div v-show="uiState.showUpload" class="p-3 flex flex-col gap-2">
                    <div class="flex gap-2">
                        <button @click="$refs.fileInput.click()"
                            class="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-xs font-medium transition disabled:opacity-50 whitespace-nowrap"
                            :disabled="isLoading">
                            {{ isLoading ? '...' : 'Choose File' }}
                        </button>
                        <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileChange">
                        <input v-model="imageUrlInput" type="text" placeholder="Or enter URL..."
                            class="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 flex-grow text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            @keyup.enter="loadUrl">
                        <button @click="loadUrl" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs"
                            :disabled="isLoading">Load</button>
                    </div>
                    <p v-if="error" class="text-[10px] text-red-400 font-medium">{{ error }}</p>
                </div>
            </div>

            <!-- 2. Palette & Segmentation (Collapsible, Side-by-Side Layout) -->
            <div
                class="lg:col-span-2 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col transition-all">
                <div @click="uiState.showPalette = !uiState.showPalette"
                    class="px-3 py-2 bg-slate-900/50 flex justify-between items-center cursor-pointer hover:bg-slate-700/50 transition select-none">
                    <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Palette class="w-3 h-3" /> Palette & Settings
                    </h2>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-slate-500">{{ activePalette.length }} colors <span
                                v-if="usedIndices.size > 0">({{ usedIndices.size }} used)</span></span>
                        <ChevronUp v-if="uiState.showPalette" class="w-3 h-3 text-slate-500" />
                        <ChevronDown v-else class="w-3 h-3 text-slate-500" />
                    </div>
                </div>

                <div v-show="uiState.showPalette" class="p-3 flex gap-3">
                    <!-- LEFT: Text Entry (Expands) -->
                    <div class="flex-grow flex flex-col gap-1 min-w-0">
                        <textarea v-model="paletteRaw" placeholder="#ff0000, #00ff00..."
                            class="w-full h-full min-h-[80px] bg-slate-900 border border-slate-700 rounded px-2 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                            @input="onRawInput"></textarea>
                    </div>

                    <!-- RIGHT: Controls (Fixed Width Column) -->
                    <div class="w-64 shrink-0 flex flex-col gap-2">
                        <!-- Segmentation -->
                        <div
                            class="flex items-center gap-1 bg-slate-900/50 p-1.5 rounded-lg border border-slate-700/50">
                            <span class="text-[9px] font-bold uppercase text-slate-500 px-1">Seg:</span>
                            <select v-model="segMethod" @change="recomputeSegmentation"
                                class="bg-slate-800 border border-slate-700 text-[10px] rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none flex-grow">
                                <option value="luminance">Lum Band</option>
                                <option value="kmeans">K-Means (RGB)</option>
                                <option value="kmeans-oklab">K-Means (OKLAB)</option>
                            </select>

                            <div class="w-px h-4 bg-slate-700 mx-1"></div>

                            <input type="number" v-model.number="segCount" min="2" max="64"
                                class="w-8 bg-slate-800 border border-slate-700 text-[10px] rounded px-1 py-0.5 text-center outline-none"
                                @change="recomputeSegmentation">

                            <button @click="syncSegToPalette"
                                class="px-0.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] transition"
                                title="Sync Segments to Palette Count">
                                <RefreshCw class="w-4 h-4" />
                            </button>

                            <span v-if="isComputingSeg"
                                class="ml-auto text-[9px] text-blue-400 animate-pulse">...</span>
                        </div>

                        <!-- Sorting Toolbar -->
                        <div class="flex flex-col gap-2 border-t border-slate-700 pt-2">
                            <!-- Row 1: Match | HSL Group | RGB Group | Dist/Avg -->
                            <div class="flex flex-wrap gap-2 items-center">
                                <!-- Match (Left) -->
                                <button @click="sortPalette('match')"
                                    class="px-2 py-0.5 bg-indigo-900/40 border border-indigo-700 text-indigo-200 hover:bg-indigo-800/40 rounded text-[10px] font-medium transition flex items-center justify-center gap-1 min-w-[60px]"
                                    title="Sort Palette to Match Image Colors">
                                    <Wand2 class="w-3 h-3" /> Match
                                </button>

                                <div class="w-px h-3 bg-slate-700 mx-1"></div>

                                <!-- HSL Group (Mimicking RGB Look) -->
                                <div class="flex gap-0.5">
                                    <button @click="sortPalette('hue')"
                                        class="px-1.5 py-0.5 bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded text-[9px] min-w-[20px]"
                                        title="Sort by Hue">H</button>
                                    <button @click="sortPalette('saturation')"
                                        class="px-1.5 py-0.5 bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded text-[9px] min-w-[20px]"
                                        title="Sort by Saturation">S</button>
                                    <button @click="sortPalette('luminance')"
                                        class="px-1.5 py-0.5 bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 rounded text-[9px] min-w-[20px]"
                                        title="Sort by Luminance">L</button>
                                </div>

                                <!-- RGB Group -->
                                <div class="flex gap-0.5">
                                    <button @click="sortPalette('red')"
                                        class="px-1.5 py-0.5 bg-red-900/30 border border-red-800 text-red-300 hover:bg-red-900/50 rounded text-[9px] min-w-[20px]"
                                        title="Sort by Red">R</button>
                                    <button @click="sortPalette('green')"
                                        class="px-1.5 py-0.5 bg-green-900/30 border border-green-800 text-green-300 hover:bg-green-900/50 rounded text-[9px] min-w-[20px]"
                                        title="Sort by Green">G</button>
                                    <button @click="sortPalette('blue')"
                                        class="px-1.5 py-0.5 bg-blue-900/30 border border-blue-800 text-blue-300 hover:bg-blue-900/50 rounded text-[9px] min-w-[20px]"
                                        title="Sort by Blue">B</button>
                                </div>

                                <!-- Dist/Avg -->
                                <div class="flex gap-0.5 ml-auto sm:ml-0">
                                    <button @click="sortPalette('center')"
                                        class="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[9px]"
                                        title="Distance from Grey">
                                        <Target class="w-3 h-3" />
                                    </button>
                                    <button @click="sortPalette('mean')"
                                        class="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[9px]"
                                        title="Average Intensity">
                                        <Activity class="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            <!-- Row 2: Status | Shuffle/Reverse -->
                            <div class="flex justify-between items-center">
                                <div class="text-[10px] text-slate-500 font-mono pl-1">
                                    {{ activePalette.length }} colors <span v-if="usedIndices.size > 0">({{
                                        usedIndices.size }} used)</span>
                                </div>
                                <div class="flex gap-1">
                                    <button @click="sortPalette('random')"
                                        class="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] flex items-center gap-1"
                                        title="Random">
                                        <Shuffle class="w-3 h-3" /> Mix
                                    </button>
                                    <button @click="sortPalette('reverse')"
                                        class="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] flex items-center gap-1"
                                        title="Reverse">
                                        <ArrowLeftRight class="w-3 h-3" />
                                        Rev
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 3. Swatches & Inspector (Collapsible) -->
        <div
            class="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col shrink-0 transition-all">
            <div @click="uiState.showSwatches = !uiState.showSwatches"
                class="px-3 py-1.5 bg-slate-900/50 flex justify-between items-center cursor-pointer hover:bg-slate-700/50 transition select-none border-b border-slate-700">
                <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Grid class="w-3 h-3" /> Swatches & Inspector
                </h2>
                <ChevronUp v-if="uiState.showSwatches" class="w-3 h-3 text-slate-500" />
                <ChevronDown v-else class="w-3 h-3 text-slate-500" />
            </div>

            <div v-show="uiState.showSwatches" class="flex h-32 md:h-40">
                <!-- Swatches List -->
                <div class="flex-grow p-2 overflow-y-auto palette-scroll relative select-none bg-slate-800/50">
                    <div v-if="activePalette.length" class="flex flex-wrap gap-1.5">
                        <div v-for="(color, index) in activePalette" :key="color.id"
                            class="swatch-item group relative flex flex-col items-center gap-0.5" :class="{
                                'is-dragging': dragState.isDragging && dragState.id === color.id,
                                'scale-110 z-10': hoveredIndex === index && !dragState.isDragging,
                                'is-selected': selectedSwatchId === color.id
                            }" @mouseenter="hoveredIndex = index" @mouseleave="hoveredIndex = null"
                            @mousedown="startSwatchInteraction($event, index, color)">
                            <div class="color-box w-8 h-8 md:w-10 md:h-10 rounded border border-slate-600 shadow-sm transition-all relative ring-offset-2 ring-offset-slate-800"
                                :class="[
                                    usedIndices.has(index) ? 'border-green-500/50' : '',
                                    color.locked ? 'ring-1 ring-yellow-500/80' : '',
                                    activeSwatchIndex === index ? 'ring-2 ring-white scale-105' : '',
                                    selectedSwatchId === color.id ? 'ring-2 ring-blue-500' : ''
                                ]" :style="{ backgroundColor: color.hex }">
                                <!-- Interactive Lock Button (Fixed) -->
                                <div class="absolute -top-2 -right-2 bg-slate-900 rounded-full p-0.5 shadow-md cursor-pointer transition-opacity z-20"
                                    :class="color.locked ? 'opacity-100 text-yellow-400' : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white'"
                                    @mousedown.stop="toggleLock(index)" title="Toggle Lock">
                                    <Lock v-if="color.locked" class="w-2.5 h-2.5" />
                                    <Unlock v-else class="w-2.5 h-2.5" />
                                </div>

                                <div v-if="usedIndices.has(index)"
                                    class="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full shadow-sm">
                                </div>
                            </div>
                            <span class="text-[8px] font-mono text-slate-500 truncate w-10 text-center"
                                :class="activeSwatchIndex === index ? 'text-white' : ''">
                                {{ color.hex }}
                            </span>
                        </div>
                    </div>
                    <div v-else class="flex items-center justify-center h-full text-slate-500 text-xs">No colors.</div>
                </div>

                <!-- Color Picker Panel -->
                <div class="w-64 shrink-0 border-l border-slate-700 bg-slate-800 flex flex-col text-xs">
                    <div class="flex-grow overflow-y-auto p-2 space-y-2" v-if="selectedSwatchId">
                        <!-- Visual Picker -->
                        <div class="flex gap-2 h-24">
                            <div ref="satValBox"
                                class="flex-grow rounded border border-slate-600 relative cursor-crosshair overflow-hidden"
                                :style="visualBoxStyle" @mousedown="startPickerDrag">
                                <canvas v-if="isLabMode" ref="visualCanvas" class="absolute inset-0 w-full h-full"
                                    width="64" height="64"></canvas>
                                <div class="absolute w-2 h-2 rounded-full border border-white shadow-sm -ml-1 -mt-1 pointer-events-none"
                                    :style="visualCursorStyle"></div>
                            </div>
                            <div class="w-4 rounded-full cursor-pointer overflow-hidden border border-slate-600 relative"
                                @mousedown="startHueDrag" :style="visualSliderBgStyle">
                                <div class="absolute left-0 right-0 h-1 bg-white border border-slate-400 shadow -mt-0.5 pointer-events-none"
                                    :style="{ top: (100 - visualSliderPos) + '%' }"></div>
                            </div>
                        </div>

                        <!-- Mode Tabs -->
                        <div class="flex bg-slate-900 rounded p-0.5 gap-0.5">
                            <button v-for="m in ['RGB', 'HSV', 'HSL', 'LAB', 'OKLAB']" :key="m" @click="pickerMode = m"
                                class="flex-1 py-0.5 rounded transition text-[9px]"
                                :class="pickerMode === m ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'">{{
                                    m }}</button>
                        </div>

                        <!-- Sliders -->
                        <div class="space-y-1.5">
                            <div v-for="(val, key) in currentModeValues" :key="key" class="flex items-center gap-1.5">
                                <span class="text-[9px] font-mono text-slate-400 w-4 uppercase text-right">{{ key
                                }}</span>
                                <input type="range" :min="getMin(key)" :max="getMax(key)" :step="getStep(key)"
                                    :value="val" @input="updateColorFromSlider(key, $event.target.value)"
                                    class="flex-grow h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
                                <input type="number" :value="Math.round(val)"
                                    @input="updateColorFromSlider(key, $event.target.value)"
                                    class="w-8 bg-slate-900 border border-slate-700 rounded text-[9px] text-center py-0.5 outline-none">
                            </div>
                        </div>
                    </div>
                    <div v-else
                        class="flex flex-col items-center justify-center h-full text-slate-500 text-xs p-2 text-center opacity-50">
                        Select a swatch
                    </div>
                </div>
            </div>
        </div>

        <!-- Viewport (Takes remaining space) -->
        <div
            class="relative flex-grow bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shadow-xl min-h-0">
            <!-- Controls -->
            <div class="absolute top-2 right-2 z-20 flex gap-1">
                <button @click="isSplitView = !isSplitView"
                    :class="['px-3 py-1.5 rounded text-xs font-medium transition shadow border', isSplitView ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700']">{{
                        isSplitView ? 'Unsplit' : 'Compare' }}</button>
                <button @click="resetView"
                    class="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-1.5 rounded text-xs font-medium shadow text-slate-300">Reset</button>
            </div>

            <!-- Canvas -->
            <div ref="containerRef" class="canvas-container w-full h-full relative" @wheel.prevent="handleWheel"
                @mousedown="startCanvasPan" @mousemove="handleCanvasHover" @mouseleave="handleCanvasLeave">
                <div ref="transformContainer" class="absolute top-0 left-0 origin-top-left" :style="transformStyle">
                    <canvas ref="canvasMain" class="shadow-2xl block"></canvas>
                    <div v-show="isSplitView"
                        class="absolute inset-0 overflow-hidden pointer-events-none border-r border-white/20"
                        :style="{ width: splitPercent + '%' }">
                        <canvas ref="canvasOriginal" class="max-w-none block"></canvas>
                    </div>
                    <div v-if="isSplitView"
                        class="absolute top-0 bottom-0 z-30 pointer-events-auto flex items-center justify-center cursor-col-resize group"
                        :style="{ left: splitPercent + '%', width: '40px', marginLeft: '-20px' }"
                        @mousedown.stop="startSplitDrag">
                        <div
                            class="absolute inset-y-0 w-0.5 bg-blue-500 group-hover:bg-blue-400 shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-colors">
                        </div>
                        <div
                            class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg font-bold text-[10px] ring-2 ring-slate-950 relative z-20 group-hover:scale-110 transition-transform">
                            ↔</div>
                    </div>
                </div>
            </div>

            <div v-if="!originalImage"
                class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 pointer-events-none p-6 text-center">
                <div v-if="isLoading" class="flex flex-col items-center gap-2">
                    <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p class="text-sm font-medium">Processing...</p>
                </div>
                <template v-else>
                    <div class="w-12 h-12 mb-2 rounded-full bg-slate-800 flex items-center justify-center">
                        <ImageIcon class="w-6 h-6 text-slate-600" />
                    </div>
                    <p class="text-lg font-bold text-slate-300">No Image</p>
                    <p class="text-xs max-w-xs mt-1">Paste, drag & drop, or choose a file.</p>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Base Canvas Styles */
.canvas-container {
    cursor: grab;
    overflow: hidden;
    background-color: #0f172a;
    position: relative;
    background-image:
        linear-gradient(45deg, #1e293b 25%, transparent 25%),
        linear-gradient(-45deg, #1e293b 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #1e293b 75%),
        linear-gradient(-45deg, transparent 75%, #1e293b 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

.canvas-container:active {
    cursor: grabbing;
}

/* UI Elements */
.palette-scroll::-webkit-scrollbar {
    width: 6px;
}

.palette-scroll::-webkit-scrollbar-track {
    background: transparent;
}

.palette-scroll::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 10px;
}

.drag-ghost {
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%) scale(1.1);
    opacity: 0.9;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
}

.swatch-item {
    transition: transform 0.1s, box-shadow 0.1s;
    user-select: none;
}

/* Removed old .lock-btn hover logic here, moved to inline class for clarity */
.swatch-item.is-locked {
    border-color: #f59e0b;
}

.swatch-item.is-dragging {
    opacity: 0.3;
    pointer-events: none;
}

/* High visibility selection ring */
.swatch-item.is-selected .color-box {
    box-shadow: 0 0 0 2px #3b82f6, 0 0 0 4px white;
    z-index: 10;
}

/* Drag Overlay */
.drag-target-indicator {
    pointer-events: none;
    border: 4px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.2);
    backdrop-filter: blur(4px);
}

/* Dynamic Visual Pickers */
.visual-box-hsv {
    background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
}

.visual-box-rgb {
    background-blend-mode: screen;
}

/* Transitions for Collapse */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* Hide Number Input Spinners */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

input[type=number] {
    appearance: textfield;
    -moz-appearance: textfield;
}
</style>
