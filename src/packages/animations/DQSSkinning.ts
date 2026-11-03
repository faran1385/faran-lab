import {mat4} from "../math/matrix/mat4.ts";
import type {SkinJoints, SkinningMethod} from "../../engine/Skinning/SkinningMethod.ts";
import {vec3} from "../math/vector/vec3.ts";
import {quat} from "../math/quat/quat.ts";
import {vec4} from "../math/vector/vec4.ts";

const STRIDE = 12;
const STRIDE_BYTES = STRIDE * 4;

export class DQSSkinning implements SkinningMethod {
    readonly id = "dqs";
    readonly paletteStrideBytes = STRIDE_BYTES;
    readonly paletteElement = {
        structName: "JointData",
        fields: [{name: "rq", type: "vec4f" as const, offset: 0}, {
            name: "dq",
            type: "vec4f" as const,
            offset: 4 * 4
        }, {
            name: "scale",
            type: "vec4f" as const,
            offset: 8 * 4
        }],
    };

    readonly code = `
    
    fn quat_mul(a:vec4f,b:vec4f)->vec4f {
        return vec4f(
            a.w*b.xyz + b.w*a.xyz + cross(a.xyz, b.xyz),
            a.w*b.w - dot(a.xyz, b.xyz)
        );
    }   

    fn rotate_by_quat(q:vec4f, v:vec3f)->vec3f {
        let t = 2.0 * cross(q.xyz, v);
        return v + q.w * t + cross(q.xyz, t);
    }
    
    struct JointQuaternion {
        dq:vec4f,
        rq:vec4f
    }
    
fn skin(pos: vec3f, nrm: vec3f, joints: vec4u, weights: vec4f) -> SkinnedVertex {
    var maxW = weights[0];
    var refIndex = 0;
    
    for (var i = 1; i < 4; i++) {
        let better = weights[i] > maxW;
        maxW = select(maxW, weights[i], better);
        refIndex = select(refIndex, i, better);
    }
    
    var refPalette = palette[joints[refIndex]];
    var jointsPalette = array<JointQuaternion,4>();
    
    for (var i = 0i; i < 4; i++) {
        var data:JointQuaternion;
        let rq = palette[joints[i]].rq;
        let dq = palette[joints[i]].dq;
        // sign = -1 if dot < 0, else +1
        let s = select(1.0,-1.0,dot(rq, refPalette.rq) < 0.0);
        jointsPalette[i].rq = s * rq;
        jointsPalette[i].dq = s * dq;
    }
    
    var dqBlend = vec4f(0);
    var rqBlend = vec4f(0);
    var sBlend  = vec3f(0);
    
    for (var i = 0; i < 4; i++) {
        rqBlend += weights[i] * jointsPalette[i].rq;
        dqBlend += weights[i] * jointsPalette[i].dq;
        sBlend  += weights[i] * palette[joints[i]].scale.xyz;
    }
    
    let n  = length(rqBlend);
    let rq = rqBlend / n;
    let dq0 = dqBlend / n;
    let dq = dq0 - rq * dot(rq, dq0);
    
    let rqConj = vec4f(-rq.xyz, rq.w);
    let dqrq   = quat_mul(dq, rqConj);
    let T      = 2.0 * dqrq.xyz;      // drop scalar part
    
    let ps = sBlend * pos;
    let pr = rotate_by_quat(rq, ps);
     
    let ns = nrm / sBlend;             
    let nr = rotate_by_quat(rq, ns);

        
        
    var result: SkinnedVertex;
    result.position = T + pr;
    result.normal = normalize(nr);
    return result;
}
`;

    private view?: Float32Array;
    private static readonly scratch = mat4.create();
    private static readonly translation = vec3.create();
    private static readonly tPure = quat.fromValues(1, 0, 0, 0);
    private static readonly dualQuat = quat.fromValues(0, 0, 0, 1);
    private static readonly rotation = quat.create();
    private static readonly scale = vec4.fromValues(1, 1, 1, 1);

    initialPalette(jointCount: number): ArrayBuffer {
        const data = new Float32Array(jointCount * STRIDE);
        for (let i = 0; i < jointCount; i++) {
            const o = i * STRIDE;
            data[o + 3] = 1;
            data[o + 4] = 1;
            data[o + 8] = 1;
            data[o + 9] = 1;
            data[o + 10] = 1;
            data[o + 11] = 1;
        }

        return data.buffer;
    }

    update(palette: ArrayBuffer, joints: SkinJoints): void {
        if (this.view?.buffer !== palette) this.view = new Float32Array(palette);

        let index = 0;
        for (const [node, inverseBind] of joints) {
            mat4.mul(DQSSkinning.scratch, node.getWorldMatrix(), inverseBind);
            mat4.decompose(DQSSkinning.scratch, DQSSkinning.translation, DQSSkinning.rotation, DQSSkinning.scale)
            quat.set(DQSSkinning.tPure, DQSSkinning.translation[0], DQSSkinning.translation[1], DQSSkinning.translation[2], 0);
            quat.mul(DQSSkinning.dualQuat, DQSSkinning.tPure, DQSSkinning.rotation);
            quat.scale(DQSSkinning.dualQuat, 0.5);

            // set
            DQSSkinning.scratch.set(DQSSkinning.rotation, 0)
            DQSSkinning.scratch.set(DQSSkinning.dualQuat, 4)
            DQSSkinning.scratch.set(DQSSkinning.scale, 8)

            this.view.set(DQSSkinning.scratch.subarray(0, 12), index * STRIDE);
            index++;
        }
    }
}
