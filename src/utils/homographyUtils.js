export const solveGaussian = (A, b) => {
    const n = A.length;
    for (let i = 0; i < n; i++) {
        let maxEl = Math.abs(A[i][i]);
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(A[k][i]) > maxEl) {
                maxEl = Math.abs(A[k][i]);
                maxRow = k;
            }
        }
        for (let k = i; k < n; k++) {
            let tmp = A[maxRow][k];
            A[maxRow][k] = A[i][k];
            A[i][k] = tmp;
        }
        let tmp = b[maxRow];
        b[maxRow] = b[i];
        b[i] = tmp;
        for (let k = i + 1; k < n; k++) {
            let c = -A[k][i] / A[i][i];
            for (let j = i; j < n; j++) {
                if (i === j) A[k][j] = 0;
                else A[k][j] += c * A[i][j];
            }
            b[k] += c * b[i];
        }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i > -1; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
        x[i] = (b[i] - sum) / A[i][i];
    }
    return x;
};

export const getHomographyMatrix = (src, dst) => {
    let A = [];
    let b = [];
    for (let i = 0; i < 4; i++) {
        A.push([src[i].x, src[i].y, 1, 0, 0, 0, -src[i].x * dst[i].x, -src[i].y * dst[i].x]);
        b.push(dst[i].x);
        A.push([0, 0, 0, src[i].x, src[i].y, 1, -src[i].x * dst[i].y, -src[i].y * dst[i].y]);
        b.push(dst[i].y);
    }
    const x = solveGaussian(A, b);
    return [
        [x[0], x[1], x[2]],
        [x[3], x[4], x[5]],
        [x[6], x[7], 1]
    ];
};

export const applyMatrix = (H, x, y) => {
    const D = H[2][0] * x + H[2][1] * y + H[2][2];
    return {
        x: (H[0][0] * x + H[0][1] * y + H[0][2]) / D,
        y: (H[1][0] * x + H[1][1] * y + H[1][2]) / D
    };
};
