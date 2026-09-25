import {v4 as uuidv4} from "uuid";
import type {MeshWrapper} from "./MeshWrapper.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import type {Node} from "../importers/utils/IR.ts";
import {VersionFlag} from "../hashing/VersionFlag.ts";
import {vec3} from "../../packages/math/vector/vec3.ts";
import {quat} from "../../packages/math/quat/quat.ts";

const scratchLocal = mat4.create();

export class NodeWrapper {
    readonly uuid: string;
    private name?: string;
    private mesh?: MeshWrapper;
    private children = new Map<string, NodeWrapper>();

    private translation: Float32Array;
    private rotation: Float32Array;
    private scale: Float32Array;

    private worldMatrix = mat4.create();

    private readonly transformFlag = new VersionFlag();

    constructor(
        translation?: Node["translation"],
        rotation?: Node["rotation"],
        scale?: Node["scale"],
        name?: string,
    ) {
        translation = translation ?? [0, 0, 0];
        rotation = rotation ?? [0, 0, 0, 0];
        scale = scale ?? [1, 1, 1];

        this.uuid = uuidv4();
        this.name = name;
        this.scale = vec3.fromValues(scale[0], scale[1], scale[2]);
        this.translation = vec3.fromValues(translation[0], translation[1], translation[2]);
        this.rotation = quat.fromValues(rotation[0], rotation[1], rotation[2], rotation[3]);
        this.transformFlag.addVersion();
    }

    getMesh() {
        return this.mesh;
    }

    setMesh(mesh: MeshWrapper) {
        this.mesh = mesh;
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
        this.transformFlag.addVersion();
    }

    getRotation() {
        return this.rotation;
    }

    setRotation(x: number, y: number, z: number, w: number) {
        quat.set(this.rotation, x, y, z, w);
        this.transformFlag.addVersion();
    }

    getScale() {
        return this.scale;
    }

    setScale(sx: number, sy: number, sz: number) {
        vec3.set(this.scale, sx, sy, sz);
        this.transformFlag.addVersion();
    }

    addChild(child: NodeWrapper) {
        this.children.set(child.uuid, child);
        child.transformFlag.addVersion();
    }

    getChildren(): IterableIterator<NodeWrapper> {
        return this.children.values();
    }

    isTransformDirty(): boolean {
        return this.transformFlag.needsUpdate();
    }

    getWorldMatrix() {
        return this.worldMatrix;
    }

    buildWorldMatrix(parentMatrix: Float32Array, uploadToGPUBuffer: (hash: string, data: GPUAllowSharedBufferSource, offset: number) => void) {

        mat4.compose(scratchLocal, this.translation as any, this.rotation as any, this.scale as any);
        mat4.mul(this.worldMatrix, parentMatrix, scratchLocal);

        this.transformFlag.sync();
        uploadToGPUBuffer(this.uuid, this.worldMatrix, 0)

        this.children.forEach((child: NodeWrapper) => {
            child.buildWorldMatrix(this.worldMatrix, uploadToGPUBuffer);
        });
    }
}