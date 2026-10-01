import {v4 as uuidv4} from 'uuid';
import {BufferHashProvider} from "../hashing/BufferHashProvider.ts";

export class BufferWrapper<TUsage extends GPUBufferUsageFlags = GPUBufferUsageFlags> {
    readonly uuid: string;

    protected usage: TUsage;
    protected data: ArrayBuffer;
    readonly hashProvider: BufferHashProvider

    constructor(data: ArrayBuffer, usage: TUsage) {
        this.uuid = uuidv4();
        this.data = data;
        this.usage = usage;

        this.hashProvider=new BufferHashProvider(this.uuid)
    }


    getUsage(): TUsage {
        return this.usage;
    }

    getData(): ArrayBuffer {
        return this.data;
    }

    setData(data: ArrayBuffer): void {
        this.data = data;
        this.hashProvider.markHashHandler();
        this.hashProvider.markChangeStamp()
    }

}