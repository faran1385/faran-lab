import {matrixMultiplication, matrixTranspose} from "./utils.ts";
import {vec3 as vec3D} from "../vector/vec3.ts";

export class mat3 {

    static create() {
        return new Float32Array([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ])
    }

    static fromValues(
        m00: number, m10: number, m20: number,
        m01: number, m11: number, m21: number,
        m02: number, m12: number, m22: number
    ) {
        return new Float32Array([
            m00, m10, m20,
            m01, m11, m21,
            m02, m12, m22
        ])
    }

    static identity(out: Float32Array) {
        out.set([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ])

        return out;
    }

    static clone(mat: Float32Array) {
        return new Float32Array([
            mat[0], mat[1], mat[2],
            mat[3], mat[4], mat[5],
            mat[6], mat[7], mat[8]
        ])
    }

    static copy(out: Float32Array, mat: Float32Array) {
        return out.set(mat);
    }

    static transpose(out: Float32Array, mat: Float32Array) {
        matrixTranspose(out, mat, 3);
        return out;
    }

    static mul(out: Float32Array, a: Float32Array, b: Float32Array) {
        matrixMultiplication(out, a, b, 3);

        return out;
    }

    static determinant(a: Float32Array) {
        const Ax = a[0], Ay = a[1], Az = a[2];
        const Bx = a[3], By = a[4], Bz = a[5];
        const Cx = a[6], Cy = a[7], Cz = a[8];

        return (
            Ax * (By * Cz - Cy * Bz)
            - Bx * (Ay * Cz - Cy * Az)
            + Cx * (Ay * Bz - By * Az)
        );
    }

    static invert(out: Float32Array, a: Float32Array) {
        const Ax = a[0], Ay = a[1], Az = a[2];
        const Bx = a[3], By = a[4], Bz = a[5];
        const Cx = a[6], Cy = a[7], Cz = a[8];

        const det =
            Ax * (By * Cz - Cy * Bz)
            - Bx * (Ay * Cz - Cy * Az)
            + Cx * (Ay * Bz - By * Az);

        if (Math.abs(det) < 1e-8) {
            throw new Error("Matrix is not invertible");
        }

        const invDet = 1 / det;

        out[0] = (By * Cz - Cy * Bz) * invDet;
        out[1] = -(Ay * Cz - Cy * Az) * invDet;
        out[2] = (Ay * Bz - By * Az) * invDet;

        out[3] = -(Bx * Cz - Cx * Bz) * invDet;
        out[4] = (Ax * Cz - Cx * Az) * invDet;
        out[5] = -(Ax * Bz - Bx * Az) * invDet;

        out[6] = (Bx * Cy - Cx * By) * invDet;
        out[7] = -(Ax * Cy - Cx * Ay) * invDet;
        out[8] = (Ax * By - Bx * Ay) * invDet;

        return out;
    }


    static translateX(out: Float32Array, mat: Float32Array, fac: number) {

        const translationMat = this.fromValues(
            1, 0, 0,
            0, 1, 0,
            fac, 0, 1,
        )

        matrixMultiplication(out, mat, translationMat, 3)

        return out;
    }

    static translateY(out: Float32Array, mat: Float32Array, fac: number) {

        const translationMat = this.fromValues(
            1, 0, 0,
            0, 1, 0,
            0, fac, 1,
        )

        matrixMultiplication(out, mat, translationMat, 3)

        return out;
    }

    static translate(out: Float32Array, mat: Float32Array, vec: Float32Array) {

        const translationMat = this.fromValues(
            1, 0, 0,
            0, 1, 0,
            vec[0], vec[1], 1,
        )

        matrixMultiplication(out, mat, translationMat, 3)

        return out;
    }

    static rotateX(out: Float32Array, mat: Float32Array, rad: number) {

        const rotationMat = this.fromValues(
            1, 0, 0,
            0, Math.cos(rad), Math.sin(rad),
            0, -Math.sin(rad), Math.cos(rad)
        )

        matrixMultiplication(out, mat, rotationMat, 3)

        return out;
    }

