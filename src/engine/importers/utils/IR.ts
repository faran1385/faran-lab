export const ATTR_POSITION = "position";
export const ATTR_NORMAL = "normal";
export const ATTR_TANGENT = "tangent";


export function uvAttributeName(index: number) {
    return `uv${index}` as `uv${number}`;
}

export function colorAttributeName(index: number) {
    return `color${index}` as `color${number}`;
}

export function jointsAttributeName(index: number) {
    return `joints${index}` as `joints${number}`;
}

export function weightsAttributeName(index: number) {
    return `weights${index}` as `weights${number}`;
}

const RESERVED_EXACT = new Set<string>([ATTR_POSITION, ATTR_NORMAL, ATTR_TANGENT]);
const RESERVED_NUMBERED_PATTERN = /^(uv|color|weights|joints)\d+$/;

export function isReservedAttributeName(name: string): boolean {
    return RESERVED_EXACT.has(name) || RESERVED_NUMBERED_PATTERN.test(name);
}

export function validateCustomAttributeName(name: string): void {
    if (isReservedAttributeName(name)) {
        throw new Error(
            `Attribute name "${name}" collides with a canonical vertex attribute name (position/normal/tangent/uvN/colorN/weightsN/jointsN) — custom attributes may not reuse reserved names.`,
        );
    }
}

export type AttributeName =
    | "position"
    | "normal"
    | "tangent"
    | `uv${number}`
    | `color${number}`
    | `joints${number}`
    | `weights${number}`;


export type VertexFormat =
    | "float32x2"
    | "float32x3"
    | "float32x4"
    | "uint16x2"
    | "uint32";

export interface Attribute {
    format: VertexFormat;
    data: ArrayBuffer;
}

export interface DecodedImage {
    width: number;
    height: number;
    data: ArrayBuffer;
}

export interface Geometry {
    attributes: Record<AttributeName, number>;
    indices?: { format: "uint16" | "uint32"; data: ArrayBuffer };
}

export interface Material {
    components: Record<string, MaterialComponentIR>;
    alphaMode: "opaque" | "mask" | "blend";
    alphaCutoff?: number;
    doubleSided: boolean;
}

export interface Sampler {
    minFilter: "nearest" | "linear";
    magFilter: "nearest" | "linear";
    mipFilter: "nearest" | "linear";
    addressModeU: "clamp-to-edge" | "repeat" | "mirror-repeat";
    addressModeV: "clamp-to-edge" | "repeat" | "mirror-repeat";
}

export interface Texture {
    image: number;
    sampler?: number;
}

export interface Primitive {
    geometry: number;
    material: number;
    topology: "triangle-list" | "triangle-strip" | "line-list" | "point-list";
}

export interface Mesh {
    primitives: number[]; // indices into Primitive[]
}

export interface Node {
    name?: string;
    mesh?: number;
    translation: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
    children: Node[];
}

export interface SceneIR {
    roots: Node[];
    geometries: Geometry[];
    materials: Material[];
    images: DecodedImage[];
    samplers: Sampler[];
    textures: Texture[];
    primitives: Primitive[];
    meshes: Mesh[];
    attributes: Attribute[];
}

export interface TextureRef {
    index: number;
    texCoord: `uv${number}`;
}

export interface MaterialComponentIR {
    factor:  number[];
    texture?: TextureRef
}