import {MorphTargetInternal} from "../internals/MorphTargetInternal.ts";

/**
 * Translates a MorphTargetWrapper: wraps its packed deltas and header into the buffers the geometry adapter binds.
 * Like AttributeAdaptor it has no pre-frame work of its own: the wrapper edits the buffer in place and queues the upload.
 */
export class MorphTargetAdaptor {
    readonly internal: MorphTargetInternal;

    constructor(deltas: ArrayBuffer, header: ArrayBuffer) {
        this.internal = new MorphTargetInternal(deltas, header);
    }
}
