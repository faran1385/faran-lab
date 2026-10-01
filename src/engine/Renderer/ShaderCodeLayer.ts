import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {RenderContext} from "./RenderContext.ts";

export interface GeneratedStages {
    vertex: boolean;
    fragment: boolean;
}

/** The shader code layer: runs a primitive's assemblers when its code generation flag says the code is out of date. */
export class ShaderCodeLayer {
    static generate(p: PrimitiveWrapper, ctx: RenderContext): GeneratedStages {
        const {producer} = ctx;
        const pipeline = p.getPipeline();
        const vertexWrapper = pipeline.getVertexShaderWrapper();
        const fragmentWrapper = pipeline.getFragmentShaderWrapper();
        const generated: GeneratedStages = {vertex: false, fragment: false};

        if (vertexWrapper.codeGenVersionFlag.needsUpdate()) {
            const entryPoint = vertexWrapper.getEntryPoint();
            const code = p.getVertexAssembler().assemble(producer.produceVertexShader({
                geometry: p.getGeometry(),
                material: p.getMaterial(),
            }), entryPoint);
            vertexWrapper.setShader(code, entryPoint);
            vertexWrapper.codeGenVersionFlag.sync();
            generated.vertex = true;
        }

        if (fragmentWrapper.codeGenVersionFlag.needsUpdate()) {
            const entryPoint = fragmentWrapper.getEntryPoint();
            const code = p.getFragmentAssembler().assemble(producer.produceFragmentShader({
                geometry: p.getGeometry(),
                vertexShader: vertexWrapper,
                material: p.getMaterial()
            }), entryPoint);
            fragmentWrapper.setShader(code, entryPoint);
            fragmentWrapper.codeGenVersionFlag.sync();
            generated.fragment = true;
        }

        return generated;
    }
}
