export class vec4 {

    static fromValues(x: number, y: number, z: number, w: number): Float32Array {
        return new Float32Array([x, y, z, w]);
    }

    static create(): Float32Array {
        return new Float32Array([0, 0, 0, 0]);
    }


    static clone(v: Float32Array) {
        return new Float32Array([v[0], v[1], v[2], v[3]]);
    }

    static add(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        out[3] = a[3] + b[3];

        return out;
    }

    static sub(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];
        out[3] = a[3] - b[3];

        return out;
    }

    static mul(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] * b[0];
        out[1] = a[1] * b[1];
        out[2] = a[2] * b[2];
        out[3] = a[3] * b[3];

        return out;
    }

    static div(out: Float32Array, a: Float32Array, b: Float32Array) {
        if (b[0] === 0 || b[1] === 0 || b[2] === 0 || b[3] === 0) throw new Error("Cannot divide by 0");
        out[0] = a[0] / b[0];
        out[1] = a[1] / b[1];
        out[2] = a[2] / b[2];
        out[3] = a[3] / b[3];

        return out;
    }


    static scale(out: Float32Array, a: Float32Array, s: number) {
        out[0] = a[0] * s;
        out[1] = a[1] * s;
        out[2] = a[2] * s;
        out[3] = a[3] * s;

        return out;
    }

    static length(a: Float32Array) {
        return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]);
    }

    static normalize(out: Float32Array, a: Float32Array) {
        const length = vec4.length(a);

        if (length === 0) {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
            return out;
        }

        out[0] = a[0] / length;
        out[1] = a[1] / length;
        out[2] = a[2] / length;
        out[3] = a[3] / length;

        return out;
    }

    static dot(a: Float32Array, b: Float32Array) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    }

    static lerp(out: Float32Array, a: Float32Array, b: Float32Array, t: number) {
        out[0] = (1 - t) * a[0] + t * b[0];
        out[1] = (1 - t) * a[1] + t * b[1];
        out[2] = (1 - t) * a[2] + t * b[2];
        out[3] = (1 - t) * a[3] + t * b[3];

        return out;
    }

    static copy(out: Float32Array, mat: Float32Array) {
        return out.set(mat);
    }

    static distance(a: Float32Array, b: Float32Array) {
        return Math.sqrt(
            Math.pow(a[0] - b[0], 2) +
            Math.pow(a[1] - b[1], 2) +
            Math.pow(a[2] - b[2], 2) +
            Math.pow(a[3] - b[3], 2)
        );
    }

    static transformMat4(out: Float32Array, vec: Float32Array, mat: Float32Array) {

        out[0] = mat[0] * vec[0] + mat[4] * vec[1] + mat[8] * vec[2] + mat[12] * vec[3];
        out[1] = mat[1] * vec[0] + mat[5] * vec[1] + mat[9] * vec[2] + mat[13] * vec[3];
        out[2] = mat[2] * vec[0] + mat[6] * vec[1] + mat[10] * vec[2] + mat[14] * vec[3];
        out[3] = mat[3] * vec[0] + mat[7] * vec[1] + mat[11] * vec[2] + mat[15] * vec[3];

        return out;
    }
}
