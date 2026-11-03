import type {BindGroupEntry, Struct} from "./AssemblerProducers.ts";
import type {GeometryBindingPlan} from "./BindGroupLayoutProducer.ts";

/**
 * The binding contract of the morph system, shared by the adapters (which bind buffers) and the shader producers (which
 * declare them), so the two can never disagree. Type-only import above: no runtime cycle with AssemblerProducers.
 *
 * Morph targets are split by who owns the data:
 *   - the packed deltas never change after load and belong to the geometry, so every node drawing the geometry shares
 *     one GPU buffer: group 3 (the geometry's bind group), at the slots assigned by GeometryBindingPlan
 *   - the active weights change per node and per frame, so they live in the node's bind group: group 1, binding 2
 *     (binding 0 is the world matrix, binding 1 the skin palette)
 */
export const MORPH_GEOMETRY_GROUP = 3;

export const MORPH_NODE_GROUP = 1;
export const MORPH_ACTIVE_BINDING = 2;

/** Default number of simultaneously active targets per node. The loop in the shader runs over at most this many. */
export const MORPH_MAX_ACTIVE = 8;
/** One active entry is `{index: u32, weight: f32}`. */
export const MORPH_ACTIVE_ENTRY_BYTES = 8;
/** Eight u32 slots (five used) keep the uniform buffer at a comfortable 32 bytes. */
export const MORPH_HEADER_U32S = 8;

/** WGSL names. The helper functions in MorphCode.ts are written against exactly these. */
export const MORPH_DELTAS_VAR = "morphDeltas";
export const MORPH_HEADER_VAR = "morphHeader";
export const MORPH_ACTIVE_VAR = "morphActive";

/** What the shader needs to know about a geometry's morph targets. Everything else is data in buffers. */
export interface MorphPlan {
    hasNormal: boolean;
    hasTangent: boolean;
}

/** Stable text for a plan; part of the geometry's layout key, so generated vertex code is rebuilt when it changes. */
export function morphPlanKey(plan: MorphPlan | null): string {
    return plan ? `morph:${plan.hasNormal ? "n" : "-"}${plan.hasTangent ? "t" : "-"}` : "morph:none";
}

/** Group 3: the packed deltas and the header that tells the shader how they are laid out. */
export function morphGeometryBindings(plan: GeometryBindingPlan): {
    entries: BindGroupEntry[],
    structs: Struct[]
} {
    const morphDelta = plan.byComponent.get("morph-delta")!;
    const morphHeader = plan.byComponent.get("morph-header")!;


    return {
        structs: [{
            structName: "MorphHeaderUniforms",
            fields: [
                {name: "morphVertexCount", type: "u32", offset: 0},
                {name: "morphTargetCount", type: "u32", offset: 4},
                {name: "morphTargetStride", type: "u32", offset: 8},
                {name: "morphNormalOffset", type: "u32", offset: 12},
                {name: "morphTangentOffset", type: "u32", offset: 16},
            ],
        }],
        entries: [{
            kind: "storage",
            group: MORPH_GEOMETRY_GROUP,
            binding: morphDelta.binding,
            name: MORPH_DELTAS_VAR,
            storageType: "array<f32>",
            access: "read",
        }, {
            kind: "uniform",
            group: MORPH_GEOMETRY_GROUP,
            binding: morphHeader.binding,
            name: MORPH_HEADER_VAR,
            uniformType: "MorphHeaderUniforms",
            size: 20,
        }]
    }
}

/** Group 1, binding 2: this node's active targets. Entries after the last active one have weight 0. */
export function morphNodeBindings(): {
    entries: BindGroupEntry[],
    structs: Struct[]
} {

    return {
        structs: [{
            structName: "MorphActiveEntry",
            fields: [
                {name: "index", type: "u32", offset: 0},
                {name: "weight", type: "f32", offset: 4},
            ],
        }],
        entries: [{
            kind: "storage",
            group: MORPH_NODE_GROUP,
            binding: MORPH_ACTIVE_BINDING,
            name: MORPH_ACTIVE_VAR,
            storageType: "array<MorphActiveEntry>",
            access: "read",
        },]
    }
}
