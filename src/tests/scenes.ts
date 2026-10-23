import {AttributeWrapper} from "../engine/wrappers/AttributeWrapper.ts";
import {IndexAttributeWrapper} from "../engine/wrappers/IndexWrapper.ts";
import {GeometryWrapper} from "../engine/wrappers/GeometryWrapper.ts";
import {MaterialWrapper} from "../engine/wrappers/MaterialWrapper.ts";
import {MaterialComponentWrapper} from "../engine/wrappers/MaterialComponentWrapper.ts";
import {PrimitiveWrapper} from "../engine/wrappers/PrimitiveWrapper.ts";
import {MeshWrapper} from "../engine/wrappers/MeshWrapper.ts";
import {NodeWrapper} from "../engine/wrappers/NodeWrapper.ts";
import {TextureWrapper} from "../engine/wrappers/TextureWrapper.ts";
import {ImageWrapper} from "../engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "../engine/wrappers/SamplerWrapper.ts";
import {BasicFragmentAssembler, BasicVertexAssembler} from "../engine/Assemblers/BasicAssembler/BasicAssembler.ts";
import type {FragmentShaderDescriptor, VertexShaderDescriptor} from "../engine/producers/AssemblerProducers.ts";

export type Vec3 = [number, number, number];

// -- geometry ---------------------------------------------------------------------------------------------------

export interface GeometryOptions {
    /** Grid cells along x / y. A cell is two triangles. Default 1 x 1 (a quad). */
    cols?: number;
    rows?: number;
    /** Adds a `uv0` attribute (float32x2). */
    uv?: boolean;
    /** Shared vertices + an index buffer (uint16, or uint32 when the grid needs it) instead of 6 vertices per cell. */
    indexed?: boolean;
}

export interface GridData {
    positions: Float32Array;
    uvs?: Float32Array;
    indices?: Uint16Array | Uint32Array;
    vertexCount: number;
    triangleCount: number;
}

/**
 * A flat grid of unit size centred on the origin, facing +z. Triangles are counter-clockwise seen from +z, which is
 * what the default (back-face culling) pipelines draw.
 */
export function gridData(options: GeometryOptions = {}): GridData {
    const cols = options.cols ?? 1;
    const rows = options.rows ?? 1;
    const at = (c: number, r: number): [number, number] => [c / cols - 0.5, r / rows - 0.5];

    if (options.indexed) {
        const vertexCount = (cols + 1) * (rows + 1);
        const positions = new Float32Array(vertexCount * 3);
        const uvs = options.uv ? new Float32Array(vertexCount * 2) : undefined;
        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) {
                const i = r * (cols + 1) + c;
                const [x, y] = at(c, r);
                positions.set([x, y, 0], i * 3);
                uvs?.set([c / cols, 1 - r / rows], i * 2);
            }
        }
        const indices = vertexCount > 65535 ? new Uint32Array(cols * rows * 6) : new Uint16Array(cols * rows * 6);
        let k = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const a = r * (cols + 1) + c;
                const b = a + 1;
                const d = a + cols + 1;
                const e = d + 1;
                indices.set([a, b, e, a, e, d], k);
                k += 6;
            }
        }
        return {positions, uvs, indices, vertexCount, triangleCount: cols * rows * 2};
    }

    const vertexCount = cols * rows * 6;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = options.uv ? new Float32Array(vertexCount * 2) : undefined;
    let v = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const [x0, y0] = at(c, r);
            const [x1, y1] = at(c + 1, r + 1);
            const corners: Array<[number, number]> = [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]];
            for (const [x, y] of corners) {
                positions.set([x, y, 0], v * 3);
                uvs?.set([x + 0.5, 0.5 - y], v * 2);
                v++;
            }
        }
    }
    return {positions, uvs, vertexCount, triangleCount: cols * rows * 2};
}

export function positionAttribute(positions: Float32Array): AttributeWrapper {
    return new AttributeWrapper("position", positions.buffer as ArrayBuffer, "float32x3");
}

export function uvAttribute(uvs: Float32Array, name = "uv0"): AttributeWrapper {
    return new AttributeWrapper(name, uvs.buffer as ArrayBuffer, "float32x2");
}

export function makeGeometry(options: GeometryOptions = {}): GeometryWrapper {
    const data = gridData(options);
    const geometry = new GeometryWrapper();
    geometry.setAttribute(positionAttribute(data.positions));
    if (data.uvs) geometry.setAttribute(uvAttribute(data.uvs));
    if (data.indices) {
        geometry.setIndices(new IndexAttributeWrapper(data.indices.buffer as ArrayBuffer, data.indices instanceof Uint16Array ? "uint16" : "uint32"));
    }
    return geometry;
}

// -- textures ---------------------------------------------------------------------------------------------------

