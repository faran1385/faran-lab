export function matrixMultiplication(
    out: Float32Array,
    a: Float32Array,
    b: Float32Array,
    dimension: number
) {
    const aa = out === a ? new Float32Array(a) : a;
    const bb = out === b ? new Float32Array(b) : b;

    for (let col = 0; col < dimension; col++) {
        for (let row = 0; row < dimension; row++) {
            let sum = 0;

            for (let k = 0; k < dimension; k++) {
                sum += aa[k * dimension + row] * bb[col * dimension + k];
            }

            out[col * dimension + row] = sum;
        }
    }

    return out;
}

export function matrixTranspose(out: Float32Array, a: Float32Array, dimension: number) {
    if (out !== a) {
        for (let col = 0; col < dimension; col++) {
            for (let row = 0; row < dimension; row++) {
                out[col * dimension + row] = a[row * dimension + col];
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