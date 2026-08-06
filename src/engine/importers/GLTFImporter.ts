import type {
    SceneIR,
    Node,
    Mesh,
    Primitive,
    Geometry,
    Attribute,
    VertexFormat,
    Material,
    Image,
    Sampler,
    Texture,
    TextureRef,
    PbrMetallicRoughnessComponent,
    NormalMapComponent,
    OcclusionComponent,
    EmissiveComponent,
} from "./utils/IR.ts";

export interface GLTFParseResult {
    json: any;
    buffers: ArrayBuffer[];
}


// ── glTF constants ──────────────────────────────────────────────────────────

const GLComponentType = {
    BYTE: 5120,
    UNSIGNED_BYTE: 5121,
    SHORT: 5122,
    UNSIGNED_SHORT: 5123,
    UNSIGNED_INT: 5125,
    FLOAT: 5126,
} as const;

type GLComponentType = (typeof GLComponentType)[keyof typeof GLComponentType];

const GLTF_TYPE_COMPONENT_COUNT: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
};

const GLPrimitiveMode = {
    POINTS: 0,
    LINES: 1,
    TRIANGLES: 4,
    TRIANGLE_STRIP: 5,
    // LINE_LOOP (2), LINE_STRIP (3), TRIANGLE_FAN (6) intentionally omitted —
    // not in our Primitive.topology union, so there's nothing to name them
    // for. Unrecognized mode numbers (including these) fall through to the
    // "not supported" throw in importPrimitive via TOPOLOGY_BY_MODE lookup.
} as const;

type GLPrimitiveMode = (typeof GLPrimitiveMode)[keyof typeof GLPrimitiveMode];

const TOPOLOGY_BY_MODE: Partial<Record<GLPrimitiveMode, Primitive["topology"]>> = {
    [GLPrimitiveMode.POINTS]: "point-list",
    [GLPrimitiveMode.LINES]: "line-list",
    [GLPrimitiveMode.TRIANGLES]: "triangle-list",
    [GLPrimitiveMode.TRIANGLE_STRIP]: "triangle-strip",
    // LINE_LOOP, LINE_STRIP, TRIANGLE_FAN intentionally absent — not in our
    // Primitive.topology union. Importer throws rather than silently
    // mis-rendering (see importPrimitive).
};


const SIMPLE_ATTRIBUTE_MAP: Record<
    string,
    { irKey: string; componentCount: number; format: VertexFormat }
> = {
    POSITION: { irKey: "position", componentCount: 3, format: "float32x3" },
    NORMAL: { irKey: "normal", componentCount: 3, format: "float32x3" },
    TANGENT: { irKey: "tangent", componentCount: 4, format: "float32x4" },
};

// Attributes we know about but don't support yet — skip with a warning
// instead of failing the whole import. Skinning is explicitly deferred
// (see architecture doc, "Deferred" section) so this is expected, not a bug.
const KNOWN_DEFERRED_ATTRIBUTES = new Set(["JOINTS_0", "WEIGHTS_0"]);

// ── small local vec/quat helpers (dependency-free) ──────────────────────────

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

