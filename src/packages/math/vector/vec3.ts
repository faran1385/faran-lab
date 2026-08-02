export class vec3 {


    static fromValues(x: number, y: number, z: number): Float32Array {
        return new Float32Array([x, y, z]);
    }

    static create(): Float32Array {
        return new Float32Array([0, 0, 0]);
    }


    static clone(v: Float32Array) {
        return new Float32Array([v[0], v[1], v[2]]);
    }

    static add(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];

        return out;
    }

    static sub(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];

        return out;
    }

    static mul(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[0] * b[0];
        out[1] = a[1] * b[1];
        out[2] = a[2] * b[2];

        return out;
    }

    static div(out: Float32Array, a: Float32Array, b: Float32Array) {
        if (b[0] === 0 || b[1] === 0 || b[2] === 0) console.warn("Dominator is be 0");
        out[0] = a[0] / b[0];
        out[1] = a[1] / b[1];
        out[2] = a[2] / b[2];

        return out;
    }


    static scale(out: Float32Array, a: Float32Array, s: number) {
        out[0] = a[0] * s;
        out[1] = a[1] * s;
        out[2] = a[2] * s;

        return out;
    }

    static length(a: Float32Array) {
        return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    }

    static normalize(out: Float32Array, a: Float32Array) {
        const length = vec3.length(a);

        if (length === 0) {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            return out;
        }

        out[0] = a[0] / length;
        out[1] = a[1] / length;
        out[2] = a[2] / length;

        return out;
    }

    static dot(a: Float32Array, b: Float32Array) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }


    static lerp(out: Float32Array, a: Float32Array, b: Float32Array, t: number) {
        out[0] = (1 - t) * a[0] + t * b[0];
        out[1] = (1 - t) * a[1] + t * b[1];
        out[2] = (1 - t) * a[2] + t * b[2];

        return out;
    }

    static distance(a: Float32Array, b: Float32Array) {
        return Math.sqrt(
            Math.pow(a[0] - b[0], 2) +
            Math.pow(a[1] - b[1], 2) +
            Math.pow(a[2] - b[2], 2)
        );
    }

    static copy(out: Float32Array, mat: Float32Array) {
        return out.set(mat);
    }


    static cross(out: Float32Array, a: Float32Array, b: Float32Array) {
        out[0] = a[1] * b[2] - a[2] * b[1];
        out[1] = a[2] * b[0] - a[0] * b[2];
        out[2] = a[0] * b[1] - a[1] * b[0];

        return out;
    }

    static slerp(out: Float32Array, a: Float32Array, b: Float32Array, t: number) {
        const A = vec3.create();
        this.normalize(A, a)
        const B = vec3.create();
        this.normalize(B, b)

        let dot = this.dot(A, B);

        dot = Math.max(-1, Math.min(1, dot));

        if (Math.abs(dot) >= 0.9999) {
            if (dot < 0) {
                this.scale(B, B, -1);
            }
            this.lerp(out, A, B, t);
            this.normalize(out, out);
            return out;
        }

        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);

        this.scale(A, A, Math.sin(((1 - t) * theta) / sinTheta))
        this.scale(B, B, Math.sin((t * theta) / sinTheta))

        this.add(out, A, B)
        this.normalize(out, out);

        return out;
    }
}
