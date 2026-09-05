// --- fragment-assembler-base.ts ---------------------------------------------
import {type AccessibleValue, buildBindingDecls} from "./utils.ts";
import type {VertexShaderWrapper} from "../wrappers/VertexShaderWrapper.ts";
import type {PrimitiveWrapper} from "../wrappers/PrimitiveWrapper.ts";
import type {FragmentShaderWrapper} from "../wrappers/FragmentShaderWrapper.ts";

export abstract class FragmentAssemblerBase {
    assemble(primitive: PrimitiveWrapper): void {
        const vertexWrapper = primitive.getVertexShader();
        const fragmentWrapper = primitive.getFragmentShader();

        const {preamble, varyingValues, bindingValues} = this.fragmentPhase1(vertexWrapper, fragmentWrapper);
        const colorExpr = this.fragmentPhase2(varyingValues, bindingValues);
        const code = this.fragmentPhase3(preamble, colorExpr,primitive.getFragmentShader().getEntryPoint());

        fragmentWrapper.setCode(code);
    }

    protected fragmentPhase1(vertexWrapper: VertexShaderWrapper, fragmentWrapper: FragmentShaderWrapper): {
        preamble: string;
        varyingValues: Record<string, AccessibleValue>;
        bindingValues: Record<string, AccessibleValue>;
    } {
        const parts: string[] = [];
        const varyingValues: Record<string, AccessibleValue> = {};

        const inputLines = vertexWrapper.getOutputs().map((f) => {
            if (f.kind === "builtin") return `  @builtin(${f.builtin}) ${f.name}: ${f.type},`;
            varyingValues[f.name] = {type: f.type, access: `input.${f.name}`};
            return `  @location(${f.location}) ${f.name}: ${f.type},`;
        });
        parts.push(`struct VertexOutput {\n${inputLines.join("\n")}\n};`);

        const {bindingCode, values: bindingValues} = buildBindingDecls(fragmentWrapper.getBindings());
        parts.push(bindingCode);

        const outputLines = fragmentWrapper.getOutputs().map((f) => `  @location(${f.location}) color: ${f.wgslType},`);
        parts.push(`struct FragmentOutput {\n${outputLines.join("\n")}\n};`);

        return {preamble: parts.join("\n\n"), varyingValues, bindingValues};
    }

    /** The "mind" for fragment — must return a WGSL expression for output color. */
    protected abstract fragmentPhase2(
        varyingValues: Record<string, AccessibleValue>,
        bindingValues: Record<string, AccessibleValue>
    ): string;

    protected fragmentPhase3(preamble: string, colorExpr: string, entryPoint: string): string {
        return `${preamble}

@fragment
fn ${entryPoint}(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = ${colorExpr};
  return output;
}`;
    }
}