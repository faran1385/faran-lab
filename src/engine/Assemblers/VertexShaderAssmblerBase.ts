// --- vertex-assembler-base.ts ----------------------------------------------

import {type AccessibleValue, buildBindingDecls} from "./utils.ts";
import type {VertexShaderWrapper} from "../wrappers/VertexShaderWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";

export abstract class VertexAssemblerBase {
    assemble(primitive: PrimitiveWrapper): void {
        const wrapper = primitive.getPipeline().getVertexShaderWrapper();

        const {preamble, inputValues, bindingValues} = this.vertexPhase1(wrapper);
        const clipPositionExpr = this.vertexPhase2(inputValues, bindingValues);
        const code = this.vertexPhase3(wrapper, preamble, clipPositionExpr, wrapper.getEntryPoint());

        wrapper.setCode(code);
    }

    protected vertexPhase1(wrapper: VertexShaderWrapper): {
        preamble: string;
        inputValues: Record<string, AccessibleValue>;
        bindingValues: Record<string, AccessibleValue>;
    } {
        const parts: string[] = [];
        const inputValues: Record<string, AccessibleValue> = {};

        const inputLines = wrapper.getInputs().map((f) => {
            inputValues[f.name] = {type: f.type, access: `input.${f.name}`};
            return `  @location(${f.location}) ${f.name}: ${f.type},`;
        });
        parts.push(`struct VertexInput {\n${inputLines.join("\n")}\n};`);

        const outputLines = wrapper.getOutputs().map((f) =>
            f.kind === "builtin"
                ? `  @builtin(${f.builtin}) ${f.name}: ${f.type},`
                : `  @location(${f.location}) ${f.name}: ${f.type},`
        );
        parts.push(`struct VertexOutput {\n${outputLines.join("\n")}\n};`);

        const {bindingCode, values: bindingValues} = buildBindingDecls(wrapper.getBindings());
        parts.push(bindingCode);

        return {preamble: parts.join("\n\n"), inputValues, bindingValues};
    }

    /** The "mind" for vertex — must return a WGSL expression for clip-space position. */
    protected abstract vertexPhase2(
        inputValues: Record<string, AccessibleValue>,
        bindingValues: Record<string, AccessibleValue>
    ): string;

    protected vertexPhase3(wrapper: VertexShaderWrapper, preamble: string, clipPositionExpr: string, entryPoint: string): string {
        const assignments = wrapper.getOutputs()
            .filter((f) => f.kind === "varying")
            .map((f) => `  output.${f.name} = input.${f.name};`)
            .join("\n");

        return `${preamble}

@vertex
fn ${entryPoint}(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = ${clipPositionExpr};
${assignments}
  return output;
}`;
    }
}