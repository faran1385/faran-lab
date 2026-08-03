// Interleaved position (vec3) + color (vec3) per vertex, 4 verts per face, 6 faces.
// Each face is wound CCW as seen from outside, matching WebGPU's default
// frontFace: 'ccw' so cullMode: 'back' works correctly.

const s = 1;

// prettier-ignore
export const cubeVertices = new Float32Array([
    // +X face (red face - both triangles red)
    // Triangle 1
    s, -s, -s, 0, 0, 0,
    s, s, -s, 0, 0, 0,
    s, s, s, 0, 0, 0,
    // Triangle 2
    s, -s, -s, 1, 1, 1,
    s, s, s, 1, 1, 1,
    s, -s, s, 1, 1, 1,

    // -X face (cyan face)
    // Triangle 1
    -s, -s, -s, 1, 0, 0,
    -s, -s, s, 1, 0, 0,
    -s, s, s, 1, 0, 0,
    // Triangle 2
    -s, -s, -s, 0, 1, 0,
    -s, s, s, 0, 1, 0,
    -s, s, -s, 0, 1, 0,

    // +Y face (green face)
    // Triangle 1
    -s, s, -s, 0, 0, 1,
    -s, s, s, 0, 0, 1,
    s, s, s, 0, 0, 1,
    // Triangle 2
    -s, s, -s, 0.5, 0, 0,
    s, s, s, 0.5, 0, 0,
    s, s, -s, 0.5, 0, 0,

    // -Y face (magenta face)
    // Triangle 1
    -s, -s, -s, 0, .5, 0,
    s, -s, -s, 0, .5, 0,
    s, -s, s, 0, .5, 0,
    // Triangle 2
    -s, -s, -s, 0, 0, .5,
    s, -s, s, 0, 0, .5,
    -s, -s, s, 0, 0, .5,

    // +Z face (blue face)
    // Triangle 1
    -s, -s, s, 0.5, 0.5, 0.5,
    s, -s, s, 0.5, 0.5, 0.5,
    s, s, s, 0.5, 0.5, 0.5,
    // Triangle 2
    -s, -s, s, 1, 1, 0,
    s, s, s, 1, 1, 0,
    -s, s, s, 1, 1, 0,

    // -Z face (yellow face)
    // Triangle 1
    s, -s, -s, 0, 1, 1,
    -s, -s, -s, 0, 1, 1,
    -s, s, -s, 0, 1, 1,
    // Triangle 2
    s, -s, -s, 1, 0, 1,
    -s, s, -s, 1, 0, 1,
    s, s, -s, 1, 0, 1,
]);

function calculateFaceNormals(vertices: Float32Array) {
    const normals:number[] = [];
    const vertexCount = vertices.length / 6; // Each vertex has 6 components (x,y,z,r,g,b)

    for (let i = 0; i < vertexCount; i += 3) {
        // Get the three vertices of the triangle
        const idx1 = i * 6;
        const idx2 = (i + 1) * 6;
        const idx3 = (i + 2) * 6;

        // Extract positions (x, y, z)
        const v1 = [vertices[idx1], vertices[idx1 + 1], vertices[idx1 + 2]];
        const v2 = [vertices[idx2], vertices[idx2 + 1], vertices[idx2 + 2]];
        const v3 = [vertices[idx3], vertices[idx3 + 1], vertices[idx3 + 2]];

        // Calculate edge vectors
        const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

        // Calculate normal (cross product)
        let normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0]
        ];

        // Normalize
        const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        if (len > 0) {
            normal = [normal[0] / len, normal[1] / len, normal[2] / len];
        }

        // The normal is the same for all 3 vertices of the triangle
        normals.push(...normal, ...normal, ...normal);
    }

    return new Float32Array(normals);
}

export const faceNormals = calculateFaceNormals(cubeVertices);
export const cubeVertexStride = 6 * Float32Array.BYTES_PER_ELEMENT;
