export class vec2 {

    static fromValues(x: number, y: number): Float32Array {
        return new Float32Array([x, y]);
    }

    static create(): Float32Array {
        return new Float32Array([0, 0]);
    }


    static clone(v: Float32Array) {
        return new Float32Array([v[0], v[1]]);
    }

    static add(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];

        return out;
    }

    static sub(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];

        return out;
    }

    static mul(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] * b[0];
        out[1] = a[1] * b[1];

        return out;
    }

    static copy(out: Float32Array, mat: Float32Array) {
        return out.set(mat);
    }

    static div(out: Float32Array, a: Float32Array, b: Float32Array) {
        if (b[0] === 0 || b[1] === 0) throw new Error("Cannot divide by 0");
        out[0] = a[0] / b[0];
        out[1] = a[1] / b[1];

        return out;
    }


    static scale(out: Float32Array, a: Float32Array, s: number) {
        out[0] = a[0] * s;
        out[1] = a[1] * s;

        return out;
    }

    static length(a: Float32Array) {
        return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
    }

    static normalize(out: Float32Array, a: Float32Array) {
        const length = vec2.length(a);

        if (length === 0) {
            out[0] = 0;
            out[1] = 0;

            return out;
        }

        out[0] = a[0] / length;
        out[1] = a[1] / length;

        return out;
    }

    static dot(a: Float32Array, b: Float32Array) {
        return a[0] * b[0] + a[1] * b[1];
    }

    static lerp(out: Float32Array, a: Float32Array, b: Float32Array, t: number) {
        out[0] = (1 - t) * a[0] + t * b[0];
        out[1] = (1 - t) * a[1] + t * b[1];

        return out;
    }

    static distance(a: Float32Array, b: Float32Array) {
        return Math.sqrt(
            Math.pow(a[0] - b[0], 2) +
            Math.pow(a[1] - b[1], 2)
        );
    }
}
