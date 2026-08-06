import {v4 as uuidv4} from "uuid";

export class ImageWrapper {

    private memeType: string;
    private data: ArrayBuffer;
    readonly uuid: string;

    constructor(memeType: string, data: ArrayBuffer) {
        this.memeType = memeType;
        this.data = data;
        this.uuid = uuidv4();
    }


}