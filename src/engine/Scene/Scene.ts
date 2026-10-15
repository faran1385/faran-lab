import {NodeWrapper} from "../wrappers/NodeWrapper.ts";
import {v4 as uuidv4} from "uuid";
import type {CentralManager} from "../managers/CentralManager.ts";

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

    private walkWorldMatrices(node: NodeWrapper, parentMatrix: Float32Array | null, managers: CentralManager) {
        if (node.hashProvider.transformNeedsUpdate()) {
            node.buildWorldMatrix(parentMatrix, managers);
            return; // invariant: descendants are already dirty, buildWorldMatrix handles them
        }
        for (const child of node.getChildren()) {
            this.walkWorldMatrices(child, node.getWorldMatrix(), managers);
        }
    };

    updateWorldMatrices(managers: CentralManager): void {
        for (const root of this.worldRoot.getChildren()) {
            this.walkWorldMatrices(root, null, managers);
        }
    }
}