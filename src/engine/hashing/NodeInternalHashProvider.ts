import { RepresentationHashProvider } from "./RepresentationHashProvider.ts";
import type { BindgroupInteractor } from "../Representations/BindgroupInteractor.ts";
import type { PipelineInteractor } from "../Representations/PipelineInteractor.ts";
import type { MeshInternal } from "../internals/MeshInternal.ts";

type InputFunctions = {
    getGroup: () => number;
    getBindgroup: () => BindgroupInteractor;
    getPipeline: () => PipelineInteractor;
    getMesh: () => MeshInternal | null;
};

/** Combines the node's own bindings/pipeline with its attached mesh and all descendant primitive state. */
export class NodeInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => [
                `group=${T.getGroup()}`,
                `bindings=${T.getBindgroup().hashProvider.convertToHash(hasher)}`,
                `pipeline=${T.getPipeline().hashProvider.convertToHash(hasher)}`,
                `mesh=${T.getMesh()?.hashProvider.convertToHash(hasher) ?? "none"}`,
            ].join("#"),
            getChildrenChangedAt: () => Math.max(
                T.getBindgroup().hashProvider.getChangedAt(),
                T.getPipeline().hashProvider.getChangedAt(),
                T.getMesh()?.hashProvider.getChangedAt() ?? 0,
            ),
        });
    }
}