function decomposeMat4(m: number[]): { translation: Vec3; rotation: Quat; scale: Vec3 } {
    // m is column-major, glTF convention: m[12..14] = translation.
    const translation: Vec3 = [m[12], m[13], m[14]];

    let sx = Math.hypot(m[0], m[1], m[2]);
    const sy = Math.hypot(m[4], m[5], m[6]);
    const sz = Math.hypot(m[8], m[9], m[10]);

    // Determinant sign tells us if the basis is mirrored; if so, fold the
    // flip into one axis so decomposed scale reproduces the original matrix.
    const det =
        m[0] * (m[5] * m[10] - m[6] * m[9]) -
        m[1] * (m[4] * m[10] - m[6] * m[8]) +
        m[2] * (m[4] * m[9] - m[5] * m[8]);
    if (det < 0) sx = -sx;

    const scale: Vec3 = [sx, sy, sz];

    // Normalize the 3x3 rotation basis out of the scaled matrix.
    const invSx = sx !== 0 ? 1 / sx : 0;
    const invSy = sy !== 0 ? 1 / sy : 0;
    const invSz = sz !== 0 ? 1 / sz : 0;

    const r00 = m[0] * invSx, r01 = m[1] * invSx, r02 = m[2] * invSx;
    const r10 = m[4] * invSy, r11 = m[5] * invSy, r12 = m[6] * invSy;
    const r20 = m[8] * invSz, r21 = m[9] * invSz, r22 = m[10] * invSz;

    // Standard matrix -> quaternion (column-major rotation basis above).
    const trace = r00 + r11 + r22;
    let qx: number, qy: number, qz: number, qw: number;
    if (trace > 0) {
        const s = Math.sqrt(trace + 1.0) * 2;
        qw = 0.25 * s;
        qx = (r21 - r12) / s;
        qy = (r02 - r20) / s;
        qz = (r10 - r01) / s;
    } else if (r00 > r11 && r00 > r22) {
        const s = Math.sqrt(1.0 + r00 - r11 - r22) * 2;
        qw = (r21 - r12) / s;
        qx = 0.25 * s;
        qy = (r01 + r10) / s;
        qz = (r02 + r20) / s;
    } else if (r11 > r22) {
        const s = Math.sqrt(1.0 + r11 - r00 - r22) * 2;
        qw = (r02 - r20) / s;
        qx = (r01 + r10) / s;
        qy = 0.25 * s;
        qz = (r12 + r21) / s;
    } else {
        const s = Math.sqrt(1.0 + r22 - r00 - r11) * 2;
        qw = (r10 - r01) / s;
        qx = (r02 + r20) / s;
        qy = (r12 + r21) / s;
        qz = 0.25 * s;
    }

    return { translation, rotation: [qx, qy, qz, qw], scale };
}

// ── accessor reading ─────────────────────────────────────────────────────

interface RawAccessorRead {
    componentType: GLComponentType;
    componentCount: number;
    count: number;
    normalized: boolean;
    // one element per (component), length = count * componentCount
    values: Float64Array;
}

function componentTypeSize(t: GLComponentType): number {
    switch (t) {
        case GLComponentType.BYTE:
        case GLComponentType.UNSIGNED_BYTE:
            return 1;
        case GLComponentType.SHORT:
        case GLComponentType.UNSIGNED_SHORT:
            return 2;
        case GLComponentType.UNSIGNED_INT:
        case GLComponentType.FLOAT:
            return 4;
        default:
            throw new Error(`GLTFImporter: unknown accessor componentType ${t}`);
    }
}

// Resolves a bufferView's owning buffer via glTF's own `buffer` index
// convention (`bufferView.buffer` — required by spec, defaults to 0 in the
// rare case it's omitted). This is the one place that turns "which buffer"
// into an actual ArrayBuffer — everything upstream just passes `buffers[]`
// through unchanged.
function resolveBufferView(gltf: any, buffers: ArrayBuffer[], bufferViewIndex: number): ArrayBuffer {
    const bufferView = gltf.bufferViews?.[bufferViewIndex];
    if (!bufferView) {
        throw new Error(`GLTFImporter: bufferView ${bufferViewIndex} not found`);
    }
    const bufferIndex = bufferView.buffer ?? 0;
    const buffer = buffers[bufferIndex];
    if (!buffer) {
        throw new Error(
            `GLTFImporter: bufferView ${bufferViewIndex} references buffer ${bufferIndex}, which was not provided (buffers[] has ${buffers.length} entries)`,
        );
    }
    return buffer;
}

