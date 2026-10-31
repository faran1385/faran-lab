import {mat4} from "../math/matrix/mat4.ts";
import type {SkinJoints, SkinningMethod} from "../../engine/skinning/SkinningMethod.ts";

const MAT4_FLOATS = 16;
const MAT4_BYTES = MAT4_FLOATS * 4;

/**
 * Linear blend skinning. Palette: one column-major mat4 per joint, `jointWorld * inverseBind`, so a skinned vertex is
 * already in world space.
 */
export class LBSSkinning implements SkinningMethod {
    readonly id = "lbs";
    readonly paletteStrideBytes = MAT4_BYTES;
    readonly paletteElement = {
        structName: "JointMatrix",
        fields: [{name: "matrix", type: "mat4x4f" as const, offset: 0}],
    };

    readonly code = `
fn skin(pos: vec3f, nrm: vec3f, joints: vec4u, weights: vec4f) -> SkinnedVertex {
    let m = palette[joints.x].matrix * weights.x
          + palette[joints.y].matrix * weights.y
          + palette[joints.z].matrix * weights.z
          + palette[joints.w].matrix * weights.w;
    var result: SkinnedVertex;
    result.position = (m * vec4f(pos, 1.0)).xyz;
    // upper 3x3 of the blended matrix: exact for rotation + uniform scale
    result.normal = normalize((m * vec4f(nrm, 0.0)).xyz);
    return result;
}
`;

    private view?: Float32Array;
    private readonly scratch = mat4.create();

    initialPalette(jointCount: number): ArrayBuffer {
        const data = new Float32Array(jointCount * MAT4_FLOATS);
        for (let i = 0; i < jointCount; i++) {
            const o = i * MAT4_FLOATS;
            data[o] = data[o + 5] = data[o + 10] = data[o + 15] = 1;
        }
        return data.buffer;
    }

    update(palette: ArrayBuffer, joints: SkinJoints): void {
        if (this.view?.buffer !== palette) this.view = new Float32Array(palette);

        let index = 0;
        for (const [node, inverseBind] of joints) {
            mat4.mul(this.scratch, node.getWorldMatrix(), inverseBind);
            this.view.set(this.scratch, index * MAT4_FLOATS);
            index++;
        }
    }
}
