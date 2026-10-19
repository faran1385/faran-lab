import { RepresentationHashProvider } from "./RepresentationHashProvider.ts";
import type { MaterialInternal } from "../internals/MaterialInternal.ts";
import type { GeometryInternal } from "../internals/GeometryInternal.ts";
import type { ShaderStageRepresentation } from "../Representations/ShaderStageRepresentation.ts";
import type { Hasher } from "./utils/Hasher.ts";

type InputFunctions = {
    getMat: () => MaterialInternal;
    getGeo: () => GeometryInternal;
    getVertex: () => ShaderStageRepresentation;
    getFragment: () => ShaderStageRepresentation;
};

/** A primitive's identity is the combined material, geometry, and vertex/fragment shader-stage state. */
export class PrimitiveInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        const stageKey = (stage: ShaderStageRepresentation, hasher: Hasher) =>
            `${stage.hashProvider.convertToHash(hasher)}@${stage.getEntryPoint() ?? ""}`;
        super({
            buildKey: (hasher) => [
                `material=${T.getMat().hashProvider.convertToHash(hasher)}`,
                `geometry=${T.getGeo().hashProvider.convertToHash(hasher)}`,
                `vertex=${stageKey(T.getVertex(), hasher)}`,
                `fragment=${stageKey(T.getFragment(), hasher)}`,
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
