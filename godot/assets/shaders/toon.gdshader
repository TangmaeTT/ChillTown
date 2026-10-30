// Lighting for every world and character mesh. toon = 1: two hard bands per
// light (characters); toon = 0: soft falloff (environment), so lamp pools
// fade smoothly. Cool shadows come from the environment ambient; wet
// surfaces get a sharp highlight under each light.
shader_type spatial;

uniform vec4 albedo : source_color = vec4(1.0);
uniform float wetness : hint_range(0.0, 1.0) = 0.0;
uniform vec4 emission_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float emission_energy = 0.0;
uniform float rim_amount : hint_range(0.0, 1.0) = 0.0;
uniform float band_softness = 0.03;
uniform float toon : hint_range(0.0, 1.0) = 1.0;
// Cutaway: occluders (skytrain, trees) dither out in a circle around the
// player wherever they sit between the camera and the player.
uniform bool cutaway = false;
uniform float cutaway_radius = 2.2;
global uniform vec3 player_position;
// 0 by day .. 1 at night (SkyRig). Lights glow fully only at night; by day
// they keep day_emission of their strength. Characters use 1 (constant fill).
global uniform float night_amount;
uniform float day_emission = 0.25;
// Pixel-art face textures from tools/texture_from_ai.py (32 px per metre).
uniform bool use_tex = false;
uniform sampler2D albedo_tex : source_color, filter_nearest, repeat_disable;
uniform sampler2D emission_tex : source_color, filter_nearest, repeat_disable;
uniform float tex_emission_energy = 2.0;

float bayer4(vec2 p) {
	ivec2 i = ivec2(mod(p, 4.0));
	int m[16] = int[](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
	return (float(m[i.y * 4 + i.x]) + 0.5) / 16.0;
}

void fragment() {
	if (cutaway) {
		vec3 p = (VIEW_MATRIX * vec4(player_position + vec3(0.0, 0.8, 0.0), 1.0)).xyz;
		float d = length(VERTEX.xy - p.xy) / cutaway_radius;
		if (VERTEX.z > p.z + 0.6 && bayer4(FRAGCOORD.xy) > smoothstep(0.55, 1.0, d)) {
			discard;
		}
	}
	vec3 base = albedo.rgb;
	vec3 glow = emission_color.rgb * emission_energy;
	if (use_tex) {
		vec4 t = texture(albedo_tex, UV);
		if (t.a < 0.5) {
			discard;
		}
		base *= t.rgb;
		glow += texture(emission_tex, UV).rgb * tex_emission_energy;
	}
	ALBEDO = base;
	ROUGHNESS = mix(0.95, 0.2, wetness);
	EMISSION = glow * mix(day_emission, 1.0, night_amount);
}

void light() {
	float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0) * ATTENUATION;
	float banded = smoothstep(0.02, 0.02 + band_softness, ndl) * 0.6
		+ smoothstep(0.4, 0.4 + band_softness, ndl) * 0.4;
	float tone = mix(ndl, banded, toon);
	DIFFUSE_LIGHT += LIGHT_COLOR * tone / PI;

	float rim = smoothstep(0.62, 0.7, 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0));
	DIFFUSE_LIGHT += LIGHT_COLOR * rim * rim_amount * toon * step(0.01, ndl) / PI;

	if (wetness > 0.0) {
		vec3 h = normalize(VIEW + LIGHT);
		float s = pow(clamp(dot(NORMAL, h), 0.0, 1.0), mix(16.0, 400.0, wetness));
		SPECULAR_LIGHT += LIGHT_COLOR * smoothstep(0.3, 0.6, s) * wetness * ATTENUATION * 0.6;
	}
}
