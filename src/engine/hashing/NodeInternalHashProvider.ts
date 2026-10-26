import { RepresentationHashProvider } from "./RepresentationHashProvider.ts";
import type { PipelineInteractor } from "../Representations/PipelineInteractor.ts";
import type { MeshInternal } from "../internals/MeshInternal.ts";

type InputFunctions = {
    getPipelines: () => Map<string, PipelineInteractor[]>;
    getMesh: () => MeshInternal | null;
};

/** Combines the node's own bindings/pipelines with its attached mesh and all descendant primitive state. */
export class NodeInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => [
                // Content only: the primitive uuid keys the map but is not part of what the node looks like.
                `pipelines=${Array.from(T.getPipelines().values())
                    .map((list) => list.map((p) => p.hashProvider.convertToHash(hasher)).join(","))
                    .join("|")}`,
                `mesh=${T.getMesh()?.hashProvider.convertToHash(hasher) ?? "none"}`,
            ].join("#"),
            getChildrenChangedAt: () => {
                let at = Math.max(
                    T.getMesh()?.hashProvider.getChangedAt() ?? 0,
                );
                for (const list of T.getPipelines().values()) {
                    for (const pipeline of list) at = Math.max(at, pipeline.hashProvider.getChangedAt());
                }
                return at;
            },
        });
    }
}
