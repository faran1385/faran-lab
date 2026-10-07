import {NodeWrapper} from "../engine/wrappers/NodeWrapper.ts";
import {MeshWrapper} from "../engine/wrappers/MeshWrapper.ts";
import {PrimitiveWrapper} from "../engine/wrappers/PrimitiveWrapper.ts";
import {MaterialWrapper} from "../engine/wrappers/MaterialWrapper.ts";
import {MaterialComponentWrapper} from "../engine/wrappers/MaterialComponentWrapper.ts";
import {GeometryWrapper} from "../engine/wrappers/GeometryWrapper.ts";
import {AttributeWrapper} from "../engine/wrappers/AttributeWrapper.ts";
import {IndexAttributeWrapper} from "../engine/wrappers/IndexWrapper.ts";
import {ImageWrapper} from "../engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "../engine/wrappers/SamplerWrapper.ts";
import {TextureWrapper} from "../engine/wrappers/TextureWrapper.ts";
import {MANAGER_NAMES, type Rig, SIZE} from "./rig.ts";

/**
 * A tiny scene language with an exact oracle.
 *
 * The scene is a 4x4 grid of cells. Each cell has four quadrants ("regions"); a leaf node sits on a cell (its "slot")
 * and every primitive of that node draws one small shape in its own region, so nothing ever overlaps and the expected
 * colour of every pixel we probe follows directly from the model:
 *
 *     expected = (material visible from the camera) ? texture * factor : background
 *
 * A shape wound clockwise is back-facing for the camera, so it is only visible when its material is double sided.
 * That makes the oracle sensitive to the cull-mode pipeline variants too.
 *
 * Every mutation goes through Sim so the model and the engine wrappers can never drift apart. `Sim.build` realizes a
 * model from scratch on another rig, which is the reference for "incremental changes == building the final scene".
 */

/**
 * `reuploadTextures`: before reading pixels, rewrite every live texture's data from its ImageWrapper. Works around the
 * engine never re-uploading pixels into a texture it had to re-create (see the texture-evict-recreate scenario), so
 * one bug does not mask everything else. Turn off with ?strictTextures=1 once that is fixed.
 */
export const settings = {reuploadTextures: true};

export type RGBA = [number, number, number, number];
export type RGB = [number, number, number];
export type AlphaMode = "opaque" | "mask" | "blend";
export type Shape = "tri" | "quad16" | "quad32" | "quadFlat";
export type Winding = "ccw" | "cw";
export type Filter = "nearest" | "linear";

export interface ImageModel {
    color: RGB; // 0..255
}

export interface SamplerModel {
    filter: Filter;
}

export interface MaterialModel {
    color: RGBA; // factor, 0..1
    image: string | null;
    sampler: string | null;
    alphaMode: AlphaMode;
    doubleSided: boolean;
}

export interface GeometryModel {
    region: number;
    shape: Shape;
    winding: Winding;
    uv: boolean;
}

export interface PrimModel {
    id: number;
    geo: string;
    mat: string;
}

export interface NodeModel {
    id: number;
    kind: "leaf" | "group";
    /** Group id for a leaf that is a child of a group, null for root-level nodes (and parked leaves). */
    parent: number | null;
    /** Local translation. */
    t: [number, number, number];
    slot: number | null;
    /** false = parked: removed from the scene but still known to the model, can be re-attached. */
    attached: boolean;
    prims: PrimModel[];
}

export interface Model {
    images: Map<string, ImageModel>;
    samplers: Map<string, SamplerModel>;
    materials: Map<string, MaterialModel>;
    geometries: Map<string, GeometryModel>;
    nodes: Map<number, NodeModel>;
    nextId: number;
}

export function emptyModel(): Model {
    return {
        images: new Map(), samplers: new Map(), materials: new Map(), geometries: new Map(),
        nodes: new Map(), nextId: 1,
    };
}

// ---------------------------------------------------------------------------------------------------------------
// geometry layout

export const SLOT_COUNT = 16;
export const REGION_COUNT = 4;
const SPACING = 1.25;
const REGION_CENTER: Array<[number, number]> = [[-0.26, 0.26], [0.26, 0.26], [-0.26, -0.26], [0.26, -0.26]];
const HALF = 0.2;
const TOLERANCE = 4;

export function slotPos(slot: number): [number, number, number] {
    const col = slot % 4;
    const row = Math.floor(slot / 4);
    return [(col - 1.5) * SPACING, (1.5 - row) * SPACING, 0];
}

