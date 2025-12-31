export type RGBColor = {
    type: 'RGB';
    r: number; g: number; b: number;
};
export type HSVColor = {
    type: 'HSV';
    h: number; s: number; v: number;
};
export type HSLColor = {
    type: 'HSL';
    h: number; s: number; l: number;
};
export type CMYKColor = {
    type: 'CMYK';
    c: number; m: number; y: number; k: number;
};
export type OKLABColor = {
    type: 'OKLAB';
    L: number; a: number; b: number;
};
export type LABColor = {
    type: 'LAB';
    L: number; a: number; b: number;
};

export type ColorSpace = 'RGB' | 'HSV' | 'HSL' | 'CMYK' | 'OKLAB' | 'LAB';

export type Color = RGBColor | HSVColor | HSLColor | CMYKColor | OKLABColor | LABColor;