    static rotateY(out: Float32Array, mat: Float32Array, rad: number) {

        const rotationMat = this.fromValues(
            Math.cos(rad), 0, -Math.sin(rad),
            0, 1, 0,
            Math.sin(rad), 0, Math.cos(rad)
        )

        matrixMultiplication(out, mat, rotationMat, 3)

        return out;
    }

    static rotateZ(out: Float32Array, mat: Float32Array, rad: number) {

        const rotationMat = this.fromValues(
            Math.cos(rad), Math.sin(rad), 0,
            -Math.sin(rad), Math.cos(rad), 0,
            0, 0, 1,
        )

        matrixMultiplication(out, mat, rotationMat, 3)

        return out;
    }

    static findBasisFromAxis(vec3: Float32Array) {
        const A = Float32Array.from(vec3);
        vec3D.normalize(A, A)
        const B = vec3D.create();
        const C = vec3D.create();


        const ax = Math.abs(A[0]);
        const ay = Math.abs(A[1]);
        const az = Math.abs(A[2]);

        if (ax <= ay && ax <= az) {
            [B[1], B[2]] = [-A[2], A[1]]

        } else if (ay <= ax && ay <= az) {
            [B[0], B[2]] = [-A[2], A[0]]
        } else {
            [B[1], B[0]] = [-A[0], A[1]]
        }

        vec3D.normalize(B, B);
        vec3D.cross(C, A, B)

        return {
            A, B, C
        }
    }

    static rotate(out: Float32Array, mat: Float32Array, vec3: Float32Array, rad: number) {
        const {A, B, C} = this.findBasisFromAxis(vec3);
        const M = this.fromValues(
            A[0], A[1], A[2],
            B[0], B[1], B[2],
            C[0], C[1], C[2],
        )
        const MT = this.create();
        this.transpose(MT, M);

        const Rx = this.create();
        this.rotateX(Rx, MT, rad);

        matrixMultiplication(M, Rx, M, 3);
        matrixMultiplication(out, mat, M, 3);

        return out;
    }

    static scale(out: Float32Array, mat: Float32Array, vec3: Float32Array) {
        const scaleMat = this.fromValues(
            vec3[0], 0, 0,
            0, vec3[1], 0,
            0, 0, vec3[2]
        )

        matrixMultiplication(out, mat, scaleMat, 3)
        return out;
    }

    static scaleX(out: Float32Array, mat: Float32Array, fac: number) {
        const scaleMat = this.fromValues(
            fac, 0, 0,
            0, 1, 0,
            0, 0, 1
        )

        matrixMultiplication(out, mat, scaleMat, 3)
        return out;
    }

    static scaleY(out: Float32Array, mat: Float32Array, fac: number) {
        const scaleMat = this.fromValues(
            1, 0, 0,
            0, fac, 0,
            0, 0, 1
        )

        matrixMultiplication(out, mat, scaleMat, 3)
        return out;
    }

    static scaleZ(out: Float32Array, mat: Float32Array, fac: number) {
        const scaleMat = this.fromValues(
            1, 0, 0,
            0, 1, 0,
            0, 0, fac
        )

        matrixMultiplication(out, mat, scaleMat, 3)
        return out;
    }

    static toQuat(out: Float32Array, mat: Float32Array) {
        const t = mat[0] + mat[4] + mat[8];

        if (t > 0) {
            const w = 0.5 * Math.sqrt(1 + t);
            out[0] = (mat[5] - mat[7]) / (4 * w);
            out[1] = (mat[6] - mat[2]) / (4 * w);
            out[2] = (mat[1] - mat[3]) / (4 * w);
            out[3] = w;
        } else {
            const x = 0.5 * Math.sqrt(1 + mat[0] - mat[4] - mat[8])
            out[3] = (mat[5] - mat[7]) / (4 * x)
            out[1] = (mat[3] + mat[1]) / (4 * x)
            out[2] = (mat[6] + mat[2]) / (4 * x)
            out[0] = x
        }

        return out;
    }
}