export function geoId(region: number, shape: Shape, winding: Winding, inst: number): string {
    return `g:${region}:${shape}:${winding}:${inst}`;
}

export function geoModelFromId(id: string): GeometryModel {
    const [, region, shape, winding] = id.split(":");
    return {region: Number(region), shape: shape as Shape, winding: winding as Winding, uv: true};
}

interface ShapeData {
    positions: Float32Array<ArrayBuffer>;
    uvs: Float32Array<ArrayBuffer>;
    indices?: Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
    indexFormat?: "uint16" | "uint32";
    /** Offset from the region centre to a point that is certainly inside the shape. */
    probe: [number, number];
}

function shapeData(g: GeometryModel): ShapeData {
    const [cx, cy] = REGION_CENTER[g.region];
    const s = HALF;
    const v: Array<[number, number]> = [[cx - s, cy - s], [cx + s, cy - s], [cx - s, cy + s], [cx + s, cy + s]];
    const ccw = g.winding === "ccw";

    const build = (verts: Array<[number, number]>, extra: Partial<ShapeData>): ShapeData => {
        const positions = new Float32Array(verts.length * 3);
        const uvs = new Float32Array(verts.length * 2);
        verts.forEach(([x, y], i) => {
            positions.set([x, y, 0], i * 3);
            uvs.set([(x - cx + s) / (2 * s), (y - cy + s) / (2 * s)], i * 2);
        });
        return {positions, uvs, probe: [0, 0], ...extra};
    };

    switch (g.shape) {
        case "tri":
            return build(ccw ? [v[0], v[1], v[2]] : [v[0], v[2], v[1]], {probe: [-s / 3, -s / 3]});
        case "quadFlat":
            return build(ccw ? [v[0], v[1], v[3], v[0], v[3], v[2]] : [v[0], v[3], v[1], v[0], v[2], v[3]], {});
        case "quad16":
        case "quad32": {
            const order = ccw ? [0, 1, 3, 0, 3, 2] : [0, 3, 1, 0, 2, 3];
            return g.shape === "quad16"
                ? build(v, {indices: new Uint16Array(order), indexFormat: "uint16"})
                : build(v, {indices: new Uint32Array(order), indexFormat: "uint32"});
        }
    }
}

function solidRGBA(color: RGB): ArrayBuffer {
    const data = new Uint8Array(2 * 2 * 4);
    for (let i = 0; i < 4; i++) data.set([color[0], color[1], color[2], 255], i * 4);
    return data.buffer;
}

function sub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// ---------------------------------------------------------------------------------------------------------------

export interface Expectation {
    color: RGB | null; // null = background
    probe: [number, number, number];
    why: string;
}

export class Sim {
    readonly rig: Rig;
    model: Model = emptyModel();

    private wImages = new Map<string, ImageWrapper>();
    private wSamplers = new Map<string, SamplerWrapper>();
    private wMaterials = new Map<string, MaterialWrapper>();
    private wGeometries = new Map<string, GeometryWrapper>();
    private wNodes = new Map<number, NodeWrapper>();
    private wMeshes = new Map<number, MeshWrapper>();
    private wPrims = new Map<number, PrimitiveWrapper>();

    constructor(rig: Rig) {
        this.rig = rig;
    }

    /** Realize `model` from scratch on `rig`: only what is effectively attached to the scene is built. */
    static build(rig: Rig, model: Model): Sim {
        const sim = new Sim(rig);
        sim.model = structuredClone(model);
        const live = [...sim.model.nodes.values()].filter((n) => sim.effectivelyAttached(n));
        for (const id of [...sim.model.nodes.keys()]) {
            if (!live.some((n) => n.id === id)) sim.model.nodes.delete(id);
        }
        // groups first so leaves can find their parent
        for (const n of live.filter((n) => n.kind === "group")) sim.realizeNode(n);
        for (const n of live.filter((n) => n.kind === "leaf")) sim.realizeNode(n);
        return sim;
    }

    // ---- wrapper access (for tests that poke the engine directly) ----

    imageWrapper(id: string): ImageWrapper {
        return this.image(id);
    }

    materialWrapper(id: string): MaterialWrapper {
        return this.material(id);
    }

    nodeWrapper(id: number): NodeWrapper {
        return this.wNodes.get(id)!;
    }

    primWrapper(id: number): PrimitiveWrapper {
        return this.wPrims.get(id)!;
    }

    // ---- definitions (model only; wrappers are created lazily the first time something needs them) ----

    defineImage(id: string, color: RGB): void {
        this.model.images.set(id, {color});
    }

