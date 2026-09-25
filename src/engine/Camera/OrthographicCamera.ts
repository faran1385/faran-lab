import {Camera} from "./Camera.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";

export class OrthographicCamera extends Camera {
    private left: number;
    private right: number;
    private bottom: number;
    private top: number;
    private near: number;
    private far: number;

    constructor(
        left: number,
        right: number,
        bottom: number,
        top: number,
        near: number,
        far: number,
    ) {
        super();
        this.left = left;
        this.right = right;
        this.bottom = bottom;
        this.top = top;
        this.near = near;
        this.far = far;
    }

    setBounds(left: number, right: number, bottom: number, top: number): this {
        this.left = left;
        this.right = right;
        this.bottom = bottom;
        this.top = top;
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
        mat4.orthographic(out, this.left, this.right, this.bottom, this.top, this.near, this.far);
    }
}