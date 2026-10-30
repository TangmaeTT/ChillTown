// Toon lighting for every world and character mesh.
// Two hard bands per light, cool shadows come from the environment ambient,
// wet surfaces get a sharp highlight under each lamp.
shader_type spatial;

uniform vec4 albedo : source_color = vec4(1.0);
uniform float wetness : hint_range(0.0, 1.0) = 0.0;
uniform vec4 emission_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float emission_energy = 0.0;
uniform float rim_amount : hint_range(0.0, 1.0) = 0.0;
uniform float band_softness = 0.03;

void fragment() {
	ALBEDO = albedo.rgb;
	ROUGHNESS = mix(0.95, 0.2, wetness);
	EMISSION = emission_color.rgb * emission_energy;
}

void light() {
	float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0) * ATTENUATION;
	float tone = smoothstep(0.02, 0.02 + band_softness, ndl) * 0.6
		+ smoothstep(0.4, 0.4 + band_softness, ndl) * 0.4;
	DIFFUSE_LIGHT += LIGHT_COLOR * tone / PI;

	float rim = smoothstep(0.62, 0.7, 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0));
	DIFFUSE_LIGHT += LIGHT_COLOR * rim * rim_amount * step(0.01, ndl) / PI;

	if (wetness > 0.0) {
		vec3 h = normalize(VIEW + LIGHT);
		float s = pow(clamp(dot(NORMAL, h), 0.0, 1.0), mix(16.0, 400.0, wetness));
		SPECULAR_LIGHT += LIGHT_COLOR * smoothstep(0.3, 0.6, s) * wetness * ATTENUATION * 0.6;
	}
}
