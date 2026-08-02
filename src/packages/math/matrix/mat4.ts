import {matrixMultiplication, matrixTranspose} from "./utils.ts";
import {mat3} from "./mat3.ts";
import {vec3} from "../vector/vec3.ts";

export class mat4 {

    static create() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ])
    }

    static fromValues(
        m1: number, m2: number, m3: number, m4: number,
        m5: number, m6: number, m7: number, m8: number,
        m9: number, m10: number, m11: number, m12: number,
        m13: number, m14: number, m15: number, m16: number,
    ) {
        return new Float32Array([
            m1, m2, m3, m4,
            m5, m6, m7, m8,
            m9, m10, m11, m12,
            m13, m14, m15, m16,
        ])
    }

    static identity(out: Float32Array) {
        out.set([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ])

        return out;
    }

    static clone(a: Float32Array) {
        return new Float32Array([
            a[0], a[1], a[2], a[3],
            a[4], a[5], a[6], a[7],
            a[8], a[9], a[10], a[11],
            a[12], a[13], a[14], a[15],
        ])
    }

    static copy(out: Float32Array, mat: Float32Array) {
        return out.set(mat);
    }

    static transpose(out: Float32Array, mat: Float32Array) {
        matrixTranspose(out, mat, 4);
        return out;
    }

    static mul(out: Float32Array, a: Float32Array, b: Float32Array) {
        matrixMultiplication(out, a, b, 4);

        return out;
    }

    static determinant(a: Float32Array) {

        const m = (c: number, r: number) => a[c * 4 + r];

        const minor3 =
            (
                c0: number, c1: number, c2: number,
                r0: number, r1: number, r2: number
            ) =>
                m(c0, r0) * (m(c1, r1) * m(c2, r2) - m(c2, r1) * m(c1, r2))
                - m(c1, r0) * (m(c0, r1) * m(c2, r2) - m(c2, r1) * m(c0, r2))
                + m(c2, r0) * (m(c0, r1) * m(c1, r2) - m(c1, r1) * m(c0, r2));

        const c0 = minor3(1, 2, 3, 1, 2, 3);
        const c1 = minor3(0, 2, 3, 1, 2, 3);
        const c2 = minor3(0, 1, 3, 1, 2, 3);
        const c3 = minor3(0, 1, 2, 1, 2, 3);

        return (
            m(0, 0) * c0
            - m(1, 0) * c1
            + m(2, 0) * c2
            - m(3, 0) * c3
        );
    }

    static invert(out: Float32Array, a: Float32Array) {

        const m = (c: number, r: number) => a[c * 4 + r];

        const minor3 =
            (
                c0: number, c1: number, c2: number,
                r0: number, r1: number, r2: number
            ) =>
                m(c0, r0) * (m(c1, r1) * m(c2, r2) - m(c2, r1) * m(c1, r2))
                - m(c1, r0) * (m(c0, r1) * m(c2, r2) - m(c2, r1) * m(c0, r2))
                + m(c2, r0) * (m(c0, r1) * m(c1, r2) - m(c1, r1) * m(c0, r2));

        const cof = new Float32Array(16);

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {

                const cols: number[] = [];
                const rows: number[] = [];

                for (let c = 0; c < 4; c++) {
                    if (c !== col) cols.push(c);
                }

                for (let r = 0; r < 4; r++) {
                    if (r !== row) rows.push(r);
                }

                const sign = ((row + col) & 1) ? -1 : 1;

                cof[col * 4 + row] =
                    sign *
                    minor3(
                        cols[0], cols[1], cols[2],
                        rows[0], rows[1], rows[2]
                    );
            }
        }

        const det =
            m(0, 0) * cof[0]
            + m(1, 0) * cof[4]
            + m(2, 0) * cof[8]
            + m(3, 0) * cof[12];

        if (Math.abs(det) < 1e-8) {
            throw new Error("Matrix is not invertible");
        }

        const invDet = 1 / det;

        // transpose(cofactor) / det
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                out[col * 4 + row] =
                    cof[row * 4 + col] * invDet;
            }
        }

        return out;
    }


    static translateX(out: Float32Array, mat: Float32Array, fac: number) {

        const translationMatrix = this.fromValues(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            fac, 0, 0, 1
        )

        matrixMultiplication(out, mat, translationMatrix, 4)

        return out;
    }

    static translateY(out: Float32Array, mat: Float32Array, fac: number) {

        const translationMatrix = this.fromValues(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, fac, 0, 1
        )

        matrixMultiplication(out, mat, translationMatrix, 4)

        return out;
    }

    static translateZ(out: Float32Array, mat: Float32Array, fac: number) {

        const translationMatrix = this.fromValues(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, fac, 1
        )

        matrixMultiplication(out, mat, translationMatrix, 4)

        return out;
    }

    static translate(out: Float32Array, mat: Float32Array, vec: Float32Array) {

        const translationMatrix = this.fromValues(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            vec[0], vec[1], vec[2], 1
        )

        matrixMultiplication(out, mat, translationMatrix, 4)

        return out;
    }

    static rotateX(out: Float32Array, mat: Float32Array, rad: number) {

        const rotationMat = this.fromValues(
            1, 0, 0, 0,
            0, Math.cos(rad), Math.sin(rad), 0,
            0, -Math.sin(rad), Math.cos(rad), 0,
            0, 0, 0, 1
        )

        matrixMultiplication(out, mat, rotationMat, 4)

        return out;
    }


    static rotateY(out: Float32Array, mat: Float32Array, rad: number) {

        const rotationMat = this.fromValues(
            Math.cos(rad), 0, -Math.sin(rad), 0,
            0, 1, 0, 0,
            Math.sin(rad), 0, Math.cos(rad), 0,
            0, 0, 0, 1
        )

        matrixMultiplication(out, mat, rotationMat, 4)

        return out;
    }

    static fromMat3(out: Float32Array, mat3: Float32Array) {
        out.set([
            mat3[0], mat3[1], mat3[2], 0,
            mat3[3], mat3[4], mat3[5], 0,
            mat3[6], mat3[7], mat3[8], 0,
            0, 0, 0, 1
        ])

        return out
    }

    static rotateZ(out: Float32Array, mat: Float32Array, rad: number) {

        const rotationMat = this.fromValues(
            Math.cos(rad), Math.sin(rad), 0, 0,
            -Math.sin(rad), Math.cos(rad), 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        )

        matrixMultiplication(out, mat, rotationMat, 4)

        return out;
    }

    static rotate(out: Float32Array, mat: Float32Array, vec3: Float32Array, rad: number) {
        const {A, B, C} = mat3.findBasisFromAxis(vec3);
        const M = this.fromValues(
            A[0], A[1], A[2], 0,
            B[0], B[1], B[2], 0,
            C[0], C[1], C[2], 0,
            0, 0, 0, 1
        )
        const MT = this.create();
        this.transpose(MT, M);

        const Rx = this.create();
        this.rotateX(Rx, MT, rad);

        matrixMultiplication(M, Rx, M, 4);
        matrixMultiplication(out, mat, M, 4);

        return out;
    }


    static scaleX(out: Float32Array, mat: Float32Array, fac: number) {
        const scaleMat = this.fromValues(
            fac, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        )

        matrixMultiplication(out, mat, scaleMat, 4)
        return out;
    }

    static scaleY(out: Float32Array, mat: Float32Array, fac: number) {
        const scaleMat = this.fromValues(
            1, 0, 0, 0,
            0, fac, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        )

        matrixMultiplication(out, mat, scaleMat, 4)
        return out;
    }

    static scaleZ(out: Float32Array, mat: Float32Array, fac: number) {
        const scaleMat = this.fromValues(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, fac, 0,
            0, 0, 0, 1,
        )

        matrixMultiplication(out, mat, scaleMat, 4)
        return out;
    }

    static scale(out: Float32Array, mat: Float32Array, vec3: Float32Array) {
        const scaleMat = this.fromValues(
            vec3[0], 0, 0, 0,
            0, vec3[1], 0, 0,
            0, 0, vec3[2], 0,
            0, 0, 0, 1,
        )

        matrixMultiplication(out, mat, scaleMat, 4)
        return out;
    }

    static orthographic(out: Float32Array, left: number, right: number, bottom: number, top: number, near: number, far: number) {
        const R = right;
        const L = left;
        const T = top;
        const B = bottom;
        const F = -far;
        const N = -near;

        out.set([
            2 / (R - L), 0, 0, 0,
            0, 2 / (T - B), 0, 0,
            0, 0, 1 / (F - N), 0,
            -(L + R) / (R - L), -(B + T) / (T - B), -N / (F - N), 1
        ])

        return out;
    }

    static perspective(out: Float32Array, aspect: number, fov: number, near: number, far: number) {
        const F = -far;
        const N = -near;
        const Fov = fov * Math.PI / 180;
        const T = Math.tan(Fov / 2) * N;
        const R = T * aspect;


        out.set([
            N / R, 0, 0, 0,
            0, N / T, 0, 0,
            0, 0, F / (N - F), -1,
            0, 0, -N * F / (N - F), 0
        ])

        return out;
    }


    static lookAt(out: Float32Array, eye: Float32Array, target: Float32Array, up: Float32Array) {
        const Z = vec3.create();
        vec3.sub(Z, eye, target);
        vec3.normalize(Z, Z);

        const X = vec3.create();
        vec3.cross(X, up, Z);
        vec3.normalize(X, X);

        const Y = vec3.create();
        vec3.cross(Y, Z, X)
        vec3.normalize(Y, Y);

        const RT = this.fromValues(
            X[0], X[1], X[2], 0,
            Y[0], Y[1], Y[2], 0,
            Z[0], Z[1], Z[2], 0,
            0, 0, 0, 1
        );

        this.transpose(RT, RT);

        const TI = this.fromValues(
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            -eye[0], -eye[1], -eye[2], 1,
        );

        matrixMultiplication(out, TI, RT, 4);
        return out;
    }



    static toQuat(out: Float32Array, mat: Float32Array) {
        const t = mat[0] + mat[5] + mat[10];

        if (t > 0) {
            const w = 0.5 * Math.sqrt(1 + t);
            out[0] = (mat[6] - mat[9]) / (4 * w);
            out[1] = (mat[8] - mat[2]) / (4 * w);
            out[2] = (mat[1] - mat[4]) / (4 * w);
            out[3] = w;
        } else {
            const x = 0.5 * Math.sqrt(1 + mat[0] - mat[4] - mat[8])
            out[3] = (mat[6] - mat[9]) / (4 * x)
            out[1] = (mat[4] + mat[1]) / (4 * x)
            out[2] = (mat[8] + mat[2]) / (4 * x)
            out[0] = x
        }

        return out;
    }
}