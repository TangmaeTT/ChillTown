// Post pass on the low-res game view: darkens the pixel on the near side of
// every depth jump, giving each object a 1-pixel selective outline (its own
// colour, darker) like hand-made pixel art. Drawn by a full-screen quad that
// writes only the edge pixels, first among transparent objects, so rain,
// reflections and signs still draw on top.
shader_type spatial;
render_mode unshaded, depth_draw_never, depth_test_disabled, cull_disabled, shadows_disabled, fog_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
// Depth gap (metres) that counts as an edge, and how dark the edge pixel gets.
uniform float threshold = 0.5;
uniform float darken = 0.5;

void vertex() {
	POSITION = vec4(VERTEX.xy * 2.0, 0.0, 1.0);
}

float view_depth(vec2 uv, mat4 inv_proj) {
	float d = texture(depth_tex, uv).r;
	vec4 v = inv_proj * vec4(uv * 2.0 - 1.0, d, 1.0);
	return -v.z / v.w;
}

void fragment() {
	vec2 px = 1.0 / VIEWPORT_SIZE;
	float c = view_depth(SCREEN_UV, INV_PROJECTION_MATRIX);
	float gap = 0.0;
	gap = max(gap, view_depth(SCREEN_UV + vec2(px.x, 0.0), INV_PROJECTION_MATRIX) - c);
	gap = max(gap, view_depth(SCREEN_UV - vec2(px.x, 0.0), INV_PROJECTION_MATRIX) - c);
	gap = max(gap, view_depth(SCREEN_UV + vec2(0.0, px.y), INV_PROJECTION_MATRIX) - c);
	gap = max(gap, view_depth(SCREEN_UV - vec2(0.0, px.y), INV_PROJECTION_MATRIX) - c);
	ALBEDO = texture(screen_tex, SCREEN_UV).rgb * darken;
	ALPHA = gap > threshold ? 1.0 : 0.0;
}
