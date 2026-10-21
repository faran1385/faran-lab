import {v4 as uuidv4} from "uuid";
import {ShaderStageRepresentationHashProvider} from "../hashing/ShaderStageRepresentationHashProvider.ts";


export class ShaderStageRepresentation {
    readonly uuid: string;
    private entryPoint: string = "main";
    private code!: string

    readonly hashProvider: ShaderStageRepresentationHashProvider;

    constructor() {
        this.uuid = uuidv4();
        this.hashProvider = new ShaderStageRepresentationHashProvider({getCode: () => this.code});
    }

    getEntryPoint(){
        return this.entryPoint;
    }

    getCode(){
        return this.code;
    }

    setCode(code: string) {
        this.code = code;
        this.hashProvider.markChanged();
    }

    setEntryPoint(entryPoint: string) {
        this.entryPoint = entryPoint;
        this.hashProvider.markChanged();
    }
}