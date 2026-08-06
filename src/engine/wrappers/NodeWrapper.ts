import {v4 as uuidv4} from "uuid";
import type {MeshWrapper} from "./MeshWrapper.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import type {Node} from "../importers/utils/IR.ts";

export class NodeWrapper {
    readonly uuid: string;
    private name?: string;
    private mesh?: MeshWrapper;
    private children = new Map<string, NodeWrapper>();
    private localMatrix = mat4.create();
    private worldMatrix = mat4.create();

    constructor(
        translation: Node["translation"],
        rotation: Node["rotation"],
        scale: Node["scale"],
        name?: string,
    ) {
        this.uuid = uuidv4();
        this.name = name;
        mat4.compose(this.localMatrix, translation as any, rotation as any, scale as any);
    }

    addChild(child: NodeWrapper) {
        this.children.set(child.uuid, child);
    }

    setMesh(mesh: MeshWrapper | undefined) {
        this.mesh = mesh;
    }

    buildWorldMatrix(parentMatrix: Float32Array) {
        mat4.mul(this.worldMatrix, parentMatrix, this.localMatrix);

        this.children.forEach((child: NodeWrapper) => {
            child.buildWorldMatrix(this.worldMatrix);
        })
    }
}