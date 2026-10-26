import {vec3} from "../../packages/math/vector/vec3.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import {VersionFlag} from "../hashing/utils/VersionFlag.ts";
import {v4 as uuidv4} from "uuid";
import {CameraInternal} from "./CameraInternal.ts";

export abstract class Camera extends CameraInternal {
    readonly uuid: string
    protected position = vec3.fromValues(0, 0, 0);
    protected target = vec3.fromValues(0, 0, 0);
    protected up = vec3.fromValues(0, 1, 0);

    private viewMatrix = mat4.create();
    private projectionMatrix = mat4.create();

    private readonly _viewFlag = new VersionFlag();
    private readonly _projectionFlag = new VersionFlag();
    private readonly uploadVewFlag = new VersionFlag();
    private readonly uploadProjectionFlag = new VersionFlag();

    constructor() {
        super();
        this.uuid = uuidv4();
        this._viewFlag.addVersion();
        this.uploadVewFlag.addVersion();
        this._projectionFlag.addVersion();
        this.uploadProjectionFlag.addVersion();
    }

    setPosition(x: number, y: number, z: number): this {
        vec3.set(this.position, x, y, z);
        this._viewFlag.addVersion();
        this.uploadVewFlag.addVersion();
        return this;
    }

    lookAt(x: number, y: number, z: number): this {
        vec3.set(this.target, x, y, z);
        this._viewFlag.addVersion();
        this.uploadVewFlag.addVersion();
        return this;
    }

    setUp(x: number, y: number, z: number): this {
        vec3.set(this.up, x, y, z);
        this._viewFlag.addVersion();
        this.uploadVewFlag.addVersion();
        return this;
    }

    getPosition() {
        return this.position;
    }

    getViewMatrix() {
        if (this._viewFlag.needsUpdate()) {
            mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
            this._viewFlag.sync();
        }
        return this.viewMatrix;
    }

    getProjectionMatrix() {
        if (this._projectionFlag.needsUpdate()) {
            this.updateProjectionMatrix(this.projectionMatrix);
            this._projectionFlag.sync();
        }
        return this.projectionMatrix;
    }

    /**
     * Writes changed matrices into this camera's CPU-side uniform buffer.
     * BufferInternal queues the upload; the renderer's normal upload layer performs it.
     */
    updateBuffer(): void {
        let dirty = false;
        const data = new Float32Array(this.buffer.getData());

        if (this.uploadVewFlag.needsUpdate()) {
            data.set(this.getViewMatrix(), 0);
            this.uploadVewFlag.sync();
            dirty = true;
        }
        if (this.uploadProjectionFlag.needsUpdate()) {
            data.set(this.getProjectionMatrix(), 16);
            this.uploadProjectionFlag.sync();
            dirty = true;
        }

        if (dirty) this.buffer.markDirty();
    }

    protected markProjectionDirty(): void {
        this._projectionFlag.addVersion();
        this.uploadProjectionFlag.addVersion();
    }

    protected abstract updateProjectionMatrix(out: Float32Array): void;
}
