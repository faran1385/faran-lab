import {GLTFImporter} from "../importers/GLTFImporter.ts";
import {IRToSceneConvertor} from "../importers/utils/IRToSceneConvertor.ts";

export interface GLBParseResult {
    json: any;
    binaryChunk: ArrayBuffer | null;
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_TYPE_JSON = 0x4e4f534a; // "JSON"
const CHUNK_TYPE_BIN = 0x004e4942; // "BIN\0"

export class GLBLoader {
    private cache = new Map<string, GLBParseResult>();

    constructor() {
    }

    async load(url: string) {
        const result = this.cache.get(url) ?? await this.fetchAndParse(url);

        const sceneIR = await GLTFImporter.import({
            buffers: [result.binaryChunk ?? new ArrayBuffer()],
            json: result.json
        })
        const convertedData = IRToSceneConvertor.convert(sceneIR);
        this.cache.set(url, result);

        return convertedData;
    }

    clearCache(url?: string) {
        if (url) {
            this.cache.delete(url);
        } else {
            this.cache.clear();
        }
    }

    private async fetchAndParse(url: string): Promise<GLBParseResult> {
        const req = await fetch(url);
        const arrayBuffer = await req.arrayBuffer();
        return this.parse(arrayBuffer);
    }

    private parse(arrayBuffer: ArrayBuffer): GLBParseResult {
        const dataView = new DataView(arrayBuffer);

        // --- header (12 bytes) ---
        const magic = dataView.getUint32(0, true);
        if (magic !== GLB_MAGIC) {
            throw new Error("GLBLoader: invalid magic, not a GLB file");
        }

        const version = dataView.getUint32(4, true);
        if (version !== 2) {
            throw new Error(`GLBLoader: unsupported version ${version}`);
        }

        const totalLength = dataView.getUint32(8, true);

        // --- chunks ---
        let offset = 12;
        let json: any = null;
        let binaryChunk: ArrayBuffer | null = null;

        while (offset < totalLength) {
            const chunkLength = dataView.getUint32(offset, true);
            const chunkType = dataView.getUint32(offset + 4, true);
            const chunkStart = offset + 8;

            if (chunkType === CHUNK_TYPE_JSON) {
                const jsonBytes = new Uint8Array(arrayBuffer, chunkStart, chunkLength);
                const jsonText = new TextDecoder("utf-8").decode(jsonBytes);
                json = JSON.parse(jsonText);
            } else if (chunkType === CHUNK_TYPE_BIN) {
                binaryChunk = arrayBuffer.slice(chunkStart, chunkStart + chunkLength);
            }

            offset = chunkStart + chunkLength;
        }

        if (!json) {
            throw new Error("GLBLoader: no JSON chunk found");
        }

        return {json, binaryChunk};
    }
}