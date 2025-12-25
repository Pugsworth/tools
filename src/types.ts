// Color
export type Color = {
    r: number;
    g: number;
    b: number;
    count?: number;
    rT?: number;
    gT?: number;
    bT?: number;
    shapeIds?: OpaqueID[];
    isGroup?: boolean;
};


// Geometry
export type Point = { x: number, y: number };

export type OpaqueID = string;

export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
};

export type Circle = {
    x: number;
    y: number;
    r: number;
};

export type Line = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    points?: Point[];
    samples: number;
    thickness: number;
    radii: number[];
    mergeColors: boolean;
    variableRadii: boolean;
};

export type Curve = {
    p0: Point;
    p1: Point;
    p2: Point;
    points?: Point[];
    samples: number;
    thickness: number;
    radii: number[];
    mergeColors: boolean;
    variableRadii: boolean;
};

export type Brush = {
    points: Point[];
    samples?: number;
    thickness?: number;
    color?: Color;
    opacity?: number;
    fill?: Color;
    fillOpacity?: number;
};

type ShapeBase = {
    id: OpaqueID;
    colors?: Color[]; // For raw samples/palette
    rawSamples?: any[]; // For computed palette
};

export type RectShape = ShapeBase & Rect & { type: 'rect' };
export type CircleShape = ShapeBase & Circle & { type: 'circle'; handleAngle?: number };
export type LineShape = ShapeBase & Line & { type: 'line' };
export type CurveShape = ShapeBase & Curve & { type: 'curve' };
export type BrushShape = ShapeBase & Brush & { type: 'brush' };

export type ShapeType = Shape['type'];

export type Shape = CircleShape | RectShape | LineShape | CurveShape | BrushShape;

export type Link = [OpaqueID, OpaqueID];

export type Group = {
    id: OpaqueID;
    shapes: OpaqueID[];
    links: Link[];
};

export type Patch = {
    x: number;
    y: number;
    w: number;
    h: number;
    data: string; // base64
};


export const MouseButton = {
    Left: 0,
    Right: 1,
    Middle: 2,
    Button4: 3,
    Button5: 4,
} as const;

export type MouseButton = typeof MouseButton[keyof typeof MouseButton];