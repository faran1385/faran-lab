import {v4 as uuidv4} from "uuid";
import {MorphTargetAdaptor} from "../Adaptors/MorphTargetAdaptor.ts";
import {MORPH_HEADER_U32S} from "../producers/MorphProducer.ts";

/**
 * One target's shape, as offsets from the geometry's base attributes (glTF convention): `positionDeltas` is a vec3 per
 * vertex (`vertexCount * 3` floats). Normal deltas are vec3 too. Tangent deltas are vec3 as well: the tangent's w is
 * never morphed.
 */
export interface MorphTargetDeltas {
    positionDeltas: ArrayLike<number>;
    normalDeltas?: ArrayLike<number>;
    tangentDeltas?: ArrayLike<number>;
}

/** Absolute attributes, the way a mesh stores them: positions and normals are vec3, tangents are vec4 (xyz + w). */
export interface MorphAttributes {
    position: ArrayLike<number>;
    normal?: ArrayLike<number>;
    tangent?: ArrayLike<number>;
}

/** What `getTarget` returns: live views into the packed buffer. Edit them, then call `update()`. */
export interface MorphTargetViews {
    positionDeltas: Float32Array;
    normalDeltas?: Float32Array;
    tangentDeltas?: Float32Array;
}

/**
 * All morph targets of one geometry, packed for the GPU once at construction.
 *
 * Layout of the single storage buffer, in floats, target-major so neighbouring vertices read neighbouring memory:
 *
 *   [ target 0: positions | normals | tangents ][ target 1: ... ] ...
 *
 * A section exists only when at least one target provides it (a target that lacks it gets zeros). Nothing here is
 * per node: the buffer is shared by every node that draws the geometry. What differs per node is the weights, which live
 * in MorphStateWrapper.
 *
 * Attach with `geometry.setMorphTargets(targets)`. The geometry's own position/normal/tangent attributes are the base
 * the deltas are added to; the vertex count has to match the position attribute.
 */
export class MorphTargetWrapper {
    readonly uuid: string;
    readonly adaptor: MorphTargetAdaptor;

    private readonly names: string[];
    private readonly indexByName = new Map<string, number>();
    private readonly vertexCount: number;
    private readonly normalPresent: boolean;
    private readonly tangentPresent: boolean;
    /** Floats per target. */
    private readonly stride: number;
    private readonly normalOffset: number;
    private readonly tangentOffset: number;
    private readonly packed: Float32Array;

    /**
     * @param targets in index order: the Map's insertion order is the target index, which is the order of the weights.
     */
    constructor(targets: ReadonlyMap<string, MorphTargetDeltas>) {
        if (targets.size === 0) throw new Error("MorphTargetWrapper: at least one target is needed");
        this.uuid = uuidv4();
        this.names = Array.from(targets.keys());
        this.names.forEach((name, index) => this.indexByName.set(name, index));

        const first = targets.values().next().value!;
        const floats = first.positionDeltas.length;
        if (floats === 0 || floats % 3 !== 0) {
            throw new Error(`MorphTargetWrapper: positionDeltas must hold 3 floats per vertex, got ${floats}`);
        }
        this.vertexCount = floats / 3;
        const section = floats;

        let hasNormal = false;
        let hasTangent = false;
        for (const [name, deltas] of targets) {
            MorphTargetWrapper.assertLength(name, "positionDeltas", deltas.positionDeltas, section);
            if (deltas.normalDeltas) {
                MorphTargetWrapper.assertLength(name, "normalDeltas", deltas.normalDeltas, section);
                hasNormal = true;
            }
            if (deltas.tangentDeltas) {
                MorphTargetWrapper.assertLength(name, "tangentDeltas", deltas.tangentDeltas, section);
                hasTangent = true;
            }
        }
        this.normalPresent = hasNormal;
        this.tangentPresent = hasTangent;
        this.normalOffset = hasNormal ? section : 0;
        this.tangentOffset = hasTangent ? section * (hasNormal ? 2 : 1) : 0;
        this.stride = section * (1 + (hasNormal ? 1 : 0) + (hasTangent ? 1 : 0));

        const packed = new Float32Array(targets.size * this.stride);
        let index = 0;
        for (const deltas of targets.values()) {
            const start = index * this.stride;
            packed.set(deltas.positionDeltas, start);
            if (deltas.normalDeltas) packed.set(deltas.normalDeltas, start + this.normalOffset);
            if (deltas.tangentDeltas) packed.set(deltas.tangentDeltas, start + this.tangentOffset);
            index++;
        }
        this.packed = packed;

        const header = new Uint32Array(MORPH_HEADER_U32S);
        header[0] = this.vertexCount;
        header[1] = targets.size;
        header[2] = this.stride;
        header[3] = this.normalOffset;
        header[4] = this.tangentOffset;

        this.adaptor = new MorphTargetAdaptor(packed.buffer as ArrayBuffer, header.buffer as ArrayBuffer);
    }

