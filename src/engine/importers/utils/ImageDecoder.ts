import type {DecodedImage} from "./IR.ts";

export class ImageDecoder {

    static async decode(
        data: ArrayBuffer,
        mimeType: string
    ): Promise<DecodedImage> {

        const blob = new Blob(
            [data],
            {type: mimeType}
        );

        const bitmap = await createImageBitmap(blob);


        const canvas = new OffscreenCanvas(
            bitmap.width,
            bitmap.height
        );

        const ctx = canvas.getContext("2d")!;

        ctx.drawImage(
            bitmap,
            0,
            0
        );

        const pixels = ctx.getImageData(
            0,
            0,
            bitmap.width,
            bitmap.height
        );


        return {
            width: bitmap.width,
            height: bitmap.height,
            data: pixels.data.buffer
        };
    }

}