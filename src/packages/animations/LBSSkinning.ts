import {mat4} from "../math/matrix/mat4.ts";
import {BaseSkinningMethod, type SkinContext} from "../../engine/skinning/SkinningMethod.ts";

const MAT4_BYTES = 64;

/**
 * Linear blend skinning. Palette: one column-major mat4 per joint, `jointWorld * inverseBind`, so the skinned vertex is
 * already in world space (glTF: the skinned node's own transform is ignored).
 */
export class LBSSkinning extends BaseSkinningMethod {
    readonly id = "lbs";
    readonly paletteStrideBytes = MAT4_BYTES;
    readonly paletteElement = {
        structName: "JointMatrix",
        fields: [{name: "matrix", type: "mat4x4f" as const, offset: 0}],
    }

    readonly code = `
        struct SkinnedVertex {
          position: vec3f,
          normal: vec3f,
        }
    
        fn skin(pos: vec3f, nrm: vec3f, joints: vec4u, weights: vec4f) -> SkinnedVertex {
            let m = palette[joints.x].matrix * weights.x
                  + palette[joints.y].matrix * weights.y
                  + palette[joints.z].matrix * weights.z
                  + palette[joints.w].matrix * weights.w;
            var out: SkinnedVertex;
            out.position = (m * vec4f(pos, 1.0)).xyz;
            // upper 3x3 of the blended matrix; exact for rotation + uniform scale
            out.normal = normalize((m * vec4f(nrm, 0.0)).xyz);
            return out;
        }
       `

    // Write state. All of it is invalidated by a different palette buffer, see update().
    private lastBuffer?: GPUBuffer;
    private lastWorldEpoch = -1;
    private lastJointsVersion = -1;
    private palette?: Float32Array<ArrayBuffer>;
    private readonly scratch = mat4.create();

    initialPalette(jointCount: number): ArrayBuffer {
        const data = new Float32Array(jointCount * 16);
        for (let i = 0; i < jointCount; i++) {
            const o = i * 16;
            data[o] = data[o + 5] = data[o + 10] = data[o + 15] = 1;
        }
        return data.buffer;
    }

    update(ctx: SkinContext): void {
        const skin = this.skin;
        const {bufferManager} = ctx.managers;
        const key = skin.getPaletteKey();

        // A different GPUBuffer than the one last written (first frame, swapped method, skin left the scene and its
        // buffer was destroyed and recreated with initial contents) always needs a full write.
        const buffer = bufferManager.getRaw(key) as GPUBuffer;
        const sameBuffer = buffer === this.lastBuffer;
        if (sameBuffer && ctx.worldEpoch === this.lastWorldEpoch) return;

        const version = skin.getJointsWorldVersion();
        if (sameBuffer && version === this.lastJointsVersion) {
            this.lastWorldEpoch = ctx.worldEpoch;      // something moved, but not this skin
            return;
        }

        const joints = skin.getJointNodes();
        const ibm = skin.getInverseBindMatrices();
        if (!this.palette || this.palette.length !== joints.length * 16) this.palette = new Float32Array(joints.length * 16);

        for (let j = 0; j < joints.length; j++) {
            mat4.mul(this.scratch, joints[j].getWorldMatrix(), ibm.subarray(j * 16, j * 16 + 16));
            this.palette.set(this.scratch, j * 16);
        }

        bufferManager.upload(key, this.palette);
        this.lastBuffer = buffer;
        this.lastWorldEpoch = ctx.worldEpoch;
        this.lastJointsVersion = version;
    }
}
