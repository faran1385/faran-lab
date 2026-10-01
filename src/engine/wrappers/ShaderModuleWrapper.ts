import {v4 as uuidv4} from "uuid";
import {ShaderModuleHashProvider} from "../hashing/ShaderModuleHashProvider.ts";

export class ShaderModuleWrapper {
    readonly uuid: string;


    private entryPoint = "main";
    private code: string = "";

    readonly hashProvider: ShaderModuleHashProvider;

    constructor() {
        this.uuid = uuidv4();

        this.hashProvider = new ShaderModuleHashProvider({
            getCode: this.getCode.bind(this),
        })
    }


    setShader(code: string, entryPoint: string): void {
        this.code = code;
        this.entryPoint = entryPoint;
        this.hashProvider.markHashHandler();
    }

    getCode(): string {
        return this.code;
    }

    getEntryPoint() {
        return this.entryPoint;
    }
}

