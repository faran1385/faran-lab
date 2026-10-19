import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";
import type {BindgroupRepresentation} from "../Representations/BindgroupRepresentation.ts";
import type {PipelineRepresentation} from "../Representations/PipelineRepresentation.ts";
import type {MeshInternal} from "../internals/MeshInternal.ts";

type InputFunctions = {
    getGroup: () => number,
    getBindgroup: () => BindgroupRepresentation,
    getPipeline: () => PipelineRepresentation,
    getMesh: () => MeshInternal | null,
}

/** The node's own bind group and pipeline plus the mesh below it (and through it every primitive). */
export class NodeInternalHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({
            buildKey: (hasher) => [
                `g=${T.getGroup()}`,
                `b=${T.getBindgroup().hashProvider.convertToHash(hasher)}`,
                `p=${T.getPipeline().hashProvider.convertToHash(hasher)}`,
                `m=${T.getMesh()?.hashProvider.convertToHash(hasher) ?? "none"}`,
            ].join("#"),
            getChildrenChangedAt: () => Math.max(
                T.getBindgroup().hashProvider.getChangedAt(),
                T.getPipeline().hashProvider.getChangedAt(),
                T.getMesh()?.hashProvider.getChangedAt() ?? 0,
            ),
        });
    }
}
