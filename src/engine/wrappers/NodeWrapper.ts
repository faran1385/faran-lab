import type {MeshWrapper} from "./MeshWrapper.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import type {Node} from "../importers/utils/IR.ts";
import {v4 as uuidv4} from "uuid";
import {vec3} from "../../packages/math/vector/vec3.ts";
import {quat} from "../../packages/math/quat/quat.ts";
import {NodeHashProvider} from "../hashing/NodeHashProvider.ts";
import {NodeAdaptor} from "../adaptors/NodeAdaptor.ts";

export class NodeWrapper {
    private adaptor: NodeAdaptor;
    readonly uuid: string;
    private name?: string;
    private mesh: MeshWrapper | null = null;
    private children = new Map<string, NodeWrapper>();
    private parent?: NodeWrapper;

    private translation: Float32Array;
    private rotation: Float32Array;
    private scale: Float32Array;

    private localMatrix = mat4.create();
    readonly hashProvider: NodeHashProvider;
    private _cachedChildrenArray: NodeWrapper[] = []


    constructor(
        adaptor?: NodeAdaptor,
        translation?: Node["translation"],
        rotation?: Node["rotation"],
        scale?: Node["scale"],
        name?: string,
    ) {
        this.adaptor = adaptor ?? new NodeAdaptor();
        const t = translation ?? [0, 0, 0] as any;
        const r = rotation ?? [0, 0, 0, 1] as any;
        const s = scale ?? [1, 1, 1] as any;

        this.hashProvider = new NodeHashProvider({
            getMesh: this.getMesh.bind(this),
        })
        this.uuid = uuidv4();
        this.name = name;
        this.scale = vec3.fromValues(s[0], s[1], s[2]);
        this.translation = vec3.fromValues(t[0], t[1], t[2]);
        this.rotation = quat.fromValues(r[0], r[1], r[2], r[3]);
        this.markSubtreeDirty();
    }

    private updateCachedChildren() {
        this._cachedChildrenArray = Array.from(this.children.values())
    }

    getMesh() {
        return this.mesh;
    }

    setMesh(mesh: MeshWrapper | null) {
        this.mesh = mesh;
        this.adaptor.setMesh(mesh)
        this.hashProvider.markMesh();
    }

    setName(name: string | undefined) {
        this.name = name;
    }

    getName() {
        return this.name;
    }

    getTranslation() {
        return this.translation;
    }

    setTranslation(tx: number, ty: number, tz: number) {
        vec3.set(this.translation, tx, ty, tz);
        this.markSubtreeDirty();
    }

    getRotation() {
        return this.rotation;
    }

    setRotation(x: number, y: number, z: number) {
        quat.fromEuler(this.rotation, x, y, z)
        this.markSubtreeDirty();
    }

    getScale() {
        return this.scale;
    }

    setScale(sx: number, sy: number, sz: number) {
        vec3.set(this.scale, sx, sy, sz);
        this.markSubtreeDirty();
    }

    addChild(child: NodeWrapper) {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.set(child.uuid, child);
        child.markSubtreeDirty();
        this.updateCachedChildren();
    }

    removeChild(child: NodeWrapper) {
        if (this.children.delete(child.uuid)) {
            child.parent = undefined;
            child.markSubtreeDirty()
            this.updateCachedChildren();
        }
    }

    getParent() {
        return this.parent;
    }

    getChildren() {
        return this._cachedChildrenArray;
    }

    private markSubtreeDirty(): void {
        if (this.hashProvider.transformNeedsUpdate()) return;
        this.hashProvider.markTransform();
        this.children.forEach((child) => child.markSubtreeDirty());
    }

    getWorldMatrix() {
        return this.adaptor.buffer.getData();
    }

    buildWorldMatrix(parentMatrix: Float32Array | null, uploadToGPUBuffer: (hash: string, data: GPUAllowSharedBufferSource, offset: number) => void) {
        mat4.compose(this.localMatrix, this.translation as any, this.rotation as any, this.scale as any);
        if (parentMatrix) {
            mat4.mul(new Float32Array(this.adaptor.buffer.getData()), parentMatrix, this.localMatrix);
        } else {
            this.adaptor.buffer.setData(this.localMatrix.buffer)
        }

        this.hashProvider.syncTransformUpdate()
        if (this.mesh && this.mesh.getAllPrimitives().length > 0) uploadToGPUBuffer(this.uuid, this.getWorldMatrix(), 0);

        this.children.forEach((child: NodeWrapper) => {
            child.buildWorldMatrix(new Float32Array(this.getWorldMatrix()), uploadToGPUBuffer);
        });
    }
}