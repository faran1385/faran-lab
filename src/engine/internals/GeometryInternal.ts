import type {VertexBufferEntry} from "../Representations/PipelineRepresentation.ts";

export class GeometryInternal {
    private vertexBuffers = new Map<string, VertexBufferEntry>()
    
    setVertexBuffer(vertexBuffer: VertexBufferEntry) {
        this.vertexBuffers.set(vertexBuffer.uuid, vertexBuffer);
    }

    removeVertexBuffer(vertexBuffer: VertexBufferEntry) {
        this.vertexBuffers.delete(vertexBuffer.uuid);
    }

}