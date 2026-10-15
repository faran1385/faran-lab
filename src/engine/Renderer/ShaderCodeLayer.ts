import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {RenderContext} from "./RenderContext.ts";
import type {SkinningMethod} from "../skinning/SkinningMethod.ts";

export interface GeneratedStages {
    vertex: boolean;
    fragment: boolean;
}

/** The shader code layer: runs a primitive's assemblers when its code generation flag says the code is out of date. */
export class ShaderCodeLayer {
    /** @param skinning the skinning method of the node being drawn, if skinned: the vertex descriptor then carries the palette binding and the method's WGSL */
    static generate(p: PrimitiveWrapper, skinning: SkinningMethod | undefined, ctx: RenderContext) {
        const {producer} = ctx;
        const pipeline = p.getPipeline();
        const vertexWrapper = pipeline.getVertexShaderWrapper();
        const fragmentWrapper = pipeline.getFragmentShaderWrapper();

        if (vertexWrapper.hashProvider.needsUpdateCodeGen()) {
            const entryPoint = vertexWrapper.getEntryPoint();
            const code = p.getVertexAssembler().assemble(producer.produceVertexShader({
                geometry: p.getGeometry(),
                material: p.getMaterial(),
                skinning,
            }), entryPoint);
            vertexWrapper.setShader(code, entryPoint);
            vertexWrapper.hashProvider.syncCodeGen();
        }

        if (fragmentWrapper.hashProvider.needsUpdateCodeGen()) {
            const entryPoint = fragmentWrapper.getEntryPoint();
            const code = p.getFragmentAssembler().assemble(producer.produceFragmentShader({
                geometry: p.getGeometry(),
                vertexShader: vertexWrapper,
                material: p.getMaterial()
            }), entryPoint);
            fragmentWrapper.setShader(code, entryPoint);
            fragmentWrapper.hashProvider.syncCodeGen();
        }

    }
}
