import {v4 as uuidv4} from "uuid";


export class ShaderStageRepresentation {
    readonly uuid: string;
    private entryPoint!: string;
    private code!: string

    constructor() {
        this.uuid = uuidv4();
    }

    getEntryPoint(){
        return this.entryPoint;
    }

    getCode(){
        return this.code;
    }

    setCode(code: string) {
        this.code = code;
    }

    setEntryPoint(entryPoint: string) {
        this.entryPoint = entryPoint;
    }
}