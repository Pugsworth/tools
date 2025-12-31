/* General */

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);




/* Color */

export const rgbToHex = (r: number, g: number, b: number) => "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
export const hexToRgb = (hex: string) => { const i = parseInt(hex.replace('#', ''), 16); return { r: (i >> 16) & 255, g: (i >> 8) & 255, b: i & 255 }; };
export const parseColorStr = (str: string) => {
    if (!str) return null;
    const hexMatch = str.match(/(?:#)?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b/);
    if (hexMatch && hexMatch[1]) {
        let hex = hexMatch[1];
        if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
        return '#' + hex.toUpperCase();
    }
    const rgbMatch = str.match(/(?:rgb|color|)?[\(\{\[]?\s*([0-9\.]+)\s*,\s*([0-9\.]+)\s*,\s*([0-9\.]+)\s*[\)\}\]]?/);
    if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
        const r = parseFloat(rgbMatch[1]), g = parseFloat(rgbMatch[2]), b = parseFloat(rgbMatch[3]);
        const norm = (v: number) => (v <= 1.01 && str.includes('.')) ? Math.round(v * 255) : Math.round(v);
        return `#${((1 << 24) + (Math.max(0, Math.min(255, norm(r))) << 16) + (Math.max(0, Math.min(255, norm(g))) << 8) + Math.max(0, Math.min(255, norm(b)))).toString(16).slice(1).toUpperCase()}`;
    }
    return null;
};
export const rgbDistance = (c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }) => (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2;
// Simple squared euclidean distance for OKLAB components (L, a, b)
export const oklabDistance = (c1: { L: number; a: number; b: number }, c2: { L: number; a: number; b: number }) => (c1.L - c2.L) ** 2 + (c1.a - c2.a) ** 2 + (c1.b - c2.b) ** 2;

// Color Spaces
export const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s, v = max; const d = max - min; s = max === 0 ? 0 : d / max; if (max === min) h = 0; else { switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; }h /= 6; } return { h: h * 360, s: s * 100, v: v * 100 }; };
export const hsvToRgb = (h: number, s: number, v: number) => { let r = 0, g = 0, b = 0, i, f, p, q, t; h /= 360; s /= 100; v /= 100; i = Math.floor(h * 6); f = h * 6 - i; p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s); switch (i % 6) { case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break; case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break; case 4: r = t; g = p; b = v; break; case 5: r = v; g = p; b = q; break; } return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }; };
export const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s, l = (max + min) / 2; if (max === min) { h = s = 0; } else { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; }h /= 6; } return { h: h * 360, s: s * 100, l: l * 100 }; };
export const hslToRgb = (h: number, s: number, l: number) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) }; };
export const rgbToCmyk = (r: number, g: number, b: number) => { let c = 1 - (r / 255), m = 1 - (g / 255), y = 1 - (b / 255), k = Math.min(c, m, y); c = (c - k) / (1 - k) || 0; m = (m - k) / (1 - k) || 0; y = (y - k) / (1 - k) || 0; return { c: c * 100, m: m * 100, y: y * 100, k: k * 100 }; };
export const srgbToLinear = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const linearToSrgb = (v: number) => { const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(Math.max(0, Math.min(1, c)) * 255); };
export const rgbToOklab = (r: number, g: number, b: number) => { const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b); const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb; const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb; const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb; const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s); return { L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_, a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_, b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_ }; };
export const oklabToRgb = (L: number, a: number, b: number) => { const l_ = L + 0.3963377774 * a + 0.2158037573 * b; const m_ = L - 0.1055613458 * a - 0.0638541728 * b; const s_ = L - 0.0894841775 * a - 1.2914855480 * b; const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_; const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s; const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s; const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s; return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(bl) }; };
export const rgbToLab = (r: number, g: number, b: number) => { let rL = srgbToLinear(r), gL = srgbToLinear(g), bL = srgbToLinear(b); let x = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) / 0.95047, y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722), z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) / 1.08883; x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116; y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116; z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116; return { L: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) }; };
export const labToRgb = (L: number, a: number, b: number) => { let y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200; x = x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787; y = y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787; z = z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787; let r = x * 3.2406 + y * -1.5372 + z * -0.4986, g = x * -0.9689 + y * 1.8758 + z * 0.0415, bl = x * 0.0557 + y * -0.2040 + z * 1.0570; return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(bl) }; };