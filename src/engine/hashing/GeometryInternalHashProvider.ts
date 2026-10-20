import { RepresentationHashProvider } from "./RepresentationHashProvider.ts";
import { stableKey } from "./utils/stableKey.ts";
import type { AttributeInternal } from "../internals/AttributeInternal.ts";
import type { Draw, DrawIndexed } from "../internals/GeometryInternal.ts";

type InputFunctions = {
    getVertexAttributes: () => Map<number, AttributeInternal>;
    getDrawInfo: () => Draw | DrawIndexed | undefined;
};

/** Hashes the vertex-input structure and draw command, not the mutable contents of vertex buffers. */
export class GeometryInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: () => {
                const attributes = Array.from(T.getVertexAttributes().entries())
                    .sort(([a], [b]) => a - b)
                    .map(([slot, attribute]) =>
                        `${slot}:${stableKey(attribute.getLayout())}:${attribute.hashProvider.convertToHash()}`)
                    .join("|");

                const draw = T.getDrawInfo();
                const drawKey = !draw ? "none" : "indexBuffer" in draw
                    ? stableKey({
                        kind: "indexed",
                        indexFormat: draw.indexFormat,
                        indexCount: draw.indexCount,
                        instanceCount: draw.instanceCount ?? 1,
                        firstIndex: draw.firstIndex ?? 0,
                        baseVertex: draw.baseVertex ?? 0,
                        firstInstance: draw.firstInstance ?? 0,
                        indexBuffer: draw.indexBuffer.hashProvider.convertToHash(),
                    })
                    : stableKey({
                        kind: "draw",
                        vertexCount: draw.vertexCount,
                        instanceCount: draw.instanceCount ?? 1,
                        firstVertex: draw.firstVertex ?? 0,
                        firstInstance: draw.firstInstance ?? 0,
                    });

                return `attributes=${attributes}#draw=${drawKey}`;
            },
            getChildrenChangedAt: () => {
                let at = 0;
                for (const attribute of T.getVertexAttributes().values()) {
                    at = Math.max(at, attribute.hashProvider.getChangedAt());
                }
                const draw = T.getDrawInfo();
                if (draw && "indexBuffer" in draw) {
                    at = Math.max(at, draw.indexBuffer.hashProvider.getChangedAt());
                }
                return at;
            },
        });
    }
}
