import {v4 as uuidv4} from 'uuid';
import type {Hasher} from "../hashing/Hasher.ts";
import {HashHandler} from "../hashing/HashHandler.ts";

export class BufferWrapper<TUsage extends GPUBufferUsageFlags = GPUBufferUsageFlags> {
    readonly uuid: string;

    protected usage: TUsage;
    protected data: ArrayBuffer;
    protected hashHandler!: HashHandler;

    constructor(data: ArrayBuffer, usage: TUsage) {
        this.uuid = uuidv4();
        this.data = data;
        this.usage = usage;
    }

    getUsage(): TUsage {
        return this.usage;
    }

    getData(): ArrayBuffer {
        return this.data;
    }

    setData(data: ArrayBuffer): void {
        this.data = data;
        this.hashHandler.addVersion();
    }

    getVersion(): number {
        return this.hashHandler.getVersion();
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }

    drainTrash(): string[] {
        return this.hashHandler.drainTrash();
    }
}