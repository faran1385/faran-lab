import {vec4} from "../vector/vec4.ts";

export class quat {


    static fromValues(x: number, y: number, z: number, w: number): Float32Array {
        return new Float32Array([x, y, z, w]);
    }

    static fromAxisAndAngle(out: Float32Array, v: Float32Array, angle: number) {
        out.set([
            v[0] * Math.sin(angle / 2),
            v[1] * Math.sin(angle / 2),
            v[2] * Math.sin(angle / 2),
            Math.cos(angle / 2),
        ])

        return out;
    }

    static normalize(out: Float32Array, q: Float32Array) {
        vec4.normalize(out, q);

        return out;
    }

    static copy(out: Float32Array, mat: Float32Array) {
        return out.set(mat);
    }


    static create(): Float32Array {
        return new Float32Array([0, 0, 0, 1]);
    }

    static identity(out: Float32Array) {
        out.set([0, 0, 0, 1]);

        return out;
    }


    static clone(q: Float32Array) {
        return new Float32Array([q[0], q[1], q[2], q[3]]);
    }


    static conjugate(out: Float32Array, q: Float32Array) {
        const [x, y, z, w] = q;

        out.set([-x, -y, -z, w]);

        return out;
    }

    static lerp(out: Float32Array, a: Float32Array, b: Float32Array, t: number) {
        return vec4.lerp(out, a, b, t)
    }

    static length(quat: Float32Array) {
        return vec4.length(quat);
    }

    static mul(out: Float32Array, a: Float32Array, b: Float32Array) {
        const [ax, ay, az, aw] = a;
        const [bx, by, bz, bw] = b;

        out[0] = aw * bx + ax * bw + ay * bz - az * by;
        out[1] = aw * by - ax * bz + ay * bw + az * bx;
        out[2] = aw * bz + ax * by - ay * bx + az * bw;
        out[3] = aw * bw - ax * bx - ay * by - az * bz;

        return out;
    }

    static add(out: Float32Array, a: Float32Array, b: Float32Array) {
        return vec4.add(out, a, b)
    }

    static sub(out: Float32Array, a: Float32Array, b: Float32Array) {
        return vec4.sub(out, a, b)
    }

    static invert(out: Float32Array, q: Float32Array) {
        const length = this.length(q);
        const lengthSquare = length * length;

        if (lengthSquare === 0) {
            out.set([0, 0, 0, 0])
            return out;
        }

        out[0] = -q[0] / lengthSquare;
        out[1] = -q[1] / lengthSquare;
        out[2] = -q[2] / lengthSquare;
        out[3] = q[3] / lengthSquare;

        return out;
    }


    static slerp(out: Float32Array, a: Float32Array, b: Float32Array, t: number) {
        const A = vec4.create();
        this.normalize(A, a)
        const B = vec4.create();
        this.normalize(B, b)


        let dot = vec4.dot(A, B);

        dot = Math.max(-1, Math.min(1, dot));

        if (Math.abs(dot) >= 0.9999) {
            if (dot < 0) {
                vec4.scale(B, B, -1);
            }
            this.lerp(out, A, B, t);
            this.normalize(out, out);
            return out;
        }

        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);

        vec4.scale(A, A, Math.sin(((1 - t) * theta) / sinTheta))
        vec4.scale(B, B, Math.sin((t * theta) / sinTheta))

        this.add(out, A, B)
        this.normalize(out, out);

        return out;
    }

    static toMat3(out: Float32Array, quat: Float32Array) {
        const [x, y, z, w] = quat;
        const length = this.length(quat);
        const lengthSquare = length * length;


        if (lengthSquare === 0) {
            out.set([
                0, 0, 0,
                0, 0, 0,
                0, 0, 0,
            ])

            return out
        }

        const s = 2 / lengthSquare;

        const m1 = 1 - s * (y * y + z * z);
        const m2 = s * (x * y + w * z);
        const m3 = s * (x * z - w * y);

        const m4 = s * (x * y - w * z);
        const m5 = 1 - s * (x * x + z * z);
        const m6 = s * (y * z + w * x);

        const m7 = s * (x * z + w * y);
        const m8 = s * (y * z - w * x);
        const m9 = 1 - s * (x * x + y * y);

        out.set([m1, m2, m3, m4, m5, m6, m7, m8, m9])

        return out
    }


    static toMat4(out: Float32Array, quat: Float32Array) {
        const [x, y, z, w] = quat;
        const length = this.length(quat);
        const lengthSquare = length * length;


        if (lengthSquare === 0) {
            out.set([
                0, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 0,
            ])

            return out
        }

        const s = 2 / lengthSquare;

        const m1 = 1 - s * (y * y + z * z);
        const m2 = s * (x * y + w * z);
        const m3 = s * (x * z - w * y);

        const m4 = s * (x * y - w * z);
        const m5 = 1 - s * (x * x + z * z);
        const m6 = s * (y * z + w * x);

        const m7 = s * (x * z + w * y);
        const m8 = s * (y * z - w * x);
        const m9 = 1 - s * (x * x + y * y);

        out.set([
            m1, m2, m3, 0,
            m4, m5, m6, 0,
            m7, m8, m9, 0,
            0, 0, 0, 1,
        ])

        return out
    }


    static fromEuler(roll: number, yaw: number, pitch: number) {
        const cr = Math.cos(roll / 2)
        const sr = Math.sin(roll / 2)
        const cp = Math.cos(pitch / 2)
        const sp = Math.sin(pitch / 2)
        const cy = Math.cos(yaw / 2)
        const sy = Math.sin(yaw / 2)

        const out = this.create();

        out[0] = cy * sp * cr + sy * cp * sr;
        out[1] = sy * cp * cr - cy * sp * sr;
        out[2] = cy * cp * sr - sy * sp * cr;
        out[3] = cy * cp * cr + sy * sp * sr;

        return out;
    }
}