function readRawAccessor(gltf: any, buffers: ArrayBuffer[], accessorIndex: number): RawAccessorRead {
    const accessor = gltf.accessors?.[accessorIndex];
    if (!accessor) {
        throw new Error(`GLTFImporter: accessor ${accessorIndex} not found`);
    }
    if (accessor.sparse) {
        // Sparse accessors are a real glTF feature (used for morph targets and
        // large mostly-default buffers) but out of scope for v1 — deferred
        // alongside skinning/morph targets rather than half-implemented.
        throw new Error(
            `GLTFImporter: accessor ${accessorIndex} uses sparse storage, which is not supported yet (deferred, see architecture doc)`,
        );
    }

    const componentType: GLComponentType = accessor.componentType;
    const componentCount = GLTF_TYPE_COMPONENT_COUNT[accessor.type];
    if (!componentCount) {
        throw new Error(`GLTFImporter: unknown accessor type "${accessor.type}"`);
    }
    const count: number = accessor.count;
    const normalized: boolean = !!accessor.normalized;

    const values = new Float64Array(count * componentCount);

    if (accessor.bufferView === undefined) {
        // Valid glTF: accessor with no bufferView means "all zeros" (used for
        // sparse-only accessors, which we've already rejected above, or for
        // certain animation defaults). Zero-filled Float64Array already
        // satisfies this.
        return { componentType, componentCount, count, normalized, values };
    }

    const bufferView = gltf.bufferViews[accessor.bufferView];
    const bufferData = resolveBufferView(gltf, buffers, accessor.bufferView);

    const compSize = componentTypeSize(componentType);
    const elementSize = compSize * componentCount;
    const baseOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    // byteStride === 0/undefined means tightly packed; interleaved buffer
    // views (byteStride set) are read element-by-element at their stride.
    const stride = bufferView.byteStride ?? elementSize;

    const dv = new DataView(bufferData);

    for (let i = 0; i < count; i++) {
        const elementOffset = baseOffset + i * stride;
        for (let c = 0; c < componentCount; c++) {
            const byteOffset = elementOffset + c * compSize;
            let raw: number;
            switch (componentType) {
                case GLComponentType.BYTE:
                    raw = dv.getInt8(byteOffset);
                    break;
                case GLComponentType.UNSIGNED_BYTE:
                    raw = dv.getUint8(byteOffset);
                    break;
                case GLComponentType.SHORT:
                    raw = dv.getInt16(byteOffset, true);
                    break;
                case GLComponentType.UNSIGNED_SHORT:
                    raw = dv.getUint16(byteOffset, true);
                    break;
                case GLComponentType.UNSIGNED_INT:
                    raw = dv.getUint32(byteOffset, true);
                    break;
                case GLComponentType.FLOAT:
                    raw = dv.getFloat32(byteOffset, true);
                    break;
                default:
                    throw new Error(`GLTFImporter: unsupported componentType ${componentType}`);
            }
            values[i * componentCount + c] = normalized ? dequantize(raw, componentType) : raw;
        }
    }

    return { componentType, componentCount, count, normalized, values };
}

function dequantize(raw: number, componentType: GLComponentType): number {
    switch (componentType) {
        case GLComponentType.BYTE:
            return Math.max(raw / 127, -1);
        case GLComponentType.UNSIGNED_BYTE:
            return raw / 255;
        case GLComponentType.SHORT:
            return Math.max(raw / 32767, -1);
        case GLComponentType.UNSIGNED_SHORT:
            return raw / 65535;
        default:
            return raw; // FLOAT / UNSIGNED_INT are never marked normalized in valid glTF
    }
}

// Reads an accessor as a flat float32 attribute, dequantizing as needed.
// Used for all vertex attributes we support (position/normal/tangent/uv/color).
function readFloatAttribute(
    gltf: any,
    buffers: ArrayBuffer[],
    accessorIndex: number,
    expectedComponentCount: number,
): Float32Array {
    const raw = readRawAccessor(gltf, buffers, accessorIndex);
    if (raw.componentCount !== expectedComponentCount) {
        throw new Error(
            `GLTFImporter: accessor ${accessorIndex} has ${raw.componentCount} components, expected ${expectedComponentCount}`,
        );
    }
    return Float32Array.from(raw.values);
}

// Reads an accessor as vertex indices, upconverting UNSIGNED_BYTE to
// uint16 since our IR only distinguishes "uint16" | "uint32" (see ir.ts).
function readIndices(
    gltf: any,
    buffers: ArrayBuffer[],
    accessorIndex: number,
): { format: "uint16" | "uint32"; data: ArrayBuffer } {
    const raw = readRawAccessor(gltf, buffers, accessorIndex);
    if (raw.componentCount !== 1) {
        throw new Error(`GLTFImporter: index accessor ${accessorIndex} is not scalar`);
    }
    if (raw.componentType === GLComponentType.UNSIGNED_INT) {
        return { format: "uint32", data: Uint32Array.from(raw.values).buffer };
    }
    // BYTE/UNSIGNED_BYTE/SHORT/UNSIGNED_SHORT all fold into uint16 — indices
    // are never normalized in valid glTF, so raw values are already integers.
    return { format: "uint16", data: Uint16Array.from(raw.values).buffer };
}