    defineSampler(id: string, filter: Filter): void {
        this.model.samplers.set(id, {filter});
    }

    defineMaterial(id: string, m: Partial<MaterialModel> = {}): void {
        this.model.materials.set(id, {
            color: [1, 1, 1, 1], image: null, sampler: null, alphaMode: "opaque", doubleSided: false, ...m,
        });
    }

    defineGeometry(id: string, g?: Partial<GeometryModel>): void {
        if (this.model.geometries.has(id)) return;
        this.model.geometries.set(id, {...geoModelFromId(id), ...g});
    }

    // ---- node operations ----

    addGroup(t: [number, number, number]): number {
        const node: NodeModel = {
            id: this.model.nextId++, kind: "group", parent: null, t, slot: null, attached: true, prims: [],
        };
        this.model.nodes.set(node.id, node);
        this.realizeNode(node);
        return node.id;
    }

    addLeaf(slot: number, prims: Array<{ geo: string; mat: string }>, parent: number | null = null): number {
        const parentNode = parent === null ? null : this.model.nodes.get(parent)!;
        const world = slotPos(slot);
        const node: NodeModel = {
            id: this.model.nextId++, kind: "leaf", parent, slot, attached: true,
            t: parentNode ? sub(world, parentNode.t) : world,
            prims: prims.map((p) => ({id: this.model.nextId++, geo: p.geo, mat: p.mat})),
        };
        for (const p of node.prims) this.defineGeometry(p.geo);
        this.model.nodes.set(node.id, node);
        this.realizeNode(node);
        return node.id;
    }

    /** Take the node out of the scene but keep it (and its subtree) so it can be re-attached later. */
    detach(id: number): void {
        const n = this.model.nodes.get(id)!;
        const w = this.wNodes.get(id)!;
        if (!n.attached) return;
        if (n.parent === null) {
            this.rig.scene.removeNode(w);
        } else {
            this.wNodes.get(n.parent)!.removeChild(w);
            n.parent = null;
        }
        n.attached = false;
    }

    attach(id: number, parent: number | null = null): void {
        const n = this.model.nodes.get(id)!;
        const w = this.wNodes.get(id)!;
        if (n.attached) return;
        n.parent = n.kind === "leaf" ? parent : null;
        if (n.kind === "leaf") this.retarget(n);
        if (n.parent === null) this.rig.scene.addNode(w);
        else this.wNodes.get(n.parent)!.addChild(w);
        n.attached = true;
    }

    /** Move an attached leaf to another parent through NodeWrapper.addChild / Scene.addNode (implicit detach). */
    reparent(id: number, parent: number | null): void {
        const n = this.model.nodes.get(id)!;
        const w = this.wNodes.get(id)!;
        n.parent = parent;
        this.retarget(n);
        if (parent === null) this.rig.scene.addNode(w);
        else this.wNodes.get(parent)!.addChild(w);
    }

    /** Forget the node (and, for a group, its children) for good. */
    removeNode(id: number): void {
        const n = this.model.nodes.get(id);
        if (!n) return;
        if (n.kind === "group") {
            for (const c of [...this.model.nodes.values()].filter((c) => c.parent === id)) this.forget(c.id);
        }
        this.detach(id);
        this.forget(id);
    }

    removeAll(): void {
        for (const n of [...this.model.nodes.values()]) {
            if (this.model.nodes.has(n.id)) this.removeNode(n.id);
        }
    }

    moveLeaf(id: number, slot: number): void {
        const n = this.model.nodes.get(id)!;
        n.slot = slot;
        this.retarget(n);
    }

    /** Move a group; its children's local translations are recomputed so their world positions stay put. */
    moveGroup(id: number, t: [number, number, number]): void {
        const g = this.model.nodes.get(id)!;
        g.t = t;
        this.wNodes.get(id)!.setTranslation(t[0], t[1], t[2]);
        for (const c of this.model.nodes.values()) {
            if (c.parent === id) this.retarget(c);
        }
    }

    // ---- primitive operations ----

    addPrim(nodeId: number, geo: string, mat: string): number {
        this.defineGeometry(geo);
        const n = this.model.nodes.get(nodeId)!;
        const prim: PrimModel = {id: this.model.nextId++, geo, mat};
        n.prims.push(prim);
        const w = new PrimitiveWrapper(this.material(mat), this.geometry(geo));
        this.wPrims.set(prim.id, w);
        this.wMeshes.get(nodeId)!.setPrimitive(w);
        return prim.id;
    }

