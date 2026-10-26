import {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import {SceneAdaptor} from "../Adaptors/SceneAdaptor.ts";
import {v4 as uuidv4} from "uuid";
import type {NodeInternal} from "../internals/NodeInternal.ts";
import {NodeAdaptor} from "../Adaptors/NodeAdaptor.ts";

/**
 * The friendly scene API. Renderer.render() accepts this wrapper and, after the pre-frame queue flushes, reads the
 * flattened SceneInternal maintained by SceneAdaptor.
 */
export class Scene {
    private readonly worldRoot = new NodeWrapper();
    readonly uuid: string;
    readonly adaptor: SceneAdaptor;

    constructor() {
        this.uuid = uuidv4();
        this.adaptor = new SceneAdaptor(this.worldRoot.adaptor);
    }

    addNode(node: NodeWrapper | NodeInternal): void {
        this.worldRoot.addChild(node instanceof NodeWrapper ? node : new NodeWrapper(new NodeAdaptor(node)));
    }

    removeNode(node: NodeWrapper): void {
        this.worldRoot.removeChild(node);
    }

    getRootNodes() {
        return this.worldRoot.getChildren();
    }

    traverse(callback: (node: NodeWrapper) => void): void {
        const walk = (node: NodeWrapper): void => {
            callback(node);
            for (const child of node.getChildren()) {
                walk(child);
            }
        };

        for (const root of this.worldRoot.getChildren()) {
            walk(root);
        }
    }
}
