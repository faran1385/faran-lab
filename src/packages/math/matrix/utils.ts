export function matrixMultiplication(
    out: Float32Array,
    a: Float32Array,
    b: Float32Array,
    dimension: number
) {
    const aa = out === a ? new Float32Array(a) : a;
    const bb = out === b ? new Float32Array(b) : b;



    for (let row = 0; row < dimension; row++) {
        for (let col = 0; col < dimension; col++) {
            let sum = 0;

            for (let k = 0; k < dimension; k++) {
                sum +=
                    aa[row * dimension + k] *
                    bb[k * dimension + col];
            }

            out[row * dimension + col] = sum;
        }
    }

    return out;
}

export function matrixTranspose(out: Float32Array, a: Float32Array, dimension: number) {
    if (out !== a) {
        for (let i = 0; i < dimension; i++) {
            for (let j = 0; j < dimension; j++) {
                out[j + i * dimension] = a[i + j * dimension];
            }
        }
    } else {
        for (let i = 0; i < dimension; i++) {
            for (let j = i + 1; j < dimension; j++) {
                const idx1 = i + j * dimension;
                const idx2 = j + i * dimension;
                const temp = out[idx1];
                out[idx1] = out[idx2];
                out[idx2] = temp;
            }
        }
    }
}