// ── geometry ─────────────────────────────────────────────────────────────

function importGeometry(gltf: any, buffers: ArrayBuffer[], gltfPrimitive: any): Geometry {
    const attributes: Record<string, Attribute> = {};
    const gltfAttrs: Record<string, number> = gltfPrimitive.attributes ?? {};

    for (const [semantic, accessorIndex] of Object.entries(gltfAttrs)) {
        const simple = SIMPLE_ATTRIBUTE_MAP[semantic];
        if (simple) {
            const data = readFloatAttribute(gltf, buffers, accessorIndex, simple.componentCount);
            attributes[simple.irKey] = { format: simple.format, data: data.buffer as ArrayBuffer };
            continue;
        }

        const uvMatch = /^TEXCOORD_(\d+)$/.exec(semantic);
        if (uvMatch) {
            const data = readFloatAttribute(gltf, buffers, accessorIndex, 2);
            attributes[`uv${uvMatch[1]}`] = { format: "float32x2", data: data.buffer as ArrayBuffer };
            continue;
        }

        if (semantic === "COLOR_0") {
            // COLOR_0 may be VEC3 or VEC4 in glTF; normalize to vec4 (alpha=1)
            // so shader assembly always sees a consistent format.
            const accessor = gltf.accessors[accessorIndex as number];
            const componentCount = GLTF_TYPE_COMPONENT_COUNT[accessor.type];
            const raw = readFloatAttribute(gltf, buffers, accessorIndex, componentCount);
            if (componentCount === 4) {
                attributes["color0"] = { format: "float32x4", data: raw.buffer as ArrayBuffer };
            } else {
                const count = raw.length / 3;
                const vec4 = new Float32Array(count * 4);
                for (let i = 0; i < count; i++) {
                    vec4[i * 4 + 0] = raw[i * 3 + 0];
                    vec4[i * 4 + 1] = raw[i * 3 + 1];
                    vec4[i * 4 + 2] = raw[i * 3 + 2];
                    vec4[i * 4 + 3] = 1;
                }
                attributes["color0"] = { format: "float32x4", data: vec4.buffer };
            }
            continue;
        }

        if (KNOWN_DEFERRED_ATTRIBUTES.has(semantic)) {
            console.warn(`GLTFImporter: skipping "${semantic}" — skinning is deferred (see architecture doc)`);
            continue;
        }

        console.warn(`GLTFImporter: skipping unrecognized attribute "${semantic}"`);
    }

    if (!attributes["position"]) {
        throw new Error("GLTFImporter: primitive has no POSITION attribute");
    }

    let indices: Geometry["indices"];
    if (gltfPrimitive.indices !== undefined) {
        indices = readIndices(gltf, buffers, gltfPrimitive.indices);
    }

    // POSITION accessor min/max is required by spec when present; prefer it
    // over recomputing (cheaper, and authoritative per the source file).
    const posAccessor = gltf.accessors[gltfAttrs["POSITION"]];
    let boundingBox: Geometry["boundingBox"];
    if (posAccessor.min && posAccessor.max) {
        boundingBox = {
            min: [posAccessor.min[0], posAccessor.min[1], posAccessor.min[2]],
            max: [posAccessor.max[0], posAccessor.max[1], posAccessor.max[2]],
        };
    } else {
        const pos = new Float32Array(attributes["position"].data);
        const min: Vec3 = [Infinity, Infinity, Infinity];
        const max: Vec3 = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < pos.length; i += 3) {
            for (let c = 0; c < 3; c++) {
                min[c] = Math.min(min[c], pos[i + c]);
                max[c] = Math.max(max[c], pos[i + c]);
            }
        }
        boundingBox = { min, max };
    }

    return { attributes, indices, boundingBox };
}

