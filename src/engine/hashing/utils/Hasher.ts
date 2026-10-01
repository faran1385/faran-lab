// hash/Hasher.ts
import xxhash from 'xxhash-wasm';

type H64Raw = (inputBuffer: Uint8Array, seed?: bigint) => bigint;
type H64 = (input: string, seed?: bigint) => bigint;

export class Hasher {
    private h64: H64;
    private h64Raw: H64Raw;

    private constructor(h64: H64, h64Raw: H64Raw) {
        this.h64 = h64;
        this.h64Raw = h64Raw;
    }

    static async create(): Promise<Hasher> {
        const {h64, h64Raw} = await xxhash();
        return new Hasher(h64, h64Raw);
    }

    hashString(input: string): string {
        return this.h64(input).toString(16);
    }

    hashArrayBuffer(input: ArrayBuffer): string {
        return this.h64Raw(new Uint8Array(input)).toString(16);
    }
}