import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import {stableKey} from "./utils/stableKey.ts";

type InputFunctions = {
    getVertexLayouts: () => Map<number, GPUVertexBufferLayout>,
}

/** The vertex buffer layouts, by slot. */
export class GeometryInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: () => Array.from(T.getVertexLayouts().entries())
                .sort(([a], [b]) => a - b)
                .map(([index, layout]) => `${index}:${stableKey(layout)}`)
                .join("|"),
        });
    }
}
