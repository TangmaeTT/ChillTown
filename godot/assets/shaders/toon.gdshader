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
// Painted ground (tools/city_convert.py tiles): the texture is the colour itself.
uniform bool ground_raw = false;
// Turn the tile a quarter (zebra stripes across a road running along X).
uniform bool ground_swap = false;
// 0 dry .. 1 soaked (rain); scales the wet look of materials with wetness > 0.
global uniform float wet_amount;
// Voxel props (tools/voxel_from_views.py): colour per vertex, alpha = how strongly
// that voxel face glows at night (lit windows, lamps).
uniform bool use_vcolor = false;
uniform float vcolor_emission = 2.0;
// Big voxel pieces (station, train): the mesh is only the carved shape; each face reads
// its colour from the view that looks at it, at that voxel's pixel (32 per metre).
uniform bool use_vtex = false;
uniform vec3 vtex_size = vec3(1.0);     // voxels: W (x), H (y), D (z)
uniform sampler2D vtex_front : source_color, filter_nearest, repeat_disable;
uniform sampler2D vtex_side : source_color, filter_nearest, repeat_disable;
uniform sampler2D vtex_top : source_color, filter_nearest, repeat_disable;
uniform sampler2D vtex_front_em : source_color, filter_nearest, repeat_disable, hint_default_black;
uniform sampler2D vtex_side_em : source_color, filter_nearest, repeat_disable, hint_default_black;
uniform sampler2D vtex_top_em : source_color, filter_nearest, repeat_disable, hint_default_black;

varying vec3 world_pos;
varying vec4 vcol;
varying vec3 local_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vcol = COLOR;
	local_pos = VERTEX;
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
	if (use_vtex) {
		// The face's own direction from its slope on screen (NORMAL may be bent to light a
		// step like the surface it belongs to), turned toward the camera, snapped to an axis.
		vec3 n = cross(dFdx(local_pos), dFdy(local_pos));
		vec3 to_cam = (inverse(MODEL_MATRIX) * vec4(INV_VIEW_MATRIX[2].xyz, 0.0)).xyz;
		n *= sign(dot(n, to_cam));
		vec3 an = abs(n);
		n = an.x > an.y && an.x > an.z ? vec3(sign(n.x), 0, 0)
				: (an.y > an.z ? vec3(0, sign(n.y), 0) : vec3(0, 0, sign(n.z)));
		// Vertex colour (voxel_from_views) picks the view: r = side, g = top, else front.
		int view = vcol.r > 0.5 ? 1 : (vcol.g > 0.5 ? 2 : 0);
		// Voxel index of this face: half a voxel inside the surface.
		vec3 v = floor(vec3(local_pos.x * 32.0 + vtex_size.x * 0.5, local_pos.y * 32.0,
				local_pos.z * 32.0 + vtex_size.z * 0.5) - n * 0.5);
		vec2 uf = vec2((vtex_size.x - v.x - 0.5) / vtex_size.x, (vtex_size.y - v.y - 0.5) / vtex_size.y);
		vec4 c = texture(vtex_front, uf);
		vec3 e = texture(vtex_front_em, uf).rgb;
		if (view == 1) {
			vec2 us = vec2((v.z + 0.5) / vtex_size.z, (vtex_size.y - v.y - 0.5) / vtex_size.y);
			vec4 cs = texture(vtex_side, us);
			if (cs.a > 0.5) { c = cs; e = texture(vtex_side_em, us).rgb; }
		} else if (view == 2) {
			vec2 ut = vec2((v.x + 0.5) / vtex_size.x, (v.z + 0.5) / vtex_size.z);
			vec4 ct = texture(vtex_top, ut);
			if (ct.a > 0.5) { c = ct; e = texture(vtex_top_em, ut).rgb; }
		} else if (n.y < -0.5) {
			c.rgb *= 0.5;
		}
		base *= c.rgb;
		glow += e * vcolor_emission;
	}
	if (use_vcolor) {
		base *= vcol.rgb;
		glow += vcol.rgb * vcol.a * vcolor_emission;
	}
	if (use_ground) {
		vec2 gp = ground_swap ? world_pos.zx : world_pos.xz;
		vec3 g = texture(ground_tex, gp / ground_tile_m).rgb;
		base = ground_raw ? g : base * g * 2.0;
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
