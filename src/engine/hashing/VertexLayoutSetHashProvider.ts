import {AggregateHashHandler} from "./utils/AggregateHashHandler.ts";
import {ChangeStamp} from "./utils/ChangeStamp.ts";
import {getEpoch} from "./utils/epoch.ts";
import type {Hasher} from "./utils/Hasher.ts";
import type {VertexBufferEntry} from "../bindings/VertexLayoutSet.ts";
import {shaderInputsKeyOf, vertexLayoutKeyOf} from "../bindings/describeVertexLayout.ts";

/**
 * Hashing and change tracking for one VertexLayoutSet, with the same conventions as every other hash provider.
 *
 * Two hashes, because they change for different reasons:
 * - layout: what the GPU sees (strides, step modes, locations, formats, offsets). Pipelines depend on it.
 * - shader inputs: which names sit at which location with which WGSL type. Generated vertex code depends on it.
 *
 * Neither contains the buffers: swapping a buffer for another with the same layout invalidates neither.
 */
export class VertexLayoutSetHashProvider {
    private readonly changeStamp = new ChangeStamp();
    private memoEpoch = -1;
    private memoChangedAt = 0;
    private readonly getBuffers: () => readonly VertexBufferEntry[];
    private readonly layoutHash: AggregateHashHandler;
    private readonly shaderInputsHash: AggregateHashHandler;

    constructor(getBuffers: () => readonly VertexBufferEntry[]) {
        this.getBuffers = getBuffers;
        this.layoutHash = new AggregateHashHandler(() => vertexLayoutKeyOf(getBuffers()));
        this.shaderInputsHash = new AggregateHashHandler(() => shaderInputsKeyOf(getBuffers()));
    }

    /** Latest change stamp of this set or of any buffer in it. Memoized per epoch, like the geometry's. */
    getChangedAt(): number {
        const epoch = getEpoch();
        if (this.memoEpoch === epoch) return this.memoChangedAt;

        let at = this.changeStamp.get();
        for (const entry of this.getBuffers()) {
            const bufferAt = entry.buffer.hashProvider.getChangedAt();
            if (bufferAt > at) at = bufferAt;
        }

        this.memoEpoch = epoch;
        this.memoChangedAt = at;
        return at;
    }

    markChangeStamp(): void {
        this.changeStamp.mark();
    }

    convertToLayoutHash(hasher: Hasher): string {
        return this.layoutHash.convertToHash(hasher);
    }

    convertToShaderInputsHash(hasher: Hasher): string {
        return this.shaderInputsHash.convertToHash(hasher);
    }
}
