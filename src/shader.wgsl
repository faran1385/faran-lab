struct Uniforms {
  model : mat4x4<f32>,
  view : mat4x4<f32>,
  projection : mat4x4<f32>,
};

@group(0) @binding(2) var<uniform> projectionMatrix : mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix : mat4x4<f32>;
@group(0) @binding(0) var<uniform> modelMatrix : mat4x4<f32>;


struct VertexOut {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec3<f32>,
};



@vertex
fn vs_main(

  @location(0) position : vec3<f32>,
  @location(1) color : vec3<f32>,
  @location(2) normal : vec3<f32>,
) -> VertexOut {

    var out : VertexOut;

    out.position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    out.color=vec3(color);

    return out;
}

struct FragmentOutput {
    @location(0) color: vec4<f32>,
}


@fragment
fn fs_main(in : VertexOut,@builtin(front_facing) is_front: bool) -> FragmentOutput {
  return FragmentOutput(
    vec4<f32>(in.color, 1.0)
  );
}
