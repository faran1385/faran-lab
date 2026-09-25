import {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import {v4 as uuidv4} from "uuid";

export class Scene {
    private readonly worldRoot = new NodeWrapper();
    readonly uuid: string;


    constructor() {
        this.uuid = uuidv4();
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


    updateWorldMatrices(uploadToGPUBuffer: (hash: string, data: GPUAllowSharedBufferSource, offset: number) => void): void {
        const walk = (node: NodeWrapper, parentMatrix: Float32Array) => {
            if (node.isTransformDirty()) {
                node.buildWorldMatrix(parentMatrix, uploadToGPUBuffer);
                return; // invariant: descendants are already dirty, buildWorldMatrix handles them
            }
            for (const child of node.getChildren()) {
                walk(child, node.getWorldMatrix());
            }
        };
        for (const root of this.worldRoot.getChildren()) {
            walk(root, mat4.create());
        }
    }
}