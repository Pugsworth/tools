export const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
export const add = (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y });
export const sub = (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y });
export const dot = (v1, v2) => v1.x * v2.x + v1.y * v2.y;
export const normalize = (v) => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
};
export const scaleVec = (v, s) => ({ x: v.x * s, y: v.y * s });

export const distToSegment = (p, v, w) => {
    const l2 = Math.pow(dist(v, w), 2);
    if (l2 === 0) return dist(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return dist(p, projection);
};

export const projectToSegment = (p, v, w) => {
    const l2 = Math.pow(dist(v, w), 2);
    if (l2 === 0) return v;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
};

export const getLineIntersection = (p1, p2, p3, p4) => {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-5) return null; // Parallel
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
};

export const areLinesParallel = (p1, p2, p3, p4, thresholdDegrees = 5) => {
    const v1 = normalize(sub(p2, p1));
    const v2 = normalize(sub(p4, p3));
    const d = Math.abs(dot(v1, v2));
    // dot product of 1 means parallel (0 degrees), -1 means parallel (180 degrees)
    // cos(5 degrees) approx 0.996
    const threshold = Math.cos(thresholdDegrees * Math.PI / 180);
    return d > threshold;
};

export const isPointInPolygon = (point, vs) => {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

export const projectPointToLine = (p, l1, l2) => {
    const dx = l2.x - l1.x;
    const dy = l2.y - l1.y;
    if (dx === 0 && dy === 0) return l1;
    const t = ((p.x - l1.x) * dx + (p.y - l1.y) * dy) / (dx * dx + dy * dy);
    return { x: l1.x + t * dx, y: l1.y + t * dy };
};