// ── images / samplers / textures ────────────────────────────────────────

function decodeDataUri(uri: string): { mimeType: string; data: ArrayBuffer } {
    const match = /^data:([^;]+);base64,(.*)$/.exec(uri);
    if (!match) {
        throw new Error(`GLTFImporter: unsupported data URI format`);
    }
    const [, mimeType, base64] = match;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mimeType, data: bytes.buffer };
}

function importImage(gltf: any, buffers: ArrayBuffer[], gltfImage: any, index: number): Image {
    if (gltfImage.bufferView !== undefined) {
        const bufferData = resolveBufferView(gltf, buffers, gltfImage.bufferView);
        const bv = gltf.bufferViews[gltfImage.bufferView];
        const start = bv.byteOffset ?? 0;
        const data = bufferData.slice(start, start + bv.byteLength);
        const mimeType = gltfImage.mimeType ?? "application/octet-stream";
        return { mimeType, data };
    }

    if (typeof gltfImage.uri === "string" && gltfImage.uri.startsWith("data:")) {
        return decodeDataUri(gltfImage.uri);
    }

    // External image reference (image.uri points at a sibling file, e.g.
    // "texture.png"). Resolving that is a loader-level concern — the loader
    // would need to fetch the sibling asset and hand this importer either a
    // data URI or a bufferView-backed buffer, not a bare filename. Not
    // resolved here regardless of container (GLB or loose .gltf).
    throw new Error(
        `GLTFImporter: image ${index} references an external URI ("${gltfImage.uri}"), which this importer does not resolve — the loader must supply image data via bufferView or data URI`,
    );
}

// glTF WebGL-style filter enums.
const GL_NEAREST = 9728;
const GL_LINEAR = 9729;
const GL_NEAREST_MIPMAP_NEAREST = 9984;
const GL_LINEAR_MIPMAP_NEAREST = 9985;
const GL_NEAREST_MIPMAP_LINEAR = 9986;
const GL_LINEAR_MIPMAP_LINEAR = 9987;
const GL_CLAMP_TO_EDGE = 33071;
const GL_MIRRORED_REPEAT = 33648;
const GL_REPEAT = 10497;

function importSampler(gltfSampler: any): Sampler {
    // magFilter has no mip component — direct mapping, default linear.
    const magFilter: "nearest" | "linear" = gltfSampler.magFilter === GL_NEAREST ? "nearest" : "linear";

    // minFilter enum optionally bundles mip filtering; split it out. Default
    // (field unset) is linear/linear, matching the WireUpLayer default sampler.
    let minFilter: "nearest" | "linear" = "linear";
    let mipFilter: "nearest" | "linear" = "linear";
    switch (gltfSampler.minFilter) {
        case GL_NEAREST:
            minFilter = "nearest";
            break;
        case GL_LINEAR:
            minFilter = "linear";
            break;
        case GL_NEAREST_MIPMAP_NEAREST:
            minFilter = "nearest";
            mipFilter = "nearest";
            break;
        case GL_LINEAR_MIPMAP_NEAREST:
            minFilter = "linear";
            mipFilter = "nearest";
            break;
        case GL_NEAREST_MIPMAP_LINEAR:
            minFilter = "nearest";
            mipFilter = "linear";
            break;
        case GL_LINEAR_MIPMAP_LINEAR:
            minFilter = "linear";
            mipFilter = "linear";
            break;
        // undefined -> keep defaults (linear/linear)
    }

    const mapWrap = (mode: number | undefined): Sampler["addressModeU"] => {
        switch (mode) {
            case GL_CLAMP_TO_EDGE:
                return "clamp-to-edge";
            case GL_MIRRORED_REPEAT:
                return "mirror-repeat";
            case GL_REPEAT:
            case undefined:
            default:
                return "repeat"; // glTF default wrap mode
        }
    };

    return {
        minFilter,
        magFilter,
        mipFilter,
        addressModeU: mapWrap(gltfSampler.wrapS),
        addressModeV: mapWrap(gltfSampler.wrapT),
    };
}

// ── materials ────────────────────────────────────────────────────────────

