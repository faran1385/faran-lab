import {Camera} from "./Camera.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";

export class PerspectiveCamera extends Camera {
    private fovY: number;
    private aspect: number;
    private near: number;
    private far: number;

    constructor(
        fovY: number,
        aspect: number,
        near: number,
        far: number,
    ) {
        super();
        this.fovY = fovY;
        this.aspect = aspect;
        this.near = near;
        this.far = far;
    }

    setFov(fovY: number): this {
        this.fovY = fovY;
        this.markProjectionDirty();
        return this;
    }

    setAspect(aspect: number): this {
        this.aspect = aspect;
        this.markProjectionDirty();
        return this;
    }

    setNear(near: number): this {
        this.near = near;
        this.markProjectionDirty();
        return this;
    }

    setFar(far: number): this {
        this.far = far;
        this.markProjectionDirty();
        return this;
    }

    protected updateProjectionMatrix(out: Float32Array): void {
        mat4.perspective(out, this.aspect, this.fovY, this.near, this.far);
    }
}