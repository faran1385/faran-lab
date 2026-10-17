import type {Hasher} from "../hashing/utils/Hasher.ts";
import type {BindingEntry} from "./BindingSet.ts";

/**
 * Pure functions that turn bind group entries into what the rest of the engine needs: the GPU layout entry, the cache
 * key of that layout, and the keys of the resources inside. Nothing here touches the GPU or any manager.
 */

/**
 * The sample type a texture of this format has to be bound with.
 *
 * It depends on the texture, not on its class: a depth texture cannot be bound as "float", and 32-bit float colour
 * formats are not filterable (without a device feature). That is why it is part of the layout key.
 */
export function textureSampleTypeOf(format: GPUTextureFormat): GPUTextureSampleType {
    if (format.startsWith("depth")) return "depth";
    if (format.endsWith("uint")) return "uint";
    if (format.endsWith("sint")) return "sint";
    if (format === "r32float" || format === "rg32float" || format === "rgba32float") return "unfilterable-float";
    return "float";
}

/** The WGSL type a texture binding of this sample type is declared with. */
export function wgslTextureTypeOf(sampleType: GPUTextureSampleType): string {
    switch (sampleType) {
        case "depth":
            return "texture_depth_2d";
        case "uint":
            return "texture_2d<u32>";
        case "sint":
            return "texture_2d<i32>";
        case "float":
        case "unfilterable-float":
            return "texture_2d<f32>";
    }
}

/** The GPU layout entry for one binding. This is the only place a wrapper kind is turned into layout fields. */
export function describeLayoutEntry(entry: BindingEntry): GPUBindGroupLayoutEntry {
    const {binding, visibility, value} = entry;
    switch (value.bindingKind) {
        case "uniform-buffer":
            return {binding, visibility, buffer: {type: "uniform"}};
        case "read-only-storage-buffer":
            return {binding, visibility, buffer: {type: "read-only-storage"}};
        case "texture-2d":
            return {
                binding,
                visibility,
                texture: {sampleType: textureSampleTypeOf(value.getFormat()), viewDimension: "2d", multisampled: false},
            };
        case "sampler":
            return {binding, visibility, sampler: {type: "filtering"}};
    }
}

/** Stable text for a plain object: keys sorted, so field order in the source can never change the result. */
function canonicalize(value: unknown): string {
    if (value === null || typeof value !== "object") return String(value);
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => `${key}:${canonicalize(record[key])}`)
        .join(",") + "}";
}

/**
 * The cache key of a set's bind group layout. It is built from the layout entries themselves, so everything the
 * layout contains is in the key and nothing else is: two sets with the same shape share one layout whatever their
 * textures or buffers are, and names (a shader-side concern) never split a layout.
 *
 * The group number is not in it either: a layout does not know which group it is bound as.
 */
export function layoutKeyOf(entries: readonly BindingEntry[]): string {
    return entries.map((entry) => canonicalize(describeLayoutEntry(entry))).join("|");
}

export type BindingResourceKind = "buffer" | "texture" | "sampler";

/** Which manager resource one binding points at: the same key the managers cache that resource under. */
export interface ResourceKey {
    binding: number;
    kind: BindingResourceKind;
    key: string;
}

/**
 * The manager keys of the resources inside a set. Buffers are keyed by identity (uuid), images and samplers by their
 * existing hash providers, exactly like the material path does, so a set and a material that point at the same image
 * resolve to the same GPU texture.
 */
export function resourceKeysOf(entries: readonly BindingEntry[], hasher: Hasher): ResourceKey[] {
    return entries.map(({binding, value}): ResourceKey => {
        switch (value.bindingKind) {
            case "uniform-buffer":
            case "read-only-storage-buffer":
                return {binding, kind: "buffer", key: value.hashProvider.convertToHash()};
            case "texture-2d":
                return {binding, kind: "texture", key: value.hashProvider.convertToHash(hasher)};
            case "sampler":
                return {binding, kind: "sampler", key: value.hashProvider.convertToHash(hasher)};
        }
    });
}
