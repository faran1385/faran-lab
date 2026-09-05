import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import {getVertexFormatSize} from "./utils.ts";

export interface VertexAttributeLayout {
    shaderLocation: number;
    format: GPUVertexFormat;
    arrayStride: number;
}


export class GeometryDescriptorProducer {
    static produce(geometry: GeometryWrapper) {
        const names = Array.from(geometry.getAttributes().keys()).sort();
        const descriptor = new Map<string, VertexAttributeLayout>();

        names.forEach((name, i) => {
            const attr = geometry.getAttributes().get(name)!;
            const format = attr.getFormat();
            descriptor.set(name, {
                shaderLocation: i,
                format,
                arrayStride: getVertexFormatSize(format),
            });
        });

        geometry.setLayoutDescriptor(descriptor)
    }
}