// Inverted-hull outline, used as next_pass on smooth meshes (characters, trees).
shader_type spatial;
render_mode unshaded, cull_front;

uniform vec4 outline_color : source_color = vec4(0.08, 0.06, 0.08, 1.0);
uniform float thickness = 0.015;

void vertex() {
	VERTEX += NORMAL * thickness;
}

void fragment() {
	ALBEDO = outline_color.rgb;
}
