import {NodeInternal} from "../internals/NodeInternal.ts";
import {BufferInternal} from "../internals/BufferInternal.ts";
import {mat4} from "../../packages/math/matrix/mat4.ts";
import type {MeshWrapper} from "../wrappers/MeshWrapper.ts";


export class NodeAdaptor {
    readonly internal: NodeInternal;
    readonly buffer = new BufferInternal(mat4.create().buffer, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

    constructor(internal?: NodeInternal, needNodeTransform?: {
        binding: number,
        visibility: GPUShaderStageFlags
    }) {
        this.internal = internal ?? new NodeInternal();
        if (needNodeTransform) {
            this.internal.bindgroupInteractor.setUniform(
                needNodeTransform.binding,
                this.buffer,
                needNodeTransform.visibility
            )
        }
    }

    setMesh(mesh: MeshWrapper | null) {
        this.internal.setMesh(mesh?.adaptor?.internal ?? null)
    }

}