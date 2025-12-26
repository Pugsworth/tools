export const convolve = (data, width, height, kernel) => {
    const side = Math.round(Math.sqrt(kernel.length));
    const halfSide = Math.floor(side / 2);
    const src = new Uint8ClampedArray(data);
    const w = width;
    const h = height;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0;
            for (let cy = 0; cy < side; cy++) {
                for (let cx = 0; cx < side; cx++) {
                    const scy = y + cy - halfSide;
                    const scx = x + cx - halfSide;
                    if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                        const srcOff = (scy * w + scx) * 4;
                        const wt = kernel[cy * side + cx];
                        r += src[srcOff] * wt;
                        g += src[srcOff + 1] * wt;
                        b += src[srcOff + 2] * wt;
                    }
                }
            }
            // Clamp
            r = r < 0 ? 0 : r > 255 ? 255 : r;
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            b = b < 0 ? 0 : b > 255 ? 255 : b;

            const dstOff = (y * w + x) * 4;
            data[dstOff] = r;
            data[dstOff + 1] = g;
            data[dstOff + 2] = b;
            data[dstOff + 3] = src[dstOff + 3]; // Preserve alpha
        }
    }
};
