import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import type {MaterialInternal} from "../internals/MaterialInternal.ts";
import type {GeometryInternal} from "../internals/GeometryInternal.ts";
import type {ShaderStageRepresentation} from "../Representations/ShaderStageRepresentation.ts";
import type {Hasher} from "./utils/Hasher.ts";

type InputFunctions = {
    getMat: () => MaterialInternal,
    getGeo: () => GeometryInternal,
    getVertex: () => ShaderStageRepresentation,
    getFragment: () => ShaderStageRepresentation,
}

/**
 * Everything a primitive is made of: its material, its geometry and both shader stages. It is built from the hashes
 * of the connected internals, so swapping the material for one with different content changes it, and swapping for
 * an identical one does not.
 */
export class PrimitiveInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        const stage = (s: ShaderStageRepresentation, hasher: Hasher) => `${s.hashProvider.convertToHash(hasher)}@${s.getEntryPoint() ?? ""}`;
        super({
            buildKey: (hasher) => [
                `m=${T.getMat().hashProvider.convertToHash(hasher)}`,
                `g=${T.getGeo().hashProvider.convertToHash(hasher)}`,
                `v=${stage(T.getVertex(), hasher)}`,
                `f=${stage(T.getFragment(), hasher)}`,
            ].join("#"),
            getChildrenChangedAt: () => Math.max(
                T.getMat().hashProvider.getChangedAt(),
                T.getGeo().hashProvider.getChangedAt(),
                T.getVertex().hashProvider.getChangedAt(),
                T.getFragment().hashProvider.getChangedAt(),
            ),
        });
    }
}