    removePrim(primId: number): void {
        const {node, prim} = this.findPrim(primId);
        node.prims = node.prims.filter((p) => p.id !== prim.id);
        this.wMeshes.get(node.id)!.removePrimitive(this.wPrims.get(primId)!.uuid);
        this.wPrims.delete(primId);
    }

    setPrimMaterial(primId: number, mat: string): void {
        this.findPrim(primId).prim.mat = mat;
        this.wPrims.get(primId)!.setMaterial(this.material(mat));
    }

    setPrimGeometry(primId: number, geo: string): void {
        this.defineGeometry(geo);
        this.findPrim(primId).prim.geo = geo;
        this.wPrims.get(primId)!.setGeometry(this.geometry(geo));
    }

    // ---- in-place mutation of shared objects ----

    setAlphaMode(mat: string, mode: AlphaMode): void {
        this.model.materials.get(mat)!.alphaMode = mode;
        this.wMaterials.get(mat)?.setAlphaMode(mode);
    }

    setDoubleSided(mat: string, on: boolean): void {
        this.model.materials.get(mat)!.doubleSided = on;
        this.wMaterials.get(mat)?.setDoubleSided(on);
    }

    setColor(mat: string, color: RGBA): void {
        this.model.materials.get(mat)!.color = color;
        this.wMaterials.get(mat)?.getComponent("baseColor")!.setFactors([...color]);
    }

    /** Replace (or remove, with nulls) the base colour texture by building a brand new TextureWrapper. */
    setMaterialTexture(mat: string, image: string | null, sampler: string | null): void {
        const m = this.model.materials.get(mat)!;
        m.image = image;
        m.sampler = sampler;
        const w = this.wMaterials.get(mat);
        if (!w) return;
        const component = w.getComponent("baseColor")!;
        if (image && sampler) {
            component.setTexture({wrapper: new TextureWrapper(this.image(image), this.sampler(sampler)), texCoord: "uv0"});
        } else {
            component.removeTexture();
        }
    }

    recolorImage(id: string, color: RGB): void {
        this.model.images.get(id)!.color = color;
        this.wImages.get(id)?.setData(solidRGBA(color));
    }

    setSamplerFilter(id: string, filter: Filter): void {
        this.model.samplers.get(id)!.filter = filter;
        const w = this.wSamplers.get(id);
        if (!w) return;
        w.setMinFilter(filter);
        w.setMagFilter(filter);
        w.setMipFilter(filter);
    }

    /** Add / remove the uv0 attribute of a geometry in place (changes the vertex layout and so the shaders). */
    setGeometryUv(id: string, on: boolean): void {
        const g = this.model.geometries.get(id)!;
        g.uv = on;
        const w = this.wGeometries.get(id);
        if (!w) return;
        if (on) w.setAttribute(new AttributeWrapper("uv0", shapeData(g).uvs.buffer, "float32x2"));
        else w.removeAttribute("uv0");
    }

    // ---- oracle ----

    effectivelyAttached(n: NodeModel): boolean {
        if (!n.attached) return false;
        return n.parent === null || this.model.nodes.get(n.parent)!.attached;
    }

    expectedAt(slot: number, region: number): Expectation {
        const world = slotPos(slot);
        const [rx, ry] = REGION_CENTER[region];
        const empty: Expectation = {color: null, probe: [world[0] + rx, world[1] + ry, 0], why: "empty"};

        for (const n of this.model.nodes.values()) {
            if (n.kind !== "leaf" || n.slot !== slot || !this.effectivelyAttached(n)) continue;
            for (const p of n.prims) {
                const g = this.model.geometries.get(p.geo)!;
                if (g.region !== region) continue;

                const [px, py] = shapeData(g).probe;
                const probe: [number, number, number] = [world[0] + rx + px, world[1] + ry + py, 0];
                const m = this.model.materials.get(p.mat)!;
                const visible = g.winding === "ccw" || m.doubleSided;
                const why = `node ${n.id} prim ${p.id} mat ${p.mat} geo ${p.geo}`;
                if (!visible) return {color: null, probe, why: `${why} (back-facing, single-sided)`};

                const tex = m.image ? this.model.images.get(m.image)!.color : ([255, 255, 255] as RGB);
                const color = [0, 1, 2].map((i) => Math.round(tex[i] * m.color[i])) as RGB;
                return {color, probe, why};
            }
        }
        return empty;
    }

