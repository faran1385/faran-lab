import {vec3} from "../../packages/math/vector/vec3.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import {VersionFlag} from "../hashing/VersionFlag.ts";
import {v4 as uuidv4} from "uuid";

export abstract class Camera {
    readonly uuid: string
    protected position = vec3.fromValues(0, 0, 0);
    protected target = vec3.fromValues(0, 0, -1);
    protected up = vec3.fromValues(0, 1, 0);

    private viewMatrix = mat4.create();
    private projectionMatrix = mat4.create();

    private readonly viewFlag = new VersionFlag();
    private readonly projectionFlag = new VersionFlag();
    private readonly uploadVewFlag = new VersionFlag();
    private readonly uploadProjectionFlag = new VersionFlag();

    constructor() {
        this.uuid = uuidv4();
        this.viewFlag.addVersion();
        this.uploadVewFlag.addVersion()
        this.projectionFlag.addVersion();
        this.uploadProjectionFlag.addVersion()
    }

    setPosition(x: number, y: number, z: number): this {
        vec3.set(this.position, x, y, z);
        this.viewFlag.addVersion();
        this.uploadVewFlag.addVersion()
        return this;
    }

    lookAt(x: number, y: number, z: number): this {
        vec3.set(this.target, x, y, z);
        this.viewFlag.addVersion();
        this.uploadVewFlag.addVersion()
        return this;
    }

    setUp(x: number, y: number, z: number): this {
        vec3.set(this.up, x, y, z);
        this.viewFlag.addVersion();
        this.uploadVewFlag.addVersion()
        return this;
    }

    getPosition() {
        return this.position;
    }

    getViewMatrix() {
        if (this.viewFlag.needsUpdate()) {
            mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
            this.viewFlag.sync();
        }
        return this.viewMatrix;
    }

    getProjectionMatrix() {
        if (this.projectionFlag.needsUpdate()) {
            this.updateProjectionMatrix(this.projectionMatrix);
            this.projectionFlag.sync();
        }
        return this.projectionMatrix;
    }


    isViewDirty(): boolean {
        return this.viewFlag.needsUpdate();
    }

    isProjectionDirty(): boolean {
        return this.projectionFlag.needsUpdate();
    }

    isUploadViewDirty() {
        return this.uploadVewFlag.needsUpdate();
    }

    isUploadProjectionDirty() {
        return this.uploadProjectionFlag.needsUpdate();
    }

    syncUploadView() {
        this.uploadVewFlag.sync();
    }

    syncUploadProjection() {
        this.uploadProjectionFlag.sync();
    }

    protected markProjectionDirty(): void {
        this.projectionFlag.addVersion();
        this.uploadProjectionFlag.addVersion()
    }

    protected abstract updateProjectionMatrix(out: Float32Array): void;
}