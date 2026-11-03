import type {BindGroupEntry, Struct} from "./AssemblerProducers.ts";
import type {GeometryBindingPlan} from "./BindGroupLayoutProducer.ts";

export type VATPlan = {
    position: {
        header: string
        texture: string
    } | undefined
    normal: {
        header: string
        texture: string
    } | undefined
    tangent: {
        header: string
        texture: string
    } | undefined
}

export function getVATGeometryBindings(plan: GeometryBindingPlan) {
    const positionVATKey = plan.vatKeys.get("position");
    const normalVATKey = plan.vatKeys.get("normal");
    const tangentVATKey = plan.vatKeys.get("tangent");

    if (!positionVATKey && !normalVATKey && !tangentVATKey) return null

    const struct: Struct = {
        structName: `VATHeaderUniforms`,
        fields: [
            {name: "frame", type: "u32", offset: 0},
            {name: "textureWidth", type: "u32", offset: 4},
            {name: "textureHeight", type: "u32", offset: 8},
            {name: "pad_0", type: "u32", offset: 12},
        ],
    }

    const vatSet = new Set<string | undefined>([positionVATKey, normalVATKey, tangentVATKey]);

    const entries: BindGroupEntry[] = []
    const vatPlan = {
        position: positionVATKey ? {
            header: `VATHeader${plan.byComponent.get(`vat-header-${positionVATKey}`)!.binding}`,
            texture: `VATTexture${plan.byComponent.get(`vat-texture-${positionVATKey}`)!.binding}`,
        } : undefined,
        normal: normalVATKey ? {
            header: `VATHeader${plan.byComponent.get(`vat-header-${normalVATKey}`)!.binding}`,
            texture: `VATTexture${plan.byComponent.get(`vat-texture-${normalVATKey}`)!.binding}`,
        } : undefined,
        tangent: tangentVATKey ? {
            header: `VATHeader${plan.byComponent.get(`vat-header-${tangentVATKey}`)!.binding}`,
            texture: `VATTexture${plan.byComponent.get(`vat-texture-${tangentVATKey}`)!.binding}`,
        } : undefined,
    }

    vatSet.forEach((component) => {
        if (!component) return;
        const vatHeader = plan.byComponent.get(`vat-header-${component}`)!;
        const vatTexture = plan.byComponent.get(`vat-texture-${component}`)!;
        entries.push({
            kind: "uniform",
            group: 3,
            binding: vatHeader.binding,
            name: `VATHeader${vatHeader.binding}`,
            uniformType: "VATHeaderUniforms",
            size: 16,
        }, {
            kind: "texture",
            group: 3,
            binding: vatTexture.binding,
            name: `VATTexture${vatTexture.binding}`,
            textureType: "texture_2d<f32>"
        })
    })


    return {
        entries,
        structs: [struct],
        plan: vatPlan
    }
}

