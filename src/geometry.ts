import type { Point, Rect, Shape } from "./types";

export const distance = (p1: Point, p2: Point): number => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));


export const rotatePoint = (px: number, py: number, cx: number, cy: number, angleDeg: number): Point => {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    return {
        x: cos * dx - sin * dy + cx,
        y: sin * dx + cos * dy + cy
    };
};

export const getQuadraticBezierPoint = (t: number, p0: Point, p1: Point, p2: Point): Point => {
    const oneMinusT = 1 - t;
    return {
        x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
        y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y
    };
};

export const pointInPolygon = (point: Point, vs: Point[]): boolean => {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const normalizeRect = (x: number, y: number, w: number, h: number): Rect => {
    let nx = x, ny = y, nw = w, nh = h;
    if (nw < 0) { nx += nw; nw = Math.abs(nw); }
    if (nh < 0) { ny += nh; nh = Math.abs(nh); }
    return { x: nx, y: ny, w: nw, h: nh };
};

export const getShapeBounds = (shape: Shape, padding = 0): Rect => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (shape.type === 'circle') {
        minX = shape.x - shape.r; maxX = shape.x + shape.r;
        minY = shape.y - shape.r; maxY = shape.y + shape.r;
    } else if (shape.type === 'rect') {
        const { x, y, w, h } = normalizeRect(shape.x, shape.y, shape.w, shape.h);
        if (shape.rotation) {
            const cx = x + w / 2, cy = y + h / 2;
            const pts = [
                rotatePoint(x, y, cx, cy, shape.rotation),
                rotatePoint(x + w, y, cx, cy, shape.rotation),
                rotatePoint(x + w, y + h, cx, cy, shape.rotation),
                rotatePoint(x, y + h, cx, cy, shape.rotation)
            ];
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });
        } else {
            minX = x; maxX = x + w;
            minY = y; maxY = y + h;
        }
    } else if (shape.type === 'line') {
        minX = Math.min(shape.x1, shape.x2); maxX = Math.max(shape.x1, shape.x2);
        minY = Math.min(shape.y1, shape.y2); maxY = Math.max(shape.y1, shape.y2);
        const extra = (shape.thickness || 10) / 2;
        minX -= extra; maxX += extra; minY -= extra; maxY += extra;
    } else if (shape.type === 'curve') {
        minX = Math.min(shape.p0.x, shape.p1.x, shape.p2.x);
        maxX = Math.max(shape.p0.x, shape.p1.x, shape.p2.x);
        minY = Math.min(shape.p0.y, shape.p1.y, shape.p2.y);
        maxY = Math.max(shape.p0.y, shape.p1.y, shape.p2.y);
        const extra = (shape.thickness || 10) / 2;
        minX -= extra; maxX += extra; minY -= extra; maxY += extra;
    } else if (shape.type === 'brush') {
        shape.points.forEach((p: Point) => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
    }

    return {
        x: Math.floor(minX - padding),
        y: Math.floor(minY - padding),
        w: Math.ceil(maxX - minX + padding * 2),
        h: Math.ceil(maxY - minY + padding * 2)
    };
};