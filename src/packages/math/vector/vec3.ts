import {quat} from "../quat/quat.ts";

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
        if (b[0] === 0 || b[1] === 0 || b[2] === 0) console.warn("Dominator can't be 0");
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

    static transformMat3(out: Float32Array, v: Float32Array, m: Float32Array) {

        out[0] = m[0] * v[0] + m[3] * v[1] + m[6] * v[2];
        out[1] = m[1] * v[0] + m[4] * v[1] + m[7] * v[2];
        out[2] = m[2] * v[0] + m[5] * v[1] + m[8] * v[2];

        return out;
    }

    static transformMat4(out: Float32Array, v: Float32Array, m: Float32Array) {

        out[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2];
        out[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2];
        out[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2];

        return out;
    }

    static transformQuat(out: Float32Array, v: Float32Array, q: Float32Array) {
        const length = quat.length(q);
        const lengthSquare = length * length;

        if (lengthSquare === 0) {
            out.set([0, 0, 0, 0])
            return out;
        }


        const qx = q[0];
        const qy = q[1];
        const qz = q[2];
        const qw = q[3];

        const [vx, vy, vz] = v;
        const vw = 0;

        const ax = qw * vx + qx * vw + qy * vz - qz * vy;
        const ay = qw * vy - qx * vz + qy * vw + qz * vx;
        const az = qw * vz + qx * vy - qy * vx + qz * vw;
        const aw = qw * vw - qx * vx - qy * vy - qz * vz;


        const qix = -q[0] / lengthSquare;
        const qiy = -q[1] / lengthSquare;
        const qiz = -q[2] / lengthSquare;
        const qiw = q[3] / lengthSquare;

        out[0] = aw * qix + ax * qiw + ay * qiz - az * qiy;
        out[1] = aw * qiy - ax * qiz + ay * qiw + az * qix;
        out[2] = aw * qiz + ax * qiy - ay * qix + az * qiw;

        return out;
    }
}
