import {v4 as uuidv4} from 'uuid';
import type {Hasher} from "../hashing/Hasher.ts";
import {HashHandler} from "../hashing/HashHandler.ts";
import {ChangeStamp} from "../hashing/ChangeStamp.ts";

export class BufferWrapper<TUsage extends GPUBufferUsageFlags = GPUBufferUsageFlags> {
    readonly uuid: string;

    protected usage: TUsage;
    protected data: ArrayBuffer;
    protected hashHandler!: HashHandler;
    private readonly changeStamp = new ChangeStamp();

    constructor(data: ArrayBuffer, usage: TUsage) {
        this.uuid = uuidv4();
        this.data = data;
        this.usage = usage;
        this.hashHandler = new HashHandler(() => `${this.uuid}|${this.hashHandler.getVersion()}`);
    }

    setBuildKey(buildKey: (...args: any[]) => string): void {
        this.hashHandler.setBuildKey(buildKey);
        this.changeStamp.mark();
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
        this.changeStamp.mark();
    }

    getChangedAt(): number {
        return this.changeStamp.get();
    }

    getVersion(): number {
        return this.hashHandler.getVersion();
    }

    convertToHash(hasher: Hasher): string {
        return this.hashHandler.convertToHash(hasher);
    }
}