    /**
     * Builds the targets from absolute attributes (what a modelling tool hands over) by subtracting `base`. Targets may
     * omit normals/tangents; `base` must have whatever any target provides. Tangents are vec4 (`vertexCount * 4`).
     */
    static fromAbsolute(base: MorphAttributes, targets: ReadonlyMap<string, MorphAttributes>): MorphTargetWrapper {
        const vertexCount = base.position.length / 3;
        const deltas = new Map<string, MorphTargetDeltas>();

        for (const [name, target] of targets) {
            const entry: MorphTargetDeltas = {positionDeltas: MorphTargetWrapper.diff(name, "position", target.position, base.position, vertexCount, 3)};
            if (target.normal) {
                if (!base.normal) throw new Error(`MorphTargetWrapper.fromAbsolute: target "${name}" has normals but the base has none`);
                entry.normalDeltas = MorphTargetWrapper.diff(name, "normal", target.normal, base.normal, vertexCount, 3);
            }
            if (target.tangent) {
                if (!base.tangent) throw new Error(`MorphTargetWrapper.fromAbsolute: target "${name}" has tangents but the base has none`);
                entry.tangentDeltas = MorphTargetWrapper.diff(name, "tangent", target.tangent, base.tangent, vertexCount, 4);
            }
            deltas.set(name, entry);
        }
        return new MorphTargetWrapper(deltas);
    }

    getVertexCount(): number {
        return this.vertexCount;
    }

    getTargetCount(): number {
        return this.names.length;
    }

    getTargetNames(): readonly string[] {
        return this.names;
    }

    /** -1 when there is no target with that name. */
    indexOf(name: string): number {
        return this.indexByName.get(name) ?? -1;
    }

    hasNormal(): boolean {
        return this.normalPresent;
    }

    hasTangent(): boolean {
        return this.tangentPresent;
    }

    /** Live views into the packed buffer. After editing them in place, call `update()`. */
    getTarget(target: number | string): MorphTargetViews {
        const start = this.resolve(target) * this.stride;
        const section = this.vertexCount * 3;
        const views: MorphTargetViews = {positionDeltas: this.packed.subarray(start, start + section)};
        if (this.normalPresent) {
            views.normalDeltas = this.packed.subarray(start + this.normalOffset, start + this.normalOffset + section);
        }
        if (this.tangentPresent) {
            views.tangentDeltas = this.packed.subarray(start + this.tangentOffset, start + this.tangentOffset + section);
        }
        return views;
    }

    /**
     * Overwrites the sections you pass (the others stay as they are) and queues the upload. The set of sections a
     * target can have is fixed at construction: adding normals to targets that had none changes the layout, which needs a
     * new MorphTargetWrapper.
     */
    setTarget(target: number | string, deltas: Partial<MorphTargetDeltas>): void {
        const label = typeof target === "string" ? target : `#${target}`;
        const views = this.getTarget(target);
        const section = this.vertexCount * 3;

        if (deltas.positionDeltas) {
            MorphTargetWrapper.assertLength(label, "positionDeltas", deltas.positionDeltas, section);
            views.positionDeltas.set(deltas.positionDeltas);
        }
        if (deltas.normalDeltas) {
            if (!views.normalDeltas) throw new Error(`MorphTargetWrapper.setTarget: these targets have no normal deltas; build a new MorphTargetWrapper to add them`);
            MorphTargetWrapper.assertLength(label, "normalDeltas", deltas.normalDeltas, section);
            views.normalDeltas.set(deltas.normalDeltas);
        }
        if (deltas.tangentDeltas) {
            if (!views.tangentDeltas) throw new Error(`MorphTargetWrapper.setTarget: these targets have no tangent deltas; build a new MorphTargetWrapper to add them`);
            MorphTargetWrapper.assertLength(label, "tangentDeltas", deltas.tangentDeltas, section);
            views.tangentDeltas.set(deltas.tangentDeltas);
        }
        this.update();
    }

    /**
     * Queues the packed buffer for upload. `setTarget` calls it; call it yourself after editing the arrays from
     * `getTarget` in place. The whole buffer is written, so batch your edits before calling it.
     */
    update(): void {
        this.adaptor.internal.deltas.markDirty();
    }

    private resolve(target: number | string): number {
        const index = typeof target === "string" ? this.indexByName.get(target) : target;
        if (index === undefined || !Number.isInteger(index) || index < 0 || index >= this.names.length) {
            throw new RangeError(`MorphTargetWrapper: no morph target ${typeof target === "string" ? `named "${target}"` : `at index ${target}`} (${this.names.length} targets)`);
        }
        return index;
    }

    private static assertLength(target: string, what: string, data: ArrayLike<number>, expected: number): void {
        if (data.length !== expected) {
            throw new Error(`MorphTargetWrapper: target "${target}" ${what} has ${data.length} floats, expected ${expected}`);
        }
    }

    /** target - base for the first three components of each vertex, `components` being 3 (vec3) or 4 (vec4, w dropped). */
    private static diff(name: string, what: string, target: ArrayLike<number>, base: ArrayLike<number>, vertexCount: number, components: 3 | 4): Float32Array {
        const expected = vertexCount * components;
        if (target.length !== expected || base.length !== expected) {
            throw new Error(`MorphTargetWrapper.fromAbsolute: target "${name}" ${what} has ${target.length} floats and the base ${base.length}, expected ${expected}`);
        }
        const out = new Float32Array(vertexCount * 3);
        for (let v = 0; v < vertexCount; v++) {
            for (let c = 0; c < 3; c++) {
                out[v * 3 + c] = target[v * components + c] - base[v * components + c];
            }
        }
        return out;
    }
}
