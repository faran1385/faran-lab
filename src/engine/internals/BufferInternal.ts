import {v4 as uuidv4} from 'uuid';
import {BufferHashProvider} from "../hashing/BufferHashProvider.ts";
import {queueBufferUpload} from "./UploadQueue.ts";

export class BufferInternal<TUsage extends GPUBufferUsageFlags = GPUBufferUsageFlags> {
    readonly uuid: string;

    protected usage: TUsage;
    protected data: ArrayBuffer;
    readonly hashProvider: BufferHashProvider

    constructor(data: ArrayBuffer, usage: TUsage) {
        this.uuid = uuidv4();
        this.data = data;
        this.usage = usage;

        this.hashProvider = new BufferHashProvider(this.uuid)
    }


    getUsage(): TUsage {
        return this.usage;
    }

    getData(): ArrayBuffer {
        return this.data;
    }

    /**
     * Replaces the bytes. The byte length must stay the same: a GPU buffer's size is fixed at creation, so a different
     * size needs a new BufferInternal (new uuid). Only the upload queue is touched, never the change stamp, because
     * new contents do not change the buffer's identity or anything hashed from it.
     */
    setData(data: ArrayBuffer): void {
        this.data = data;
        this.markDirty();
    }

    /** The bytes were edited in place: queue an upload. */
    markDirty(): void {
        this.hashProvider.markNeedsUpdate();
        queueBufferUpload(this);
    }

}
