// wrappers/AttributeWrapperBase.ts
import {v4 as uuidv4} from 'uuid';
import {Hasher} from "../hashing/Hasher.ts";

export abstract class AttributeWrapperBase<TFormat> {
    readonly uuid: string;

    protected format: TFormat;
    protected data: ArrayBuffer;

    private version: number = 0;
    private cachedHash: string | null = null;
    private cachedHashVersion: number = -1;

    protected constructor(data: ArrayBuffer, format: TFormat) {
        this.uuid = uuidv4();
        this.data = data;
        this.format = format;
    }

    getData(): ArrayBuffer {
        return this.data;
    }

    setData(data: ArrayBuffer): void {
        this.data = data;
        this.version++;
    }

    getFormat(): TFormat {
        return this.format;
    }

    setFormat(format: TFormat): void {
        this.format = format;
        this.version++;
    }

    getVersion(): number {
        return this.version;
    }

    convertToHash(hasher: Hasher): string {
        if (this.cachedHash === null || this.cachedHashVersion !== this.version) {
            this.cachedHash = this.computeHash(hasher);
            this.cachedHashVersion = this.version;
        }
        return this.cachedHash;
    }


    protected computeHash(hasher: Hasher): string {
        return hasher.hashString(`${this.uuid}|${this.version}`);
    }
}