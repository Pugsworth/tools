import { rotatePoint, normalizeRect, pointInPolygon } from './geometry';

type Ctx = CanvasRenderingContext2D;

export const getSafeImageData = (ctx: Ctx, x: number, y: number, w: number, h: number) => {
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;
    const iX = Math.max(0, Math.floor(x));
    const iY = Math.max(0, Math.floor(y));
    const iR = Math.min(canvasW, Math.ceil(x + w));
    const iB = Math.min(canvasH, Math.ceil(y + h));
    const iW = iR - iX;
    const iH = iB - iY;
    if (iW <= 0 || iH <= 0) return null;
    try {
        return {
            data: ctx.getImageData(iX, iY, iW, iH).data,
            x: iX, y: iY, width: iW, height: iH
        };
    } catch (e) { return null; }
};

export const getAverageColorInCircle = (ctx: Ctx, cx: number, cy: number, radius: number) => {
    if (radius <= 0) return { r: 0, g: 0, b: 0, count: 0 };
    const x = cx - radius, y = cy - radius, size = radius * 2;
    const img = getSafeImageData(ctx, x, y, size, size);
    if (!img) return { r: 0, g: 0, b: 0, count: 0 };
    let rT = 0, gT = 0, bT = 0, count = 0;
    const rSq = radius * radius;
    for (let row = 0; row < img.height; row++) {
        const py = img.y + row, dy = py - cy;
        if (dy * dy > rSq) continue;
        for (let col = 0; col < img.width; col++) {
            const px = img.x + col, dx = px - cx;
            if (dx * dx + dy * dy <= rSq) {
                const idx = (row * img.width + col) * 4;
                rT += img.data[idx]; gT += img.data[idx + 1]; bT += img.data[idx + 2]; count++;
            }
        }
    }
    if (count === 0) return { r: 0, g: 0, b: 0, count: 1 };
    return { r: Math.round(rT / count), g: Math.round(gT / count), b: Math.round(bT / count), count, rT, gT, bT };
};

export const getAverageColorInRect = (ctx: Ctx, x: number, y: number, w: number, h: number, rotation = 0) => {
    const { x: nx, y: ny, w: nw, h: nh } = normalizeRect(x, y, w, h);
    const cx = nx + nw / 2, cy = ny + nh / 2;
    const p1 = rotatePoint(nx, ny, cx, cy, rotation);
    const p2 = rotatePoint(nx + nw, ny, cx, cy, rotation);
    const p3 = rotatePoint(nx + nw, ny + nh, cx, cy, rotation);
    const p4 = rotatePoint(nx, ny + nh, cx, cy, rotation);
    const poly = [p1, p2, p3, p4];
    const minX = Math.min(p1.x, p2.x, p3.x, p4.x), maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
    const minY = Math.min(p1.y, p2.y, p3.y, p4.y), maxY = Math.max(p1.y, p2.y, p3.y, p4.y);
    const img = getSafeImageData(ctx, minX, minY, maxX - minX, maxY - minY);
    if (!img) return { r: 0, g: 0, b: 0, count: 0 };
    let rT = 0, gT = 0, bT = 0, count = 0;
    for (let row = 0; row < img.height; row++) {
        const py = img.y + row;
        for (let col = 0; col < img.width; col++) {
            const px = img.x + col;
            if (pointInPolygon({ x: px, y: py }, poly)) {
                const idx = (row * img.width + col) * 4;
                rT += img.data[idx]; gT += img.data[idx + 1]; bT += img.data[idx + 2]; count++;
            }
        }
    }
    if (count === 0) return { r: 0, g: 0, b: 0, count: 0 };
    return { r: Math.round(rT / count), g: Math.round(gT / count), b: Math.round(bT / count), count, rT, gT, bT };
};
