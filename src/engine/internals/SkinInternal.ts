import {v4 as uuidv4} from "uuid";
import {ChangeStamp} from "../hashing/utils/ChangeStamp.ts";
import type {BufferInternal} from "./BufferInternal.ts";

/**
 * What the render side knows about a skin: the palette buffer a node binds and the id of the method that wrote it.
 * No joints, no matrices, no wrapper. The stamp moves when the palette buffer or the method is replaced (so nodes
 * rebuild), never when the palette's contents change (those are uploaded through the upload queue).
 */
export class SkinInternal {
    readonly uuid: string;
    private palette: BufferInternal;
    private methodId: string;
    private readonly stamp = new ChangeStamp();

    constructor(palette: BufferInternal, methodId: string) {
        this.uuid = uuidv4();
        this.palette = palette;
        this.methodId = methodId;
    }

    getPalette(): BufferInternal {
        return this.palette;
    }

    getMethodId(): string {
        return this.methodId;
    }

    /** Changes with the palette buffer or the method; part of the owning node's hash. */
    getKey(): string {
        return `${this.palette.uuid}:${this.methodId}`;
    }

    getChangedAt(): number {
        return this.stamp.get();
    }

    setPalette(palette: BufferInternal, methodId: string): void {
        this.palette = palette;
        this.methodId = methodId;
        this.stamp.mark();
    }
}
