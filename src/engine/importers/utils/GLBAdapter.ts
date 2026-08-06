
import type {GLBParseResult} from "../../loaders/GLBLoader.ts";
import type {GLTFParseResult} from "../GLTFImporter.ts";

export function ImportFromGLB(result: GLBParseResult): GLTFParseResult {



    return {
        json: result.json,
        buffers: result.binaryChunk ? [result.binaryChunk] : [],
    };
}