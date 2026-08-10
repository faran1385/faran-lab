import type {GeometryWrapper} from "../wrappers/GeometryWrapper.ts";
import type {VertexFormat} from "../importers/utils/IR.ts";


interface VertexAttributeLayout {
    shaderLocation: number;
}

const FORMAT_BYTE_SIZE: Record<VertexFormat, number> = {
    "float32x2": 8,
    "float32x3": 12,
    "float32x4": 16,
    "uint16x2": 4,
    "uint32": 4,
};

function formatByteSize(format: VertexFormat): number {
    return FORMAT_BYTE_SIZE[format];
}

export class GeometryDescriptorProducer {
    private static getLocations(geometry: GeometryWrapper): Map<string, VertexAttributeLayout> {
        const names = Array.from(geometry.getAttributes().keys()).sort();
        const layout = new Map<string, VertexAttributeLayout>();
        names.forEach((name, i) => layout.set(name, {shaderLocation: i}));
        return layout;
    }

    static produce(wrapper: GeometryWrapper): GPUVertexBufferLayout[] {
        const locations = this.getLocations(wrapper);

        return Array.from(wrapper.getAttributes().entries()).map(([name, attr]) => {
            const stride = formatByteSize(attr.getFormat());
            return {
                arrayStride: stride,
                stepMode: "vertex",
                attributes: [{
                    shaderLocation: locations.get(name)!.shaderLocation,
                    format: attr.getFormat(),
                    offset: 0,
                }],
            };
        });
    }
}
