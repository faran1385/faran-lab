import {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import {SceneAdaptor} from "../adaptors/SceneAdaptor.ts";
import {v4 as uuidv4} from "uuid";

/**
 * The friendly scene API. The renderer does not take this: it takes `scene.adaptor.internal` (a SceneInternal, the
 * flat list of nodes to draw), exactly like every other wrapper hands its internal to the engine.
 */
export class Scene {
    private readonly worldRoot = new NodeWrapper();
    readonly uuid: string;
    readonly adaptor: SceneAdaptor;

    constructor() {
        this.uuid = uuidv4();
        this.adaptor = new SceneAdaptor(this.worldRoot.adaptor);
    }

    addNode(node: NodeWrapper): void {
        this.worldRoot.addChild(node);
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
