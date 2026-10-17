/**
 * Node-run tests for the binding layer (no GPU needed):
 *
 *   node --experimental-strip-types src/tests/bindingSet.test.ts
 */
import {Hasher} from "../engine/hashing/utils/Hasher.ts";
import {getEpoch} from "../engine/hashing/utils/epoch.ts";
import {StructLayout, type StructFieldType} from "../engine/bindings/StructLayout.ts";
import {ReadOnlyStorageBufferWrapper, UniformBufferWrapper} from "../engine/bindings/BindableWrappers.ts";
import {BindingSet} from "../engine/bindings/BindingSet.ts";
import {ShaderStage} from "../engine/bindings/ShaderStage.ts";
import {ImageWrapper} from "../engine/wrappers/ImageWrapper.ts";
import {SamplerWrapper} from "../engine/wrappers/SamplerWrapper.ts";
import {MaterialWrapper} from "../engine/wrappers/MaterialWrapper.ts";
import {MaterialComponentWrapper} from "../engine/wrappers/MaterialComponentWrapper.ts";
import {planMaterialFactors} from "../engine/producers/utils.ts";

// The wrappers read these constants when a buffer is created; Node has no WebGPU.
(globalThis as any).GPUBufferUsage ??= {
    MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512,
};

const hasher = await Hasher.create();

