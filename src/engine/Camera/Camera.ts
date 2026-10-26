import {vec3} from "../../packages/math/vector/vec3.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import {VersionFlag} from "../hashing/utils/VersionFlag.ts";
import {v4 as uuidv4} from "uuid";

export abstract class Camera {
    readonly uuid: string
    protected position = vec3.fromValues(0, 0, 0);
    protected target = vec3.fromValues(0, 0, 0);
    protected up = vec3.fromValues(0, 1, 0);

    private viewMatrix = mat4.create();
    private projectionMatrix = mat4.create();

    private readonly _viewFlag = new VersionFlag();
    private readonly _projectionFlag = new VersionFlag();
    private viewVersion = 0;
    private projectionVersion = 0;

    constructor() {
        this.uuid = uuidv4();
        this._viewFlag.addVersion();
        this._projectionFlag.addVersion();
    }

    setPosition(x: number, y: number, z: number): this {
        vec3.set(this.position, x, y, z);
        this._viewFlag.addVersion();
        this.viewVersion++;
        return this;
    }

    lookAt(x: number, y: number, z: number): this {
        vec3.set(this.target, x, y, z);
        this._viewFlag.addVersion();
        this.viewVersion++;
        return this;
    }

    setUp(x: number, y: number, z: number): this {
        vec3.set(this.up, x, y, z);
        this._viewFlag.addVersion();
        this.viewVersion++;
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

    /** Monotonically increases whenever a view-affecting setter changes the camera. */
    getViewVersion(): number {
        return this.viewVersion;
    }

    /** Monotonically increases whenever a projection-affecting setter changes the camera. */
    getProjectionVersion(): number {
        return this.projectionVersion;
    }

    protected markProjectionDirty(): void {
        this._projectionFlag.addVersion();
        this.projectionVersion++;
    }

    protected abstract updateProjectionMatrix(out: Float32Array): void;
}