function toTextureRef(gltfTextureInfo: any): TextureRef {
    return { index: gltfTextureInfo.index, texCoord: gltfTextureInfo.texCoord ?? 0 };
}

function importMaterial(gltfMaterial: any): Material {
    const components: Record<string, unknown> = {};

    const pbr = gltfMaterial.pbrMetallicRoughness ?? {};
    const pbrComponent: PbrMetallicRoughnessComponent = {
        baseColor: pbr.baseColorFactor ?? [1, 1, 1, 1],
        metallic: pbr.metallicFactor ?? 1,
        roughness: pbr.roughnessFactor ?? 1,
    };
    if (pbr.baseColorTexture) pbrComponent.baseColorTexture = toTextureRef(pbr.baseColorTexture);
    if (pbr.metallicRoughnessTexture) pbrComponent.metallicRoughnessTexture = toTextureRef(pbr.metallicRoughnessTexture);
    components.pbrMetallicRoughness = pbrComponent;

    if (gltfMaterial.normalTexture) {
        const normalMap: NormalMapComponent = {
            texture: toTextureRef(gltfMaterial.normalTexture),
            scale: gltfMaterial.normalTexture.scale ?? 1,
        };
        components.normalMap = normalMap;
    }

    if (gltfMaterial.occlusionTexture) {
        const occlusion: OcclusionComponent = {
            texture: toTextureRef(gltfMaterial.occlusionTexture),
            strength: gltfMaterial.occlusionTexture.strength ?? 1,
        };
        components.occlusion = occlusion;
    }

    const emissiveFactor: Vec3 = gltfMaterial.emissiveFactor ?? [0, 0, 0];
    if (gltfMaterial.emissiveTexture || emissiveFactor.some((c) => c !== 0)) {
        const emissive: EmissiveComponent = { color: emissiveFactor };
        if (gltfMaterial.emissiveTexture) emissive.texture = toTextureRef(gltfMaterial.emissiveTexture);
        components.emissive = emissive;
        // Note: KHR_materials_emissive_strength is not read here — deferred
        // alongside other material extensions until a concrete need arises.
    }

    return {
        components,
        alphaMode: normalizeAlphaMode(gltfMaterial.alphaMode),
        alphaCutoff: gltfMaterial.alphaMode === "MASK" ? gltfMaterial.alphaCutoff ?? 0.5 : undefined,
        doubleSided: gltfMaterial.doubleSided ?? false,
    };
}

function defaultMaterial(): Material {
    return {
        components: {
            pbrMetallicRoughness: {
                baseColor: [0.8, 0.8, 0.8, 1.0],
                metallic: 1,
                roughness: 1,
            } as PbrMetallicRoughnessComponent,
        },
        alphaMode: "opaque",
        doubleSided: false,
    };
}

// glTF alphaMode strings are uppercase; IR uses lowercase.
function normalizeAlphaMode(mode: string | undefined): Material["alphaMode"] {
    switch (mode) {
        case "MASK":
            return "mask";
        case "BLEND":
            return "blend";
        case "OPAQUE":
        default:
            return "opaque";
    }
}

// ── node tree ────────────────────────────────────────────────────────────

function importNode(gltf: any, nodeIndex: number, visiting: Set<number>): Node {
    if (visiting.has(nodeIndex)) {
        throw new Error(`GLTFImporter: cycle detected in node graph at node ${nodeIndex}`);
    }
    visiting.add(nodeIndex);

    const gltfNode = gltf.nodes[nodeIndex];

    let translation: Vec3 = [0, 0, 0];
    let rotation: Quat = [0, 0, 0, 1];
    let scale: Vec3 = [1, 1, 1];

    if (gltfNode.matrix) {
        const decomposed = decomposeMat4(gltfNode.matrix);
        translation = decomposed.translation;
        rotation = decomposed.rotation;
        scale = decomposed.scale;
    } else {
        if (gltfNode.translation) translation = gltfNode.translation;
        if (gltfNode.rotation) rotation = gltfNode.rotation;
        if (gltfNode.scale) scale = gltfNode.scale;
    }

    const children: Node[] = (gltfNode.children ?? []).map((childIndex: number) =>
        importNode(gltf, childIndex, visiting),
    );

    visiting.delete(nodeIndex);

    const node: Node = {
        translation,
        rotation,
        scale,
        children,
    };
    if (gltfNode.name) node.name = gltfNode.name;
    if (gltfNode.mesh !== undefined) node.mesh = gltfNode.mesh;
    return node;
}