let failed = 0;
const check = (name: string, ok: boolean, info = "") => {
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name} ${ok ? "" : info}`);
};
const throws = (name: string, fn: () => unknown, mustInclude: string) => {
    try {
        fn();
        check(name, false, "did not throw");
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        check(name, message.includes(mustInclude), `message was: ${message}`);
    }
};

const VF = ShaderStage.VERTEX | ShaderStage.FRAGMENT;
const image = (format: GPUTextureFormat = "rgba8unorm") => new ImageWrapper(new ArrayBuffer(16), 2, 2, format);
const layoutOf = (s: BindingSet) => s.hashProvider.convertToLayoutHash(hasher);
const bindgroupOf = (s: BindingSet) => s.hashProvider.convertToBindgroupHash(hasher);

// ---------------------------------------------------------------- struct layout

{
    const l = new StructLayout("S", [{name: "a", type: "vec3f"}, {name: "b", type: "f32"}]);
    check("vec3f then f32 packs into the vec3's tail", l.getField("a").offset === 0 && l.getField("b").offset === 12 && l.size === 16, JSON.stringify(l.fields));
}
{
    const l = new StructLayout("S", [{name: "a", type: "f32"}, {name: "b", type: "vec3f"}]);
    check("f32 then vec3f: the vec3 jumps to 16", l.getField("b").offset === 16 && l.size === 32, JSON.stringify(l.fields));
}
{
    const l = new StructLayout("S", [{name: "a", type: "f32"}, {name: "b", type: "vec2f"}]);
    check("f32 then vec2f: the vec2 aligns to 8", l.getField("b").offset === 8 && l.size === 16 && l.alignment === 8);
}
{
    const l = new StructLayout("S", [{name: "a", type: "vec4f"}, {name: "b", type: "f32"}]);
    check("size rounds up to the largest alignment", l.size === 32 && l.alignment === 16);
}
{
    const m3 = new StructLayout("S", [{name: "m", type: "mat3x3f"}, {name: "t", type: "f32"}]);
    check("mat3x3f takes 48 bytes (padded columns)", m3.getField("t").offset === 48 && m3.size === 64, JSON.stringify(m3.fields));
    const m32 = new StructLayout("S", [{name: "m", type: "mat3x2f"}]);
    const m23 = new StructLayout("S", [{name: "m", type: "mat2x3f"}]);
    check("mat3x2f is 24 bytes / align 8, mat2x3f is 32 bytes / align 16", m32.size === 24 && m32.alignment === 8 && m23.size === 32 && m23.alignment === 16);
    const m4 = new StructLayout("S", [{name: "m", type: "mat4x4f"}]);
    check("mat4x4f is 64 bytes", m4.size === 64);
}

// The renderer lays material factors out by hand (planMaterialFactors). The general algorithm must agree with it.
for (const factorSizes of [[4, 3, 1, 1], [2, 1, 3], [4], [1, 1, 1, 1, 1]]) {
    const material = new MaterialWrapper();
    factorSizes.forEach((n, i) => material.setComponent(new MaterialComponentWrapper(`c${i}`, new Array(n).fill(0))));
    const plan = planMaterialFactors(material);
    const real = [...plan].filter(([name]) => !name.startsWith("_padding"));
    const layout = new StructLayout("Material", real.map(([name, e]) => ({name, type: e.wgslType as StructFieldType})));
    const sameOffsets = real.every(([name, e]) => layout.getField(name).offset === e.offset);
    const lastEnd = Math.max(...real.map(([name]) => layout.getField(name).offset + layout.getField(name).size));
    // the plan always pads to 16; the struct pads to its own alignment, which is 16 whenever a vec3/vec4 is present
    const sameSize = layout.alignment < 16 || layout.size === Math.ceil(lastEnd / 16) * 16;
    check(`matches planMaterialFactors for factors [${factorSizes}]`, sameOffsets && sameSize, JSON.stringify({plan: real, fields: layout.fields}));
}

{
    const l = new StructLayout("S", [{name: "v", type: "vec3f"}, {name: "m", type: "mat3x3f"}, {name: "i", type: "i32"}, {name: "u", type: "u32"}]);
    const view = new DataView(new ArrayBuffer(l.size));
    l.write(view, "v", [1, 2, 3]);
    l.write(view, "m", [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    l.write(view, "i", [-5]);
    l.write(view, "u", [7]);
    const vOk = [0, 4, 8].every((o, i) => view.getFloat32(l.getField("v").offset + o, true) === i + 1);
    const mBase = l.getField("m").offset;
    const mOk = [0, 4, 8, 16, 20, 24, 32, 36, 40].every((o, i) => view.getFloat32(mBase + o, true) === i + 1);
    const paddingOk = [12, 28, 44].every((o) => view.getFloat32(mBase + o, true) === 0);
    check("write: vec3f lands where the layout says", vOk);
    check("write: mat3x3f is spread over padded columns, padding stays zero", mOk && paddingOk);
    check("write: i32 and u32 round-trip", view.getInt32(l.getField("i").offset, true) === -5 && view.getUint32(l.getField("u").offset, true) === 7);
    throws("write: a fraction is not an i32", () => l.write(view, "i", [1.5]), "not an i32");
    throws("write: a negative is not a u32", () => l.write(view, "u", [-1]), "not a u32");
    throws("write: NaN is not a float", () => l.write(view, "v", [1, NaN, 3]), "not a finite float");
    throws("write: wrong number of values", () => l.write(view, "v", [1, 2]), "expected 3");
    throws("write: unknown field", () => l.write(view, "nope", [1]), 'no field "nope"');
}

throws("struct: bad struct name", () => new StructLayout("1abc", [{name: "a", type: "f32"}]), "not a valid WGSL identifier");
throws("struct: name with a double underscore prefix", () => new StructLayout("__x", [{name: "a", type: "f32"}]), "not a valid WGSL identifier");
throws("struct: duplicate field", () => new StructLayout("S", [{name: "a", type: "f32"}, {name: "a", type: "f32"}]), "two fields named");
throws("struct: no fields", () => new StructLayout("S", []), "at least one field");

// ---------------------------------------------------------------- bindable wrappers

{
    const params = new StructLayout("Params", [{name: "tint", type: "vec4f"}, {name: "strength", type: "f32"}]);
    const buffer = new UniformBufferWrapper({struct: params});
    check("uniform wrapper from a struct is struct-sized", buffer.getData().byteLength === params.size && buffer.bindingKind === "uniform-buffer");

    const before = getEpoch();
    buffer.setField("strength", [0.5]);
    check("setField writes the bytes", new DataView(buffer.getData()).getFloat32(params.getField("strength").offset, true) === 0.5);
    check("setField flags an upload and moves the epoch", buffer.hashProvider.needsUpdate() && getEpoch() > before);

    throws("setData with the wrong size is rejected", () => buffer.setData(new ArrayBuffer(8)), "is 32 bytes");
    buffer.setData(new ArrayBuffer(params.size));
    check("setData with the right size is accepted", true);

    throws("setField on raw bytes", () => new UniformBufferWrapper({byteSize: 16}).setField("a", [1]), "needs a struct description");
    throws("a byteSize must be positive", () => new UniformBufferWrapper({byteSize: 0}), "positive whole byteSize");
}
{
    const element = new StructLayout("Joint", [{name: "m", type: "mat4x4f"}]);
    const palette = new ReadOnlyStorageBufferWrapper({element, count: 3});
    check("storage wrapper holds count elements", palette.getData().byteLength === 3 * 64 && palette.bindingKind === "read-only-storage-buffer");
    palette.setElementField(2, "m", new Array(16).fill(0).map((_, i) => i + 1));
    check("setElementField writes at index * stride", new DataView(palette.getData()).getFloat32(2 * 64 + 4, true) === 2);
    throws("element index out of range", () => palette.setElementField(3, "m", new Array(16).fill(0)), "outside the array");
}

// ---------------------------------------------------------------- binding set: layout

{
    const forward = new BindingSet(1, [
        {binding: 0, value: new UniformBufferWrapper({byteSize: 16}), visibility: VF},
        {binding: 1, value: image(), visibility: ShaderStage.FRAGMENT},
        {binding: 2, value: new SamplerWrapper(), visibility: ShaderStage.FRAGMENT},
    ]);
    const shuffled = new BindingSet(1, [
        {binding: 2, value: new SamplerWrapper(), visibility: ShaderStage.FRAGMENT},
        {binding: 0, value: new UniformBufferWrapper({byteSize: 64}), visibility: VF},
        {binding: 1, value: image(), visibility: ShaderStage.FRAGMENT},
    ]);

    const d = forward.getLayoutDescriptor();
    check("layout entries are in binding order whatever the insertion order", shuffled.getEntries().map((e) => e.binding).join() === "0,1,2");
    check("layout entry per kind", d.entries.length === 3
        && (d.entries as GPUBindGroupLayoutEntry[])[0].buffer?.type === "uniform"
        && (d.entries as GPUBindGroupLayoutEntry[])[1].texture?.sampleType === "float"
        && (d.entries as GPUBindGroupLayoutEntry[])[1].texture?.viewDimension === "2d"
        && (d.entries as GPUBindGroupLayoutEntry[])[2].sampler?.type === "filtering");
    check("same shape, different resources: one layout hash", layoutOf(forward) === layoutOf(shuffled));
    check("different resources: different bind group hash", bindgroupOf(forward) !== bindgroupOf(shuffled));
}
{
    const make = (visibility: number, format: GPUTextureFormat = "rgba8unorm") =>
        new BindingSet(1, [{binding: 0, value: image(format), visibility}]);
    check("visibility is part of the layout hash", layoutOf(make(ShaderStage.FRAGMENT)) !== layoutOf(make(VF)));
    check("a depth texture needs another layout than a colour texture", layoutOf(make(VF)) !== layoutOf(make(VF, "depth32float")));
    check("rgba8unorm and bgra8unorm share a layout", layoutOf(make(VF)) === layoutOf(make(VF, "bgra8unorm")));

    const asUniform = new BindingSet(1, [{binding: 0, value: new UniformBufferWrapper({byteSize: 16}), visibility: VF}]);
    const asStorage = new BindingSet(1, [{binding: 0, value: new ReadOnlyStorageBufferWrapper({byteSize: 16}), visibility: VF}]);
    check("uniform and read-only storage never share a layout", layoutOf(asUniform) !== layoutOf(asStorage));

    const group1 = new BindingSet(1, [{binding: 0, value: new UniformBufferWrapper({byteSize: 16}), visibility: VF}]);
    const group2 = new BindingSet(2, [{binding: 0, value: new UniformBufferWrapper({byteSize: 16}), visibility: VF}]);
    check("the group index is not part of the layout hash", layoutOf(group1) === layoutOf(group2));
}
{
    const a = new BindingSet(1, [{binding: 0, value: new UniformBufferWrapper({byteSize: 16}), visibility: VF, name: "alpha"}]);
    const buffer = a.getEntry(0)!.value;
    const b = new BindingSet(1, [{binding: 0, value: buffer, visibility: VF, name: "beta"}]);
    check("a name never changes the layout hash", layoutOf(a) === layoutOf(b));
    check("a name never changes the bind group hash", bindgroupOf(a) === bindgroupOf(b));
}

// ---------------------------------------------------------------- binding set: early cutoff

{
    const buffer = new UniformBufferWrapper({byteSize: 16});
    const set = new BindingSet(1, [{binding: 0, value: buffer, visibility: VF}, {binding: 1, value: image(), visibility: VF}, {binding: 2, value: new SamplerWrapper(), visibility: VF}]);
    const layout0 = layoutOf(set);
    const group0 = bindgroupOf(set);
    check("hashes are stable between calls", layoutOf(set) === layout0 && bindgroupOf(set) === group0);

    set.setEntry({binding: 0, value: new UniformBufferWrapper({byteSize: 16}), visibility: VF});
    check("swapping a buffer changes the bind group but not the layout", layoutOf(set) === layout0 && bindgroupOf(set) !== group0);

    const group1 = bindgroupOf(set);
    set.setEntry({binding: 1, value: image("bgra8unorm"), visibility: VF});
    check("swapping an image for one of the same sample type keeps the layout", layoutOf(set) === layout0 && bindgroupOf(set) !== group1);

    const group2 = bindgroupOf(set);
    set.setEntry({binding: 2, value: new SamplerWrapper(), visibility: VF});
    check("a sampler with equal settings is the same resource: same bind group", bindgroupOf(set) === group2);

    set.setEntry({binding: 2, value: new SamplerWrapper("nearest", "nearest", "nearest", "clamp-to-edge", "clamp-to-edge"), visibility: VF});
    check("a sampler with other settings changes the bind group, not the layout", bindgroupOf(set) !== group2 && layoutOf(set) === layout0);

    set.setEntry({binding: 1, value: image("depth32float"), visibility: VF});
    check("swapping in a depth texture changes the layout too", layoutOf(set) !== layout0);
}

// ---------------------------------------------------------------- binding set: change detection and resource keys

{
    const img = image();
    const set = new BindingSet(1, [{binding: 0, value: img, visibility: VF}]);
    const at0 = set.getChangedAt();
    check("getChangedAt is stable while nothing changes", set.getChangedAt() === at0);

    img.setData(new ArrayBuffer(16));
    const at1 = set.getChangedAt();
    check("a change inside a bound wrapper is seen through the set", at1 > at0);

    set.setEntry({binding: 1, value: new SamplerWrapper(), visibility: VF});
    check("setEntry stamps the set", set.getChangedAt() > at1);

    const at2 = set.getChangedAt();
    set.removeEntry(7);
    check("removing a binding that is not there changes nothing", set.getChangedAt() === at2);
    set.removeEntry(1);
    check("removing a binding stamps the set", set.getChangedAt() > at2 && set.getEntries().length === 1);
}
{
    const buffer = new UniformBufferWrapper({byteSize: 16});
    const img = image();
    const sampler = new SamplerWrapper();
    const set = new BindingSet(0, [
        {binding: 0, value: buffer, visibility: VF},
        {binding: 1, value: img, visibility: VF},
        {binding: 2, value: sampler, visibility: VF},
    ]);
    const keys = set.getResourceKeys(hasher);
    check("resource keys are the keys the managers use",
        keys[0].kind === "buffer" && keys[0].key === buffer.hashProvider.convertToHash()
        && keys[1].kind === "texture" && keys[1].key === img.hashProvider.convertToHash(hasher)
        && keys[2].kind === "sampler" && keys[2].key === sampler.hashProvider.convertToHash(hasher));
}

// ---------------------------------------------------------------- binding set: validation

const buf = () => new UniformBufferWrapper({byteSize: 16});
throws("visibility 0 is rejected", () => new BindingSet(1, [{binding: 0, value: buf(), visibility: 0}]), "visibility");
throws("a visibility bit outside the stages is rejected", () => new BindingSet(1, [{binding: 0, value: buf(), visibility: 8}]), "visibility");
throws("a negative binding is rejected", () => new BindingSet(1, [{binding: -1, value: buf(), visibility: VF}]), "binding index");
throws("a negative group is rejected", () => new BindingSet(-1), "bind group index");
throws("the same binding twice in a declaration list", () => new BindingSet(1, [{binding: 0, value: buf(), visibility: VF}, {binding: 0, value: buf(), visibility: VF}]), "declared twice");
throws("two bindings with one name", () => new BindingSet(1, [{binding: 0, value: buf(), visibility: VF, name: "x"}, {binding: 1, value: buf(), visibility: VF, name: "x"}]), 'both named "x"');
throws("a name that is not WGSL", () => new BindingSet(1, [{binding: 0, value: buf(), visibility: VF, name: "my-buffer"}]), "valid WGSL identifier");
throws("a value that is not a wrapper", () => new BindingSet(1, [{binding: 0, value: {} as any, visibility: VF}]), "not a bindable wrapper");
{
    const set = new BindingSet(1, [{binding: 0, value: buf(), visibility: VF, name: "a"}]);
    throws("a failed setEntry leaves the set as it was", () => set.setEntry({binding: 1, value: buf(), visibility: 0}), "visibility");
    check("...and really unchanged", set.getEntries().length === 1);
    set.setEntry({binding: 0, value: buf(), visibility: VF, name: "a"});
    check("replacing a binding may keep its own name", set.getEntries().length === 1);
}

// ---------------------------------------------------------------- binding set: generated WGSL

{
    const params = new StructLayout("Params", [{name: "tint", type: "vec4f"}, {name: "strength", type: "f32"}]);
    const set = new BindingSet(1, [
        {binding: 2, value: new SamplerWrapper(), visibility: ShaderStage.FRAGMENT, name: "albedoSampler"},
        {binding: 0, value: new UniformBufferWrapper({struct: params}), visibility: VF, name: "params"},
        {binding: 1, value: image(), visibility: ShaderStage.FRAGMENT, name: "albedo"},
        {binding: 3, value: image("depth32float"), visibility: ShaderStage.FRAGMENT, name: "shadow"},
    ]);
    const code = set.getShaderPrelude();
    const at = (s: string) => code.indexOf(s);
    check("prelude declares the struct", code.includes("struct Params {") && code.includes("tint: vec4f,") && code.includes("strength: f32,"), code);
    check("prelude declares every binding with its group and index",
        code.includes("@group(1) @binding(0) var<uniform> params: Params;")
        && code.includes("@group(1) @binding(1) var albedo: texture_2d<f32>;")
        && code.includes("@group(1) @binding(2) var albedoSampler: sampler;")
        && code.includes("@group(1) @binding(3) var shadow: texture_depth_2d;"), code);
    check("prelude lists bindings in binding order", at("@binding(0)") < at("@binding(1)") && at("@binding(1)") < at("@binding(2)") && at("@binding(2)") < at("@binding(3)"));
}
{
    const element = new StructLayout("Joint", [{name: "m", type: "mat4x4f"}]);
    const set = new BindingSet(2, [{binding: 1, value: new ReadOnlyStorageBufferWrapper({element, count: 4}), visibility: ShaderStage.VERTEX, name: "palette"}]);
    check("a storage array is declared as an array of its element struct",
        set.getShaderPrelude().includes("@group(2) @binding(1) var<storage, read> palette: array<Joint>;"), set.getShaderPrelude());
}
throws("a raw uniform buffer cannot be turned into WGSL",
    () => new BindingSet(1, [{binding: 0, value: buf(), visibility: VF, name: "raw"}]).getShaderPrelude(),
    "declare it in your own shader");

if (failed) throw new Error(`${failed} check(s) failed`);
console.log("\nall binding layer checks passed");
