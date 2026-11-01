import {BufferInternal} from "./BufferInternal.ts";
import {MORPH_ACTIVE_ENTRY_BYTES} from "../producers/MorphProducer.ts";

/**
 * What the render side knows about one node's morph weights: the buffer of active `{index, weight}` entries that the node
 * binds. Its size is fixed at creation (`maxActive` entries); its contents are rewritten in place and uploaded.
 */
export class MorphStateInternal {
    readonly activeBuffer: BufferInternal;

    constructor(maxActive: number) {
        this.activeBuffer = new BufferInternal(
            new ArrayBuffer(maxActive * MORPH_ACTIVE_ENTRY_BYTES),
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        );
    }
}

let emptyActive: BufferInternal | null = null;

/**
 * The active buffer of a node that draws a morphed geometry but has no MorphStateWrapper: one entry of weight 0, which the
 * shader reads as "no active targets", so the node draws the rest pose. It is never written, so every node shares it
 * (each renderer makes one GPU buffer from it). Created on first use because `GPUBufferUsage` may not exist at import.
 */
export function getEmptyMorphActiveBuffer(): BufferInternal {
    emptyActive ??= new BufferInternal(
        new ArrayBuffer(MORPH_ACTIVE_ENTRY_BYTES),
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    );
    return emptyActive;
}