    /** Render a frame, read it back and compare every probe with the oracle. Returns mismatch descriptions. */
    async verify(): Promise<string[]> {
        if (settings.reuploadTextures) this.rig.reuploadTextures(this.wImages.values());
        const px = await this.rig.readPixels();
        const out: string[] = [];
        for (let slot = 0; slot < SLOT_COUNT; slot++) {
            for (let region = 0; region < REGION_COUNT; region++) {
                const e = this.expectedAt(slot, region);
                const [sx, sy] = this.rig.project(...e.probe);
                const i = (Math.round(sy) * SIZE + Math.round(sx)) * 4;
                const got: RGB = [px[i], px[i + 1], px[i + 2]];
                const want = e.color ?? [0, 0, 0];
                if (Math.max(...got.map((g, k) => Math.abs(g - want[k]))) > TOLERANCE) {
                    out.push(`slot ${slot} region ${region}: expected rgb(${want}) got rgb(${got})  [${e.why}]`);
                }
            }
        }
        return out;
    }

    // ---- internals ----

    private forget(id: number): void {
        const n = this.model.nodes.get(id);
        if (n) for (const p of n.prims) this.wPrims.delete(p.id);
        this.model.nodes.delete(id);
        this.wNodes.delete(id);
        this.wMeshes.delete(id);
    }

    private findPrim(primId: number): { node: NodeModel; prim: PrimModel } {
        for (const node of this.model.nodes.values()) {
            const prim = node.prims.find((p) => p.id === primId);
            if (prim) return {node, prim};
        }
        throw new Error(`Sim: no primitive ${primId}`);
    }

    /** Recompute a leaf's local translation from its slot and parent, and push it to the wrapper. */
    private retarget(n: NodeModel): void {
        if (n.kind !== "leaf" || n.slot === null) return;
        const world = slotPos(n.slot);
        n.t = n.parent === null ? world : sub(world, this.model.nodes.get(n.parent)!.t);
        this.wNodes.get(n.id)?.setTranslation(n.t[0], n.t[1], n.t[2]);
    }

    private realizeNode(n: NodeModel): void {
        const w = new NodeWrapper(n.t as never);
        this.wNodes.set(n.id, w);
        if (n.kind === "leaf") {
            const mesh = new MeshWrapper();
            for (const p of n.prims) {
                const pw = new PrimitiveWrapper(this.material(p.mat), this.geometry(p.geo));
                this.wPrims.set(p.id, pw);
                mesh.setPrimitive(pw);
            }
            this.wMeshes.set(n.id, mesh);
            w.setMesh(mesh);
        }
        if (!n.attached) return;
        if (n.parent === null) this.rig.scene.addNode(w);
        else this.wNodes.get(n.parent)!.addChild(w);
    }

    private image(id: string): ImageWrapper {
        let w = this.wImages.get(id);
        if (!w) {
            w = new ImageWrapper(solidRGBA(this.model.images.get(id)!.color), 2, 2);
            this.wImages.set(id, w);
        }
        return w;
    }

    private sampler(id: string): SamplerWrapper {
        let w = this.wSamplers.get(id);
        if (!w) {
            const f = this.model.samplers.get(id)!.filter;
            w = new SamplerWrapper(f, f, f);
            this.wSamplers.set(id, w);
        }
        return w;
    }

    private material(id: string): MaterialWrapper {
        let w = this.wMaterials.get(id);
        if (!w) {
            const m = this.model.materials.get(id)!;
            w = new MaterialWrapper({alphaMode: m.alphaMode, doubleSided: m.doubleSided, alphaCutoff: 0.5});
            const component = new MaterialComponentWrapper("baseColor", [...m.color]);
            if (m.image && m.sampler) {
                component.setTexture({wrapper: new TextureWrapper(this.image(m.image), this.sampler(m.sampler)), texCoord: "uv0"});
            }
            w.setComponent(component);
            this.wMaterials.set(id, w);
        }
        return w;
    }

    private geometry(id: string): GeometryWrapper {
        let w = this.wGeometries.get(id);
        if (!w) {
            const g = this.model.geometries.get(id)!;
            const data = shapeData(g);
            w = new GeometryWrapper();
            w.setAttribute(new AttributeWrapper("position", data.positions.buffer, "float32x3"));
            if (g.uv) w.setAttribute(new AttributeWrapper("uv0", data.uvs.buffer, "float32x2"));
            if (data.indices) w.setIndices(new IndexAttributeWrapper(data.indices.buffer, data.indexFormat!));
            this.wGeometries.set(id, w);
        }
        return w;
    }
}

/** Counts per manager, e.g. for log lines. */
export function formatCounts(counts: Record<string, number>): string {
    return MANAGER_NAMES.map((n) => `${n}:${counts[n]}`).join(" ");
}
