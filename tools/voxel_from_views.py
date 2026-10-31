"""voxel_from_views - carve one solid voxel prop out of its front, side and top views.

  python tools/voxel_from_views.py city_noodle_cart [city_bench ...]
  python tools/voxel_from_views.py --all        # every city_* texture set with _front/_side/_top

Inputs are the converted face textures (godot/assets/textures/<name>_{front,side,top}_albedo.png
and _emission.png, 32 px per metre, from tools/city_convert.py). One voxel = one game pixel.
A voxel is solid where all three silhouettes are solid (visual hull), so the views become
one object instead of cards pasted on a box. Each exposed face takes its colour from the
view that looks at it: -Z/+Z from the front, -X/+X from the side, +Y from the top. Codex
does not always draw the side from the left or the top the same way round, so every
mirror/rotation of the side and top is tried and the one whose carved shape matches all
three silhouettes best is kept.

Writes godot/assets/models/<name>.glb: one mesh, origin at the centre of the footprint on
the ground, vertex colour = albedo (linear, 8 bit), vertex alpha = night glow strength. Faces of
the same colour in a row are merged into one quad. Godot
draws it with Toon.vcolor(). Needs NumPy + Pillow.
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEX = ROOT / 'godot' / 'assets' / 'textures'
OUT = ROOT / 'godot' / 'assets' / 'models'
PPM = 32.0
MAX_VOXELS = 6_000_000
VIEW_PARTS = ('front', 'side', 'top')
TEXTURED_NAMES = {'city_train_head', 'city_train_mid'}


def load(name, part, kind='albedo'):
    p = TEX / f'{name}_{part}_{kind}.png'
    return np.array(Image.open(p).convert('RGBA')) if p.exists() else None


def resize(img, w, h):
    return np.array(Image.fromarray(img).resize((w, h), Image.NEAREST))


def dihedral(img):
    """The 8 rotations/mirrors of an image, with a label."""
    out = []
    for k in range(4):
        r = np.rot90(img, k)
        out.append((f'rot{k}', r))
        out.append((f'rot{k}m', r[:, ::-1]))
    return out


def carve(F, S, T):
    """F: front alpha (H, W) as seen from -Z, u -> -X (texture left is world +X).
    S: side alpha (H, D) as seen from -X, u -> +Z. T: top alpha (D, W), row = z, col = x.
    Returns occ[y, x, z] with y = 0 at the bottom."""
    f = F[::-1, ::-1]                    # [y, x]
    s = S[::-1, :]                       # [y, z]
    return f[:, :, None] & s[:, None, :] & T.T[None, :, :]


def score(occ, F, S, T):
    def iou(a, b):
        u = (a | b).sum()
        return (a & b).sum() / u if u else 0.0
    f = occ.any(2)[::-1, ::-1]
    s = occ.any(1)[::-1, :]
    t = occ.any(0).T
    return iou(f, F) + iou(s, S) + iou(t, T)


def srgb_to_linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


NORMALS = [(0, 0, -1), (0, 0, 1), (-1, 0, 0), (1, 0, 0), (0, 1, 0), (0, -1, 0)]


SLOPE_R = 3          # voxels: how far around a face the shape is blurred to find its slope


def surface(occ):
    """What face_view needs about the carved shape: how deep each voxel sits below the
    surface each view sees, from both ends of its ray (f along z, s along x, t down from the
    top; 0 = that view draws this voxel), and the shape blurred over SLOPE_R voxels."""
    def depth(axis):
        n = occ.shape[axis]
        first = np.expand_dims(occ.argmax(axis), axis)
        last = np.expand_dims(n - 1 - np.flip(occ, axis).argmax(axis), axis)
        i = np.arange(n).reshape([-1 if a == axis else 1 for a in range(3)])
        return i - first, last - i
    big = np.iinfo(np.int64).max // 2
    _, top = depth(0)
    blur = occ.astype(np.uint16)
    for axis in range(3):
        c = np.cumsum(blur, axis, dtype=np.uint16)
        n = c.shape[axis]
        hi = np.take(c, np.minimum(np.arange(n) + SLOPE_R, n - 1), axis)
        lo = np.take(c, np.maximum(np.arange(n) - SLOPE_R - 1, 0), axis)
        lo[tuple(slice(0, SLOPE_R + 1) if a == axis else slice(None) for a in range(3))] = 0
        blur = hi - lo
    return {'f': depth(2), 's': depth(1), 't': (top, np.full_like(top, big)), 'blur': np.pad(blur, 1)}


def face_view(view, normal, ys, xs, zs, surf):
    """Which view colours each face, and which normal it is lit by. Each step of a curved
    shape is a flat voxel face, but the views draw the curve: the top view's rim of a bush is
    the pale outline of the dome, not its side. So a face takes the view facing its real
    slope (the blurred shape's gradient) and is lit like it, and a curve shades as one smooth
    curve instead of a white line along every step. A face its view cannot see (a ledge
    under the roof) goes to the view that sees that voxel nearest the surface."""
    own = NORMALS.index(normal)
    pick = np.full(len(ys), view)
    nidx = np.full(len(ys), own)
    if normal == (0, -1, 0):
        return pick, nidx
    b = surf['blur'].astype(np.int32)
    y, x, z = ys + 1, xs + 1, zs + 1
    slope = np.stack([b[y, x, z - 1] - b[y, x, z + 1], b[y, x - 1, z] - b[y, x + 1, z],
                      b[y - 1, x, z] - b[y + 1, x, z]], 1).astype(np.float32)   # out: z, x, y
    slope /= np.maximum(np.linalg.norm(slope, axis=1, keepdims=True), 1e-6)
    # Facing per candidate f-, f+, s-, s+, t+ (NORMALS order).
    dot = np.stack([-slope[:, 0], slope[:, 0], -slope[:, 1], slope[:, 1], slope[:, 2]], 1)
    d = np.stack([surf[v][end][ys, xs, zs] for v in 'fst' for end in (0, 1)], 1)[:, :5]
    back = NORMALS.index(tuple(-v for v in normal))
    if back < 5:
        dot[:, back] = -2                               # never light a face from behind
    # Keep the face's own view while it faces within 60 degrees of its slope and sees it.
    keep = (dot[:, own] >= 0.5) & (d[:, own] == 0)
    best = np.where(d == 0, dot, dot - 3).argmax(1)    # facing views that see it first
    best = np.where(keep, own, best)
    pick = np.array(list('ffsst'))[best]
    return pick, best


def face_colours(views, view, normal, ys, xs, zs, shape, surf):
    """Vertex colour (linear RGB, 8 bit) + night glow + shading normal index for faces
    looking along `normal` (see face_view)."""
    pick, nidx = face_view(view, normal, ys, xs, zs, surf)
    c = np.empty((len(ys), 4), np.uint8)
    e = np.empty((len(ys), 4), np.uint8)
    for v in 'fst':
        sel = pick == v
        if sel.any():
            rgb, em = views[v]
            c[sel] = np.broadcast_to(rgb, shape + (4,))[ys[sel], xs[sel], zs[sel]]
            e[sel] = np.broadcast_to(em, shape + (4,))[ys[sel], xs[sel], zs[sel]]
    # Faces that face the view through a hole in it (alpha 0) borrow the front colour.
    miss = c[:, 3] < 128
    if miss.any():
        fc = np.broadcast_to(views['f'][0], shape + (4,))[ys, xs, zs]
        c[miss] = fc[miss]
    lin = srgb_to_linear(c[:, :3].astype(np.float32))
    if normal == (0, -1, 0):
        lin = lin * 0.5
    glow = e[:, :3].max(1).astype(np.float32) / 255.0
    rgba = np.concatenate([np.round(np.clip(lin, 0, 1) * 255), np.round(glow[:, None] * 255)], 1)
    return np.concatenate([rgba, nidx[:, None]], 1).astype(np.uint8)


def build(name):
    global VIEW_PARTS
    fa, sa, ta = load(name, 'front'), load(name, 'side'), load(name, 'top')
    if ta is None and load(name, 'roof') is not None and load(name, 'top') is None and load(name, 'rear') is not None:
        # Vehicle sheet (side, front, rear, roof): parked along X with its nose to -X, the
        # camera sees the long side from -Z and the nose from -X.
        VIEW_PARTS = ('side', 'front', 'roof')
    elif ta is None and load(name, 'roof') is not None and (load(name, 'end') is not None or name.startswith('city_train')):
        # Train car sheet (side, front cab or end, roof): long axis along X like a vehicle.
        VIEW_PARTS = ('side', 'end' if load(name, 'end') is not None else 'front', 'roof')
    else:
        VIEW_PARTS = ('front', 'side', 'top')
    fa, sa, ta = load(name, VIEW_PARTS[0]), load(name, VIEW_PARTS[1]), load(name, VIEW_PARTS[2])
    if fa is None or sa is None:
        print(f'{name}: needs _front and _side')
        return False
    fe, se = load(name, VIEW_PARTS[0], 'emission'), load(name, VIEW_PARTS[1], 'emission')
    te = load(name, VIEW_PARTS[2], 'emission')
    H, W = fa.shape[:2]
    D = sa.shape[1]
    # Big pieces (station, train) keep their colours in textures sampled by the shader, so
    # the mesh only needs the shape and merges into far fewer quads.
    textured = W * H * D > MAX_VOXELS or name in TEXTURED_NAMES
    sa = resize(sa, D, H)
    se = resize(se, D, H) if se is not None else None
    F = fa[..., 3] > 127

    # Side: as drawn, or mirrored. Top: any of 8 orientations (absent = full footprint).
    best = None
    sides = [('side', sa, se), ('side_m', sa[:, ::-1], se[:, ::-1] if se is not None else None)]
    tops = [('none', np.full((D, W, 4), 255, np.uint8), None)]
    if ta is not None:
        tops = []
        for (lab, t), (_, e) in zip(dihedral(ta), dihedral(te if te is not None else np.zeros_like(ta))):
            tops.append((lab, resize(t, W, D), resize(e, W, D)))
    for sl, s_img, s_em in sides:
        S = s_img[..., 3] > 127
        for tl, t_img, t_em in tops:
            T = t_img[..., 3] > 127
            occ = carve(F, S, T)
            sc = score(occ, F, S, T)
            if best is None or sc > best[0]:
                best = (sc, sl, tl, occ, s_img, s_em, t_img, t_em)
    sc, sl, tl, occ, s_img, s_em, t_img, t_em = best

    # Colour per voxel per view, indexed [y, x, z].
    def front_rgb(img):
        return img[::-1, ::-1][:, :, None, :]                 # [y, x, 1, 4]
    def side_rgb(img):
        return img[::-1, :][:, None, :, :]                    # [y, 1, z, 4]
    def top_rgb(img):
        return img.transpose(1, 0, 2)[None, :, :, :]           # [1, x, z, 4]
    zero = np.zeros_like(fa)
    views = {
        'f': (front_rgb(fa), front_rgb(fe if fe is not None else zero)),
        's': (side_rgb(s_img), side_rgb(s_em if s_em is not None else np.zeros_like(s_img))),
        't': (top_rgb(t_img), top_rgb(t_em if t_em is not None else np.zeros_like(t_img))),
    }

    Y, X, Z = occ.shape
    pad = np.pad(occ, 1)
    surf = surface(occ)
    # (normal, neighbour offset in [y, x, z], view)
    dirs = [((0, 0, -1), (0, 0, -1), 'f'), ((0, 0, 1), (0, 0, 1), 'f'),
            ((-1, 0, 0), (0, -1, 0), 's'), ((1, 0, 0), (0, 1, 0), 's'),
            ((0, 1, 0), (1, 0, 0), 't'), ((0, -1, 0), (-1, 0, 0), 'f')]
    pos, nor, col, idx = [], [], [], []
    ox, oz = X / 2.0, Z / 2.0
    for normal, (dy, dx, dz), view in dirs:
        nb = pad[1 + dy:1 + dy + Y, 1 + dx:1 + dx + X, 1 + dz:1 + dz + Z]
        exposed = occ & ~nb
        ys, xs, zs = np.nonzero(exposed)
        if len(ys) == 0:
            continue
        n = np.array(normal, np.float32)
        if textured:
            # Colour comes from the textures (Toon.voxel_tex); the vertex colour only says
            # which view: r = side, g = top, neither = front (0/255 only, so the importer's
            # colour-space conversion can't shift it). NORMAL lights it.
            pick, nidx = face_view(view, normal, ys, xs, zs, surf)
            cq = np.zeros((len(ys), 5), np.uint8)
            cq[:, 0] = np.where(pick == 's', 255, 0)
            cq[:, 1] = np.where(pick == 't', 255, 0)
            cq[:, 4] = nidx
        else:
            cq = face_colours(views, view, normal, ys, xs, zs, (Y, X, Z), surf)
        ax = [i for i in range(3) if normal[i] == 0]
        a, b = ax
        k = [i for i in range(3) if normal[i] != 0][0]
        vox = np.stack([xs, ys, zs], 1)
        # Merge runs of same-coloured faces along axis a (fewer quads, smaller file).
        order = np.lexsort((vox[:, a], vox[:, b], vox[:, k]))
        vox, cq = vox[order], cq[order]
        new_run = np.ones(len(vox), bool)
        new_run[1:] = ((vox[1:, k] != vox[:-1, k]) | (vox[1:, b] != vox[:-1, b])
                       | (vox[1:, a] != vox[:-1, a] + 1) | (cq[1:] != cq[:-1]).any(1))
        starts = np.nonzero(new_run)[0]
        lengths = np.diff(np.append(starts, len(vox)))
        vox, cq = vox[starts], cq[starts]
        # Then stack identical runs (same start, length, colour) in consecutive rows along b.
        cid = cq.astype(np.int64) @ np.array([1 << 32, 1 << 24, 1 << 16, 1 << 8, 1], np.int64)
        order = np.lexsort((vox[:, b], cid, lengths, vox[:, a], vox[:, k]))
        vox, cq, lengths, cid = vox[order], cq[order], lengths[order], cid[order]
        new_row = np.ones(len(vox), bool)
        new_row[1:] = ((vox[1:, k] != vox[:-1, k]) | (vox[1:, a] != vox[:-1, a]) | (lengths[1:] != lengths[:-1])
                       | (cid[1:] != cid[:-1]) | (vox[1:, b] != vox[:-1, b] + 1))
        starts = np.nonzero(new_row)[0]
        heights = np.diff(np.append(starts, len(vox)))
        vox, cq, lengths = vox[starts], cq[starts], lengths[starts]
        base = vox.astype(np.float32)
        base[:, k] += 1.0 if normal[k] > 0 else 0.0
        corners = []
        for da, db in ((0, 0), (1, 0), (1, 1), (0, 1)):
            p = base.copy()
            p[:, a] += da * lengths
            p[:, b] += db * heights
            corners.append(p)
        v0 = sum(len(p) for p in pos)
        quad = np.stack(corners, 1)                              # [n, 4, 3]
        # Winding: counter-clockwise seen from outside.
        e1 = quad[0, 1] - quad[0, 0]
        e2 = quad[0, 2] - quad[0, 0]
        flip = np.dot(np.cross(e1, e2), n) < 0
        quad = quad.reshape(-1, 3)
        world = np.empty_like(quad)
        world[:, 0] = (quad[:, 0] - ox) / PPM
        world[:, 1] = quad[:, 1] / PPM
        world[:, 2] = (quad[:, 2] - oz) / PPM
        pos.append(world)
        nor.append(np.repeat(np.array(NORMALS, np.float32)[cq[:, 4]], 4, 0))
        col.append(np.repeat(cq[:, :4], 4, 0))
        base_i = v0 + np.arange(len(vox)) * 4
        tri = [0, 2, 1, 0, 3, 2] if flip else [0, 1, 2, 0, 2, 3]
        idx.append((base_i[:, None] + np.array(tri)[None]).reshape(-1))
    P = np.concatenate(pos).astype(np.float32)
    N = np.concatenate(nor).astype(np.float32)
    C = np.concatenate(col).astype(np.uint8)
    I = np.concatenate(idx)
    I = I.astype(np.uint16) if I.max() < 65536 else I.astype(np.uint32)
    OUT.mkdir(parents=True, exist_ok=True)
    write_glb(OUT / f'{name}.glb', P, N, C, I, name)
    if textured:
        # The views as the shader reads them (Toon.voxel_tex): front as drawn, the side and
        # top in the orientation that carved best, top resized to W x D.
        for part, img in (('front', fa), ('side', s_img), ('top', t_img)):
            Image.fromarray(img).save(OUT / f'{name}_vx_{part}_albedo.png')
        for part, img in (('front', fe), ('side', s_em), ('top', t_em)):
            ref = {'front': fa, 'side': s_img, 'top': t_img}[part]
            Image.fromarray(img if img is not None else np.zeros_like(ref)).save(OUT / f'{name}_vx_{part}_emission.png')
        (OUT / f'{name}.vx.json').write_text(json.dumps({'w': W, 'h': H, 'd': D}))
    else:
        for f in OUT.glob(f'{name}_vx_*.png'):
            f.unlink()
        (OUT / f'{name}.vx.json').unlink(missing_ok=True)
    print(f'{name}: {W}x{H}x{D} voxels, {int(occ.sum())} solid, {len(I) // 6} faces, '
          f'side {sl}, top {tl}, fit {sc:.2f}/3')
    return True


def write_glb(path, P, N, C, I, name):
    blobs, views, accessors = [], [], []

    def add(arr, target, comp, typ, minmax=False, normalized=False):
        off = sum(len(b) for b in blobs)
        data = arr.tobytes()
        data += b'\0' * (-len(data) % 4)
        blobs.append(data)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes, 'target': target})
        acc = {'bufferView': len(views) - 1, 'componentType': comp, 'count': len(arr), 'type': typ}
        if normalized:
            acc['normalized'] = True
        if minmax:
            acc['min'] = arr.min(0).tolist()
            acc['max'] = arr.max(0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    p = add(P, 34962, 5126, 'VEC3', True)
    n = add(N, 34962, 5126, 'VEC3')
    c = add(C, 34962, 5121, 'VEC4', normalized=True)
    i = add(I, 34963, 5123 if I.dtype == np.uint16 else 5125, 'SCALAR')
    gltf = {
        'asset': {'version': '2.0', 'generator': 'voxel_from_views'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': name}],
        'meshes': [{'name': name, 'primitives': [{'attributes': {'POSITION': p, 'NORMAL': n, 'COLOR_0': c}, 'indices': i}]}],
        'buffers': [{'byteLength': sum(len(b) for b in blobs)}],
        'bufferViews': views, 'accessors': accessors,
    }
    js = json.dumps(gltf).encode()
    js += b' ' * (-len(js) % 4)
    bin_ = b''.join(blobs)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942) + bin_)


def main():
    names = sys.argv[1:]
    if names == ['--all']:
        # Props, vehicles, train cars and the station pieces. Big ones go to textured mode.
        # Buildings (front/side/roof, no top) stay as textured boxes in SiamCity.building.
        def has(n, part):
            return (TEX / f'{n}_{part}_albedo.png').exists()
        stems = {p.name.rsplit('_', 2)[0] for p in TEX.glob('city_*_side_albedo.png')}
        names = sorted(n for n in stems if has(n, 'top') or (has(n, 'roof') and (has(n, 'rear') or has(n, 'end') or n.startswith('city_train'))))
    for n in names:
        build(n)


if __name__ == '__main__':
    main()
