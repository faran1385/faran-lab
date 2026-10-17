/**
 * Shader stage bit flags, with the same values as the WebGPU GPUShaderStage globals.
 *
 * A plain constant instead of the global so the binding layer can be imported and tested where no WebGPU
 * implementation exists (Node). Combine with `|`: `ShaderStage.VERTEX | ShaderStage.FRAGMENT`.
 */
export const ShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
} as const;

export type ShaderStageFlags = number;

/** Every stage bit that exists. A visibility of 0 or with a bit outside this mask is rejected. */
export const ALL_SHADER_STAGES: ShaderStageFlags = ShaderStage.VERTEX | ShaderStage.FRAGMENT | ShaderStage.COMPUTE;
