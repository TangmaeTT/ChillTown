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
// Fill light for characters, added once (with the sun/moon) in light(), so it
// multiplies the albedo after decals: a face decal's dark eyes stay dark.
// Follows night_amount like emission (day_emission share by day).
uniform float fill = 0.0;
// Pixel-art face textures from tools/texture_from_ai.py (32 px per metre).
uniform bool use_tex = false;
uniform sampler2D albedo_tex : source_color, filter_nearest, repeat_disable;
uniform sampler2D emission_tex : source_color, filter_nearest, repeat_disable, hint_default_black;
uniform float tex_emission_energy = 2.0;
// Sprite sheets: the part of the texture shown (x, y, w, h in UV).
uniform vec4 uv_rect = vec4(0.0, 0.0, 1.0, 1.0);
// Sprite cards are lit as if they faced the sky, so a sun or lamp behind the
// card still lights the character (Flavour Edge-style sprites).
uniform bool light_as_up = false;
// Outfit layer drawn over the sprite (hair), same sheet layout. With
// overlay_dye on, it is recoloured to overlay_tint keeping its shading;
// strongly red pixels (hair ties, ribbons) keep their own colour.
uniform bool use_overlay = false;
uniform sampler2D overlay_tex : source_color, filter_nearest, repeat_disable;
uniform bool overlay_dye = false;
uniform vec3 overlay_tint : source_color = vec3(1.0);
// The layer's average hair luminance: a pixel this light gets exactly the tint.
uniform float overlay_ref = 0.3;
// Tiled ground from tools/gen_ground.py, projected from above in world space.
// The texture stores value / 2, so it can brighten as well as darken.
uniform bool use_ground = false;
uniform sampler2D ground_tex : source_color, filter_nearest, repeat_enable;
uniform float ground_tile_m = 2.0;
// 0 dry .. 1 soaked (rain); scales the wet look of materials with wetness > 0.
global uniform float wet_amount;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

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
	if (light_as_up) {
		NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	}
	if (use_tex) {
		vec2 uv = uv_rect.xy + UV * uv_rect.zw;
		vec4 t = texture(albedo_tex, uv);
		if (use_overlay) {
			vec4 o = texture(overlay_tex, uv);
			if (o.a > 0.5) {
				vec3 c = o.rgb;
				bool accent = c.r > 0.35 && c.r > c.g * 1.6 && c.r > c.b * 1.6;
				if (overlay_dye && !accent) {
					// Scale the tint by the pixel's lightness relative to the
					// layer's average, so highlights and outline survive.
					float lum = dot(c, vec3(0.299, 0.587, 0.114));
					c = clamp(overlay_tint * (lum / overlay_ref), 0.0, 1.0);
				}
				t = vec4(c, 1.0);
			}
		}
		if (t.a < 0.5) {
			discard;
		}
		base *= t.rgb;
		glow += texture(emission_tex, uv).rgb * tex_emission_energy;
	}
	if (use_ground) {
		base *= texture(ground_tex, world_pos.xz / ground_tile_m).rgb * 2.0;
	}
	float wet = wetness * wet_amount;
	ALBEDO = base * mix(1.0, 0.72, wet);
	ROUGHNESS = mix(0.95, 0.2, wet);
	EMISSION = glow * mix(day_emission, 1.0, night_amount);
}

void light() {
	float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0) * ATTENUATION;
	float banded = smoothstep(0.02, 0.02 + band_softness, ndl) * 0.6
		+ smoothstep(0.4, 0.4 + band_softness, ndl) * 0.4;
	float tone = mix(ndl, banded, toon);
	DIFFUSE_LIGHT += LIGHT_COLOR * tone / PI;

	if (LIGHT_IS_DIRECTIONAL && fill > 0.0) {
		DIFFUSE_LIGHT += vec3(fill * mix(day_emission, 1.0, night_amount));
	}

	float rim = smoothstep(0.62, 0.7, 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0));
	DIFFUSE_LIGHT += LIGHT_COLOR * rim * rim_amount * toon * step(0.01, ndl) / PI;

	float wet = wetness * wet_amount;
	if (wet > 0.0) {
		vec3 h = normalize(VIEW + LIGHT);
		float s = pow(clamp(dot(NORMAL, h), 0.0, 1.0), mix(16.0, 400.0, wet));
		SPECULAR_LIGHT += LIGHT_COLOR * smoothstep(0.3, 0.6, s) * wet * ATTENUATION * 0.6;
	}
}
