import {mat4} from "../../packages/math/matrix/mat4.ts";
import type {SkinInstanceWrapper} from "../wrappers/SkinInstanceWrapper.ts";
import type {SkinningContext, SkinningMethod, SkinningShaderParts} from "./SkinningMethod.ts";

/** Linear blend skinning: one column-major mat4 (64 bytes) per joint. */
export class LBSSkinningMethod implements SkinningMethod {
    readonly id = "lbs-mat4-v1";
    readonly paletteStrideBytes = 64;

    private skin?: SkinInstanceWrapper;
    private palette?: Float32Array;
    private lastJointVersion = -1;

    shaderParts(): SkinningShaderParts {
        return {
            structs: `struct SkinnedVertex {
    position: vec3f,
    normal: vec3f,
};`,
            functions: `fn skinVertex(pos: vec3f, nrm: vec3f, joints: vec4u, weights: vec4f) -> SkinnedVertex {
    let skinMatrix =
        palette[joints.x].matrix * weights.x +
        palette[joints.y].matrix * weights.y +
        palette[joints.z].matrix * weights.z +
        palette[joints.w].matrix * weights.w;
    let skinnedPosition = (skinMatrix * vec4f(pos, 1.0)).xyz;
    let skinnedNormal = normalize((skinMatrix * vec4f(nrm, 0.0)).xyz);
    return SkinnedVertex(skinnedPosition, skinnedNormal);
}`,
            skinFn: "skinVertex",
            paletteElementStructName: "JointMatrix",
            paletteElementFields: [{name: "matrix", type: "mat4x4f", offset: 0}],
        };
    }

    initialPalette(jointCount: number): ArrayBuffer {
        const data = new Float32Array(jointCount * 16);
        for (let i = 0; i < jointCount; i++) {
            const o = i * 16;
            data[o] = data[o + 5] = data[o + 10] = data[o + 15] = 1;
        }
        return data.buffer;
    }

    attach(skin: SkinInstanceWrapper): void {
        if (this.skin && this.skin !== skin) {
            throw new Error("LBSSkinningMethod instances cannot be shared between skins; create one method per skin");
        }
        this.skin = skin;
        this.palette = new Float32Array(skin.getJointCount() * 16);
        this.lastJointVersion = -1;
    }

    invalidatePalette(): void {
        this.lastJointVersion = -1;
    }

    update(ctx: SkinningContext): void {
        const skin = this.skin;
        if (!skin) throw new Error("LBSSkinningMethod.update called before attach");

        if (!ctx.worldMoved && this.lastJointVersion >= 0) return;

        const jointVersion = skin.getJointsWorldVersion();
        if (jointVersion === this.lastJointVersion) return;

        const palette = this.palette ?? (this.palette = new Float32Array(skin.getJointCount() * 16));
        const inverseBindMatrices = skin.getInverseBindMatrices();
        const joints = skin.getJointNodes();

        for (let i = 0; i < joints.length; i++) {
            const output = palette.subarray(i * 16, i * 16 + 16);
            const inverseBind = inverseBindMatrices.subarray(i * 16, i * 16 + 16);
            mat4.mul(output, joints[i].getWorldMatrix(), inverseBind);
        }

        ctx.managers.bufferManager.upload(skin.getPaletteKey(), palette);
        this.lastJointVersion = jointVersion;
    }
}
