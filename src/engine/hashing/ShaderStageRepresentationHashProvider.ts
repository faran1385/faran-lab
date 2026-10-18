import {RepresentationHashProvider} from "./RepresentationHashProvider.ts";

type InputFunctions = {
    getCode: () => string,
}

/** Hash of a shader stage's code only. The entry point is part of the pipeline's hash, not of the module's identity. */
export class ShaderStageRepresentationHashProvider extends RepresentationHashProvider {
    constructor(T: InputFunctions) {
        super({buildKey: () => T.getCode()});
    }
}
