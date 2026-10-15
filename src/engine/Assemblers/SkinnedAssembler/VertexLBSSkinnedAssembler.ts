import {BasicVertexAssembler} from "../BasicAssembler/BasicAssembler.ts";

/**
 * Default vertex assembler for primitives of skinned nodes (the convertor assigns it).
 *
 * TODO: the LBS vertex code is yours to write. Override vertexPhase2 here. What the vertex descriptor gives you for a
 * skinned node:
 *   - inputs "joints0" (vec4u) and "weights0" (vec4f) next to position/normal/uv, via inputValues.get("joints0")
 *   - a read-only storage binding in group 2: bindingValues.get("palette")?.access is the array, one element per
 *     joint, each `{ matrix: mat4x4f }`, so `palette[j].matrix`
 *
 * Until then this class inherits BasicVertexAssembler unchanged, so skinned models draw in their un-deformed pose
 * (the palette binding is declared but unused). Its output struct (position + uv) must stay compatible with the
 * fragment assembler paired with it.
 */
export class VertexLBSSkinnedAssembler extends BasicVertexAssembler {
}