export function pixelBytes(size: number, rgba: [number, number, number, number]): ArrayBuffer {
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) data.set(rgba, i * 4);
    return data.buffer as ArrayBuffer;
}

export function makeTexture(size = 2, rgba: [number, number, number, number] = [255, 0, 0, 255]): TextureWrapper {
    return new TextureWrapper(new ImageWrapper(pixelBytes(size, rgba), size, size), new SamplerWrapper());
}

// -- materials --------------------------------------------------------------------------------------------------

export interface MaterialOptions {
    color?: Vec3;
    alphaMode?: "opaque" | "mask" | "blend";
    alphaCutoff?: number;
    /** Default true: a double-sided opaque material is drawn with cullMode "none", so winding can never hide a test shape. */
    doubleSided?: boolean;
    texture?: TextureWrapper;
    texCoord?: string;
}

/** A material with the one component the built-in assemblers read: "baseColor" (vec4 factor, optional texture). */
export function makeMaterial(options: MaterialOptions = {}): MaterialWrapper {
    const material = new MaterialWrapper({
        alphaMode: options.alphaMode ?? "opaque",
        alphaCutoff: options.alphaCutoff ?? 0,
        doubleSided: options.doubleSided ?? true,
    });
    const color = options.color ?? [1, 1, 1];
    const base = new MaterialComponentWrapper("baseColor", [color[0], color[1], color[2], 1]);
    if (options.texture) base.setTexture({wrapper: options.texture, texCoord: options.texCoord ?? "uv0"});
    material.setComponent(base);
    return material;
}

// -- assemblers that report how often they ran ------------------------------------------------------------------

export class CountingVertexAssembler extends BasicVertexAssembler {
    calls = 0;

    override assemble(d: VertexShaderDescriptor, entryPoint: string): string {
        this.calls++;
        return super.assemble(d, entryPoint);
    }
}

export class CountingFragmentAssembler extends BasicFragmentAssembler {
    calls = 0;

    override assemble(d: FragmentShaderDescriptor, entryPoint: string): string {
        this.calls++;
        return super.assemble(d, entryPoint);
    }
}

/** Same code as the basic vertex assembler plus a comment: a different module, identical behaviour. */
export class TaggedVertexAssembler extends CountingVertexAssembler {
    private readonly tag: string;

    constructor(tag: string) {
        super();
        this.tag = tag;
    }

    override assemble(d: VertexShaderDescriptor, entryPoint: string): string {
        return `${super.assemble(d, entryPoint)}\n// ${this.tag}`;
    }
}

// -- primitives, meshes, nodes ----------------------------------------------------------------------------------

export interface CountingPrimitive {
    primitive: PrimitiveWrapper;
    vertex: CountingVertexAssembler;
    fragment: CountingFragmentAssembler;
}

/** A primitive whose assemblers count their runs: `vertex.calls` / `fragment.calls` say how often code was generated. */
export function makeCountingPrimitive(material: MaterialWrapper, geometry: GeometryWrapper): CountingPrimitive {
    const vertex = new CountingVertexAssembler();
    const fragment = new CountingFragmentAssembler();
    return {primitive: new PrimitiveWrapper(material, geometry, vertex, fragment), vertex, fragment};
}

export function makeMesh(...primitives: PrimitiveWrapper[]): MeshWrapper {
    const mesh = new MeshWrapper();
    for (const primitive of primitives) mesh.setPrimitive(primitive);
    return mesh;
}

export function makeNode(mesh?: MeshWrapper | null, position?: Vec3, scale?: number): NodeWrapper {
    const node = new NodeWrapper();
    if (position) node.setTranslation(position[0], position[1], position[2]);
    if (scale !== undefined) node.setScale(scale, scale, scale);
    if (mesh) node.setMesh(mesh);
    return node;
}

export interface Cell {
    x: number;
    y: number;
    /** Edge length of the shape that fits the cell without touching its neighbours. */
    size: number;
}

/**
 * Cell `index` of `count` on a square lattice in the xy plane, spanning [-extent, extent]. With the rig camera
 * (z = 8, 45 degrees) an extent of 3 fills the view.
 */
export function gridCell(index: number, count: number, extent = 3): Cell {
    const n = Math.ceil(Math.sqrt(count));
    const step = (extent * 2) / n;
    const col = index % n;
    const row = Math.floor(index / n);
    return {x: -extent + step * (col + 0.5), y: -extent + step * (row + 0.5), size: step * 0.85};
}

/** Places `makeNode(mesh)` on the lattice. */
export function nodeOnGrid(mesh: MeshWrapper, index: number, count: number, extent = 3): NodeWrapper {
    const cell = gridCell(index, count, extent);
    return makeNode(mesh, [cell.x, cell.y, 0], cell.size);
}
