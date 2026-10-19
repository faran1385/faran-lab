import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import type {PrimitiveInternal} from "../internals/PrimitiveInternal.ts";

type InputFunctions = {
    getPrimitives: () => Map<string, PrimitiveInternal>,
}

/** The primitives of a mesh, in the order they were added (draw order). */
export class MeshInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => Array.from(T.getPrimitives().values())
                .map((p) => p.hashProvider.convertToHash(hasher))
                .join("|"),
            getChildrenChangedAt: () => {
                let at = 0;
                for (const p of T.getPrimitives().values()) at = Math.max(at, p.hashProvider.getChangedAt());
                return at;
            },
        });
    }
}
