import {
    MORPH_ACTIVE_VAR,
    MORPH_DELTAS_VAR,
    MORPH_HEADER_VAR,
    type MorphPlan,
} from "../producers/MorphProducer.ts";

/**
 * What a vertex assembler's phase 2 gets for a geometry with morph targets. Each function writes the WGSL expression
 * that applies the node's active targets to `base` for the vertex `vertexIndex` (the value of the `vertex_index`
 * builtin: for an indexed draw it is the index read from the index buffer, which is exactly the vertex to fetch).
 *
 * `normal` and `tangent` exist only when the targets carry them. The normal result is renormalized and the tangent
 * keeps its w, as glTF requires. The assembler has to request `vertex_index` in `usedBuiltins` to be able to call them.
 *
 * Morphing happens first: Skinning (when a node has it) is applied to the morphed vertex.
 */
export type VertexMorph = {
    position: (base: string, vertexIndex: string) => string;
    normal?: (base: string, vertexIndex: string) => string;
    tangent?: (base: string, vertexIndex: string) => string;
};

const H = MORPH_HEADER_VAR;
const D = MORPH_DELTAS_VAR;
const A = MORPH_ACTIVE_VAR;

/** One loop for all three attributes: `section` is the float offset of the attribute inside a target. */
function accumulate(section: string): string {
    return `  if (vid >= ${H}.morphVertexCount) { return base; }
  var sum = vec3f(0.);
  let count = arrayLength(&${A});
  for (var i = 0u; i < count; i++) {
    let entry = ${A}[i];
    if (entry.weight == 0.0) { break; }
    if (entry.index >= ${H}.morphTargetCount) { continue; }
    sum += entry.weight * morphDelta(entry.index, ${section}, vid);
  }`;
}

/**
 * The helper functions for the geometry's plan and the matching access object. Names are prefixed `morph` and avoid
 * WGSL reserved words (`target` and `active` are reserved, hence `targetIndex` and `morphActive`).
 */
export function buildMorphCode(plan: MorphPlan): { code: string; access: VertexMorph } {
    const parts: string[] = [];

    parts.push(`fn morphDelta(targetIndex: u32, sectionOffset: u32, vid: u32) -> vec3f {
  let o = targetIndex * ${H}.morphTargetStride + sectionOffset + vid * 3u;
  return vec3f(${D}[o], ${D}[o + 1u], ${D}[o + 2u]);
}`);

    parts.push(`fn morphPosition(basePosition: vec3f, vid: u32) -> vec3f {
  let base = basePosition;
${accumulate("0u")}
  return base + sum;
}`);

    const access: VertexMorph = {
        position: (base, vertexIndex) => `morphPosition(${base}, ${vertexIndex})`,
    };

    if (plan.hasNormal) {
        parts.push(`fn morphNormal(baseNormal: vec3f, vid: u32) -> vec3f {
  let base = baseNormal;
${accumulate(`${H}.morphNormalOffset`)}
  return normalize(base + sum);
}`);
        access.normal = (base, vertexIndex) => `morphNormal(${base}, ${vertexIndex})`;
    }

    if (plan.hasTangent) {
        parts.push(`fn morphTangent(baseTangent: vec4f, vid: u32) -> vec4f {
  let base = baseTangent.xyz;
${accumulate(`${H}.morphTangentOffset`).replace("return base;", "return baseTangent;")}
  return vec4f(normalize(base + sum), baseTangent.w);
}`);
        access.tangent = (base, vertexIndex) => `morphTangent(${base}, ${vertexIndex})`;
    }

    return {code: parts.join("\n\n"), access};
}
