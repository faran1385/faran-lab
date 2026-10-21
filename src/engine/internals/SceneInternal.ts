import {v4 as uuidv4} from "uuid";
import type {NodeInternal} from "./NodeInternal.ts";

/**
 * What the renderer draws: a flat list of the nodes that carry a mesh. The renderer never walks a node hierarchy and
 * never reads a wrapper; keeping this list current is the SceneAdaptor's job.
 */
export class SceneInternal {
    readonly uuid: string;
    private nodes: readonly NodeInternal[] = [];

    constructor() {
        this.uuid = uuidv4();
    }

    getNodes(): readonly NodeInternal[] {
        return this.nodes;
    }

    setNodes(nodes: readonly NodeInternal[]): void {
        this.nodes = nodes;
    }
}
