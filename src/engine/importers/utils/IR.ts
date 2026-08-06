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

export interface Geometry {
    attributes: Record<string, Attribute>;
    indices?: { format: "uint16" | "uint32"; data: ArrayBuffer };
    boundingBox?: { min: [number, number, number]; max: [number, number, number] };
}

export interface Material {
    components: Record<string, unknown>;
    alphaMode: "opaque" | "mask" | "blend";
    alphaCutoff?: number;
    doubleSided: boolean;
}

export interface Image {
    mimeType: string;
    data: ArrayBuffer;
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
    images: Image[];
    samplers: Sampler[];
    textures: Texture[];
    primitives: Primitive[];
    meshes: Mesh[];
}


export interface TextureRef {
    index: number;
    texCoord: number;
}

export interface PbrMetallicRoughnessComponent {
    baseColor: [number, number, number, number];
    metallic: number;
    roughness: number;
    baseColorTexture?: TextureRef;
    metallicRoughnessTexture?: TextureRef;
}

export interface NormalMapComponent {
    texture: TextureRef;
    scale: number;
}

export interface OcclusionComponent {
    texture: TextureRef;
    strength: number;
}

export interface EmissiveComponent {
    color: [number, number, number];
    texture?: TextureRef;
}