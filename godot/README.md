# Chill Town · Godot client

Godot 4.7 (Mobile renderer), targets PC / iOS / Android. Design: `../design/GDD.md` v0.2.

## Run
Open this folder in Godot and press F5. Or run from the command line:

    godot --path .

Controls: WASD/arrows or tap/click the ground to walk · mouse wheel/pinch to zoom · Enter to chat · R rain · T skip 2 game hours · P pixel size (1–4).

## Dev screenshot
    godot --path . -- --shot=out.png --shot-frames=120 [--pixel=2] [--zoom=0.6] [--time=22] [--rain] [--say=ข้อความ]

## Layout
- `scripts/model/`: data, no nodes (ChatLog)
- `scripts/view/`: builds what is drawn (CityBuilder, Chibi, ChatPanel, Toon materials)
- `scripts/controller/`: input and wiring (scene root, PlayerController)
- `assets/shaders/`: toon + outline · `assets/fonts/`: Mali (OFL, Thai + Latin)

Test scene status: the city is box blockout and the chibi is a placeholder built from primitives; both will be replaced by real models.

## Pixel look
The 3D world renders into a SubViewport at 1/N resolution (`P`, default 2) and is scaled up with nearest filtering. An orthographic camera snapped to whole game pixels keeps it from shimmering. Name tags and chat bubbles (`BubbleLayer`) are drawn in 2D at full resolution, so Thai text stays sharp.

Visual target: Flavour Edge (isometric pixel art, see GDD §12). The camera is isometric 2:1 (45° yaw, 30° pitch). `GameClock` (model) drives `SkyRig` (view): the sun and moon arc across the sky so shadows sweep through the day, and street lamps switch on at night with the 2 nearest casting shadows. Characters use hard toon bands; the environment uses soft falloff. Occluders (skytrain, trees) dither out around the player through the `player_position` shader global.
