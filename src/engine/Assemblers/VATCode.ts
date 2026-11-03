import type {VATPlan} from "../producers/VATProducer.ts";


export type VertexVAT = {
    position?: (vertexIndex: string) => string;
    normal?: (vertexIndex: string) => string;
    tangent?: (vertexIndex: string) => string;
};


export function buildVATCode(plan: VATPlan): { code: string; access: VertexVAT } {
    const parts: string[] = [];

    parts.push(`fn getVATData(vatTexture:texture_2d<f32>,vatHeaders:VATHeaderUniforms,vertexIndex:u32,vatHeader:VATHeaderUniforms) -> vec4f {
        let u=vertexIndex;
        let v=vatHeaders.frame;
        let uv=vec2u(u,v);
        let pixel=textureLoad(vatTexture,uv,0);
        
        return pixel;
    }`);

    const access: VertexVAT = {
        position: plan.position ? ((vertexIndex: string) => `getVATData(${plan.position!.texture},${plan.position!.header},${vertexIndex})`) : undefined,
        normal: plan.normal ? ((vertexIndex: string) => `getVATData(${plan.normal!.texture},${plan.normal!.header},${vertexIndex})`) : undefined,
        tangent: plan.tangent ? ((vertexIndex: string) => `getVATData(${plan.tangent!.texture},${plan.tangent!.header},${vertexIndex})`) : undefined,
    }

    return {code: parts.join("\n\n"), access};
}


