# Chill Town · Godot client

Godot 4.7 (Mobile renderer), targets PC / iOS / Android. Design: `../design/GDD.md` v0.2.

## Run
Open this folder in Godot and press F5. Or run from the command line:

    godot --path .

Controls: WASD/arrows or tap/click the ground to walk · mouse wheel/pinch to zoom · Enter to chat · R toggles rain · T toggles day/night.

## Dev screenshot
    godot --path . -- --shot=out.png --shot-frames=120 [--zoom=0.6] [--day] [--no-rain] [--say=ข้อความ]

## Layout
- `scripts/model/`: data, no nodes (ChatLog)
- `scripts/view/`: builds what is drawn (CityBuilder, Chibi, ChatPanel, Toon materials)
- `scripts/controller/`: input and wiring (scene root, PlayerController)
- `assets/shaders/`: toon + outline · `assets/fonts/`: Mali (OFL, Thai + Latin)

Test scene status: the city is box blockout and the chibi is a placeholder built from primitives; both will be replaced by real models.