// ── top-level import ─────────────────────────────────────────────────────

export class GLTFImporter {
    /**
     * Translate a parsed glTF document (JSON + resolved buffers) into IR.
     * Pure translation: no wrappers, no GPU resources, no content hashing.
     * Container-agnostic — see GLTFParseResult for what "resolved buffers"
     * means for GLB vs loose .gltf+.bin.
     */
    import(parseResult: GLTFParseResult): SceneIR {
        const { json: gltf, buffers } = parseResult;

        if (!gltf.asset || !gltf.asset.version?.startsWith("2.")) {
            throw new Error(`GLTFImporter: unsupported glTF version "${gltf.asset?.version}", expected 2.x`);
        }

        // -- images / samplers / textures: mirrored 1:1 so glTF indices carry
        //    over unchanged into SceneIR indices --
        const images: Image[] = (gltf.images ?? []).map((img: any, i: number) =>
            importImage(gltf, buffers, img, i),
        );
        const samplers: Sampler[] = (gltf.samplers ?? []).map(importSampler);
        const textures: Texture[] = (gltf.textures ?? []).map((t: any) => ({
            image: t.source,
            sampler: t.sampler, // may be undefined; WireUpLayer resolves the default
        }));

        // -- materials --
        const materials: Material[] = (gltf.materials ?? []).map((m: any) => importMaterial(m));
        let defaultMaterialIndex = -1;
        const getDefaultMaterialIndex = (): number => {
            if (defaultMaterialIndex === -1) {
                defaultMaterialIndex = materials.length;
                materials.push(defaultMaterial());
            }
            return defaultMaterialIndex;
        };

        // -- geometries / primitives / meshes: flatten glTF's inline
        //    mesh.primitives into IR's flat Geometry[]/Primitive[] arrays,
        //    with Mesh.primitives holding indices into the flat array --
        const geometries: Geometry[] = [];
        const primitives: Primitive[] = [];
        const meshes: Mesh[] = (gltf.meshes ?? []).map((gltfMesh: any) => {
            const primitiveIndices: number[] = gltfMesh.primitives.map((gltfPrimitive: any) => {
                const mode: GLPrimitiveMode = gltfPrimitive.mode ?? GLPrimitiveMode.TRIANGLES;
                const topology = TOPOLOGY_BY_MODE[mode];
                if (!topology) {
                    throw new Error(
                        `GLTFImporter: primitive mode ${mode} is not supported (only points/lines/triangles/triangle-strip)`,
                    );
                }

                const geometryIndex = geometries.length;
                geometries.push(importGeometry(gltf, buffers, gltfPrimitive));

                const materialIndex =
                    gltfPrimitive.material !== undefined ? gltfPrimitive.material : getDefaultMaterialIndex();

                const primitiveIndex = primitives.length;
                primitives.push({ geometry: geometryIndex, material: materialIndex, topology });
                return primitiveIndex;
            });
            return { primitives: primitiveIndices };
        });

        // -- node tree --
        const sceneIndex = gltf.scene ?? 0;
        let rootNodeIndices: number[];
        if (gltf.scenes && gltf.scenes[sceneIndex]) {
            rootNodeIndices = gltf.scenes[sceneIndex].nodes ?? [];
        } else if (gltf.nodes) {
            // Fallback for minimal files with no `scenes` array: treat every
            // node that's nobody's child as a root.
            const childIndices = new Set<number>();
            for (const n of gltf.nodes) {
                for (const c of n.children ?? []) childIndices.add(c);
            }
            rootNodeIndices = gltf.nodes.map((_: any, i: number) => i).filter((i: number) => !childIndices.has(i));
        } else {
            rootNodeIndices = [];
        }

        const roots: Node[] = rootNodeIndices.map((i) => importNode(gltf, i, new Set()));

        return { roots, geometries, materials, images, samplers, textures, primitives, meshes };
    }
}