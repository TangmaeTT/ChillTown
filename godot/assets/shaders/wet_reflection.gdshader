// Reflection of a light on wet ground: a flat streak from the light's foot
// toward the camera (where the mirrored light would appear in the isometric
// view), fading with distance and broken into ripple bands. Strength follows
// rain (wet_amount) and, for lights that only burn at night, night_amount.
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;

uniform vec4 color : source_color = vec4(1.0, 0.8, 0.5, 1.0);
uniform float strength = 1.0;
uniform bool night_only = true;
global uniform float night_amount;
global uniform float wet_amount;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	float along = UV.y;
	float across = abs(UV.x - 0.5) * 2.0;
	float fade = pow(1.0 - along, 2.0) * (1.0 - smoothstep(0.0, 1.0, across));
	// Broken dashes drifting slowly, like light smeared on wet asphalt.
	vec2 cell = floor(vec2(UV.x * 7.0, along * 34.0 - TIME * 1.2));
	float ripple = mix(0.3, 1.0, step(0.4, hash(cell)));
	float on = night_only ? night_amount : 1.0;
	ALBEDO = color.rgb * fade * ripple * strength * wet_amount * on;
}
