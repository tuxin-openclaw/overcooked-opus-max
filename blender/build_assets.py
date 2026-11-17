"""
Build the hero models of 手忙脚乱厨房 in Blender and export them for the game.

    blender -b -P blender/build_assets.py

Writes:
  public/models/kitchen.glb     every part as one object, named after the part
  public/models/manifest.json   the parts the game should swap in
  blender/kitchen.blend         the same scene, to edit by hand

The game swaps in each part it finds and keeps its built-in model for the
rest, so a missing or broken part never stops it from running.

Conventions (they match src/scene/*.tsx):
  * 1 Blender unit = 1 kitchen tile.
  * Pieces below are written in GAME space: Y up, +Z is the front.
    They are turned into Blender space (Z up, front = -Y) at the end, and the
    glTF exporter turns that back into Y up. So numbers can be copied
    straight from the .tsx files.
  * A part's origin is where the game puts it: the feet for the body, the
    centre of the head for faces and hats, the bottom for food and dishes.
  * A material named "team" is recoloured per chef (blue / red).
"""

import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, "public", "models")
GLB_NAME = "kitchen.glb"

# Same palette as src/scene/look.ts (sRGB hex).
COLORS = {
    "skin": "#f7c9a1",
    "hat": "#ffffff",
    "eye": "#2b2b33",
    "cheek": "#f39a8c",
    "nose": "#f0b08a",
    "hair": "#5a3a26",
    "team": "#3d7fe0",
    "apron": "#ffffff",
    "shoe": "#3b3030",
    "onion": "#d9a33f",
    "onion_dark": "#a8741f",
    "onion_light": "#f5e6b8",
    "tomato": "#e5432d",
    "tomato_light": "#ff9479",
    "leaf": "#4fae4f",
    "mush_cap": "#a3693f",
    "mush_stem": "#f1e3c9",
    "mush_gill": "#e2cba6",
    "pot": "#5b6470",
    "pot_dark": "#3a414b",
    "plate": "#fbfbf8",
    "plate_dirty": "#d9cfb6",
}

# (roughness, metallic) where it differs from (0.7, 0.0).
FINISH = {
    "eye": (0.3, 0.0),
    "onion": (0.55, 0.0),
    "tomato": (0.4, 0.0),
    "pot": (0.4, 0.2),
    "pot_dark": (0.5, 0.2),
    "plate": (0.3, 0.0),
}

# Game space (x, y up, z front) -> Blender space (x, -z, y). A proper rotation.
GAME_TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
# bmesh builds cylinders and cones along Z; this stands them up along game Y.
UP = Matrix.Rotation(-math.pi / 2, 4, "X")


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


_materials = {}


def material(name):
    if name in _materials:
        return _materials[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True  # Always on (and deprecated) in newer Blender.
    except AttributeError:
        pass
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rough, metal = FINISH.get(name, (0.7, 0.0))
    bsdf.inputs["Base Color"].default_value = rgba(COLORS[name])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m.diffuse_color = rgba(COLORS[name])
    _materials[name] = m
    return m


def xform(pos=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0)):
    """A game-space transform. `rot` uses three.js Euler 'XYZ' order."""
    r = Matrix.Rotation(rot[0], 4, "X") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[2], 4, "Z")
    s = Matrix.Diagonal((scale[0], scale[1], scale[2], 1))
    return Matrix.Translation(Vector(pos)) @ r @ s


class Part:
    """One exported object: pieces merged into one mesh, one slot per material."""

    def __init__(self, name, subsurf=0):
        self.name = name
        self.subsurf = subsurf
        self.bm = bmesh.new()
        self.slots = []

    def _finish(self, before, mat, smooth):
        if mat not in self.slots:
            self.slots.append(mat)
        idx = self.slots.index(mat)
        for f in self.bm.faces:
            if f not in before:
                f.material_index = idx
                f.smooth = smooth

    def sphere(self, mat, pos=(0, 0, 0), scale=1.0, rot=(0, 0, 0), deform=None, top_half=False, smooth=True):
        s = (scale,) * 3 if isinstance(scale, (int, float)) else scale
        before = set(self.bm.faces)
        ret = bmesh.ops.create_uvsphere(self.bm, u_segments=24, v_segments=16, radius=1.0, matrix=UP)
        verts = ret["verts"]
        if top_half:
            bmesh.ops.delete(self.bm, geom=[v for v in verts if v.co.y < -1e-4], context="VERTS")
            verts = [v for v in verts if v.is_valid]
        if deform:
            for v in verts:
                v.co = deform(v.co)
        bmesh.ops.transform(self.bm, matrix=xform(pos, s, rot), verts=verts)
        self._finish(before, mat, smooth)

    def cylinder(self, mat, pos=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0), top=1.0, smooth=True):
        before = set(self.bm.faces)
        bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            cap_tris=False,
            segments=24,
            radius1=1.0,
            radius2=top,
            depth=1.0,
            matrix=xform(pos, scale, rot) @ UP,
        )
        self._finish(before, mat, smooth)

    def cone(self, mat, pos=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0)):
        self.cylinder(mat, pos, scale, rot, top=0.0)

    def box(self, mat, size, pos=(0, 0, 0), rot=(0, 0, 0), radius=0.02):
        before = set(self.bm.faces)
        ret = bmesh.ops.create_cube(self.bm, size=1.0, matrix=xform(pos, size, rot))
        verts = ret["verts"]
        edges = list({e for v in verts for e in v.link_edges})
        r = min(radius, *(d / 2 - 1e-4 for d in size))
        if r > 0:
            bmesh.ops.bevel(self.bm, geom=verts + edges, offset=r, segments=3, profile=0.5, affect="EDGES")
        self._finish(before, mat, False)

    def lathe(self, mat, profile, segments=40):
        """Spin an (radius, height) profile around the game Y axis."""
        before = set(self.bm.faces)
        verts = [self.bm.verts.new((r, y, 0.0)) for r, y in profile]
        edges = [self.bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
        bmesh.ops.spin(
            self.bm,
            geom=verts + edges,
            cent=(0, 0, 0),
            axis=(0, 1, 0),
            angle=math.tau,
            steps=segments,
            use_merge=True,
            use_duplicate=False,
        )
        new_verts = [v for v in self.bm.verts if v.is_valid and not (set(v.link_faces) & before)]
        bmesh.ops.remove_doubles(self.bm, verts=new_verts, dist=1e-5)
        new_faces = [f for f in self.bm.faces if f not in before]
        bmesh.ops.dissolve_degenerate(self.bm, dist=1e-6, edges=list({e for f in new_faces for e in f.edges}))
        bmesh.ops.recalc_face_normals(self.bm, faces=[f for f in self.bm.faces if f not in before])
        self._finish(before, mat, True)

    def build(self, x_offset):
        bmesh.ops.transform(self.bm, matrix=GAME_TO_BLENDER, verts=self.bm.verts)
        self.bm.normal_update()
        me = bpy.data.meshes.new(self.name + "_mesh")
        self.bm.to_mesh(me)
        self.bm.free()
        for slot in self.slots:
            me.materials.append(material(slot))
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        # Spread parts out for viewing. The game ignores this offset.
        ob.location.x = x_offset
        if self.subsurf:
            mod = ob.modifiers.new("Subdivision", "SUBSURF")
            mod.levels = self.subsurf
            mod.render_levels = self.subsurf
        return ob


# ------------------------------------------------------------------ food


def onion_shape(co):
    """Unit sphere -> onion: a pointed top and a slightly flat base."""
    x, y, z = co
    if y > 0:
        taper = 1 - 0.55 * y**3
        return Vector((x * taper, y * 1.25, z * taper))
    return Vector((x, y * 0.92, z))


def onion():
    p = Part("onion", subsurf=1)
    p.sphere("onion", pos=(0, 0.16, 0), scale=(0.16, 0.16, 0.16), deform=onion_shape)
    p.cone("onion_dark", pos=(0, 0.37, 0), scale=(0.045, 0.1, 0.045))
    p.sphere("onion_light", pos=(0, 0.012, 0), scale=(0.06, 0.02, 0.06))
    return p


def tomato():
    p = Part("tomato", subsurf=1)
    p.sphere("tomato", pos=(0, 0.14, 0), scale=(0.17, 0.14, 0.17))
    for i in range(5):
        a = i / 5 * math.tau
        p.sphere("leaf", pos=(math.cos(a) * 0.055, 0.272, math.sin(a) * 0.055), scale=(0.065, 0.014, 0.026), rot=(0, -a, 0))
    p.cylinder("leaf", pos=(0, 0.3, 0), scale=(0.016, 0.07, 0.016))
    return p


def mushroom():
    p = Part("mushroom", subsurf=1)
    p.cylinder("mush_stem", pos=(0, 0.085, 0), scale=(0.065, 0.17, 0.065), top=0.85)
    p.sphere("mush_cap", pos=(0, 0.15, 0), scale=(0.17, 0.14, 0.17), top_half=True)
    p.cylinder("mush_gill", pos=(0, 0.15, 0), scale=(0.165, 0.012, 0.165))
    for x, y, z in ((0.06, 0.27, 0.06), (-0.08, 0.25, 0.02), (0.01, 0.27, -0.08)):
        p.sphere("mush_stem", pos=(x, y, z), scale=(0.028, 0.012, 0.028))
    return p


def onion_chopped():
    p = Part("onion_chopped")
    dice = ((-0.07, 0.02, 0.3), (0.05, -0.05, 1.1), (0.08, 0.06, 2.2), (-0.03, 0.08, 0.7), (0.0, -0.09, 1.7), (-0.09, -0.04, 2.6))
    for i, (x, z, r) in enumerate(dice):
        p.box(
            "onion_light" if i % 3 else "onion",
            (0.085, 0.055, 0.085),
            pos=(x, 0.028 + (i % 2) * 0.03, z),
            rot=(0, r, (i % 2) * 0.3),
            radius=0.02,
        )
    return p


SLICES = ((-0.08, 0.02), (0.0, -0.01), (0.08, 0.02))


def tomato_chopped():
    p = Part("tomato_chopped")
    for i, (x, z) in enumerate(SLICES):
        group = xform((x, 0.035 + i * 0.012, z), (1, 1, 1), (0.25, 0, 0.15 * (i - 1)))
        for mat, r, h in (("tomato", 0.1, 0.04), ("tomato_light", 0.082, 0.042)):
            before = set(p.bm.faces)
            bmesh.ops.create_cone(
                p.bm, cap_ends=True, cap_tris=False, segments=24, radius1=1.0, radius2=1.0, depth=1.0,
                matrix=group @ xform((0, 0, 0), (r, h, r)) @ UP,
            )
            p._finish(before, mat, True)
    return p


def mushroom_chopped():
    p = Part("mushroom_chopped")
    for i, (x, z) in enumerate(SLICES):
        group = xform((x, 0.025 + i * 0.01, z), (1, 1, 1), (-math.pi / 2, 0, 0.3 * (i - 1)))
        before = set(p.bm.faces)
        ret = bmesh.ops.create_uvsphere(p.bm, u_segments=24, v_segments=16, radius=1.0, matrix=UP)
        bmesh.ops.transform(p.bm, matrix=group @ xform((0, 0.03, 0), (0.11, 0.07, 0.025)), verts=ret["verts"])
        p._finish(before, "mush_cap", True)
        before = set(p.bm.faces)
        ret = bmesh.ops.create_cube(p.bm, size=1.0, matrix=group @ xform((0, -0.03, 0), (0.05, 0.08, 0.04)))
        p._finish(before, "mush_stem", False)
    return p


# --------------------------------------------------------------- dishes

POT_PROFILE = (
    (0, 0), (0.26, 0), (0.29, 0.02), (0.3, 0.3), (0.325, 0.31), (0.325, 0.335),
    (0.28, 0.335), (0.27, 0.32), (0.26, 0.05), (0, 0.05),
)

PLATE_PROFILE = (
    (0, 0), (0.2, 0), (0.27, 0.022), (0.31, 0.048), (0.32, 0.058),
    (0.3, 0.06), (0.26, 0.036), (0.2, 0.024), (0, 0.024),
)


def pot():
    p = Part("pot")
    p.lathe("pot", POT_PROFILE)
    for s in (1, -1):
        p.box("pot_dark", (0.14, 0.05, 0.08), pos=(s * 0.37, 0.27, 0), radius=0.02)
    return p


def plate(dirty=False):
    p = Part("plate_dirty" if dirty else "plate")
    p.lathe("plate_dirty" if dirty else "plate", PLATE_PROFILE)
    return p


# ---------------------------------------------------------------- chefs


def chef_body():
    p = Part("chef_body", subsurf=1)
    p.sphere("team", pos=(0, 0.5, 0), scale=(0.3, 0.34, 0.27))
    p.sphere("apron", pos=(0, 0.43, 0.1), scale=(0.22, 0.25, 0.2))
    p.cylinder("apron", pos=(0, 0.8, 0), scale=(0.2, 0.07, 0.2))
    for y in (0.56, 0.46):
        p.sphere("eye", pos=(0, y, 0.298), scale=0.022)
    return p


def face(p):
    p.sphere("skin", scale=(0.25, 0.24, 0.24))
    for s in (1, -1):
        p.sphere("eye", pos=(s * 0.085, 0.03, 0.212), scale=(0.032, 0.044, 0.02))
        p.sphere("hat", pos=(s * 0.085 + 0.01, 0.045, 0.228), scale=0.009)
    p.sphere("nose", pos=(0, -0.02, 0.24), scale=0.045)


def chef_head():
    p = Part("chef_head", subsurf=1)
    face(p)
    for s in (1, -1):
        p.sphere("hair", pos=(s * 0.05, -0.075, 0.222), scale=(0.068, 0.028, 0.035), rot=(0, 0, s * 0.35))
    return p


def chef_head_b():
    p = Part("chef_head_b", subsurf=1)
    face(p)
    for s in (1, -1):
        p.sphere("cheek", pos=(s * 0.15, -0.045, 0.175), scale=(0.042, 0.026, 0.02))
    p.sphere("hair", pos=(0, 0.05, -0.2), scale=(0.2, 0.16, 0.1))
    p.sphere("hair", pos=(0, 0.02, -0.3), scale=0.085)
    return p


def chef_hat():
    p = Part("chef_hat", subsurf=1)
    p.cylinder("hat", pos=(0, 0.25, 0), scale=(0.19, 0.13, 0.19))
    for x, y, z, r in ((0, 0.43, 0, 0.15), (0.1, 0.38, 0.03, 0.12), (-0.1, 0.38, 0.03, 0.12), (0, 0.38, -0.1, 0.12), (0, 0.37, 0.1, 0.11)):
        p.sphere("hat", pos=(x, y, z), scale=r)
    return p


def chef_hand():
    p = Part("chef_hand", subsurf=1)
    p.sphere("skin", scale=0.075)
    return p


def chef_foot():
    p = Part("chef_foot", subsurf=1)
    p.sphere("shoe", scale=(0.085, 0.055, 0.12))
    return p


BUILDERS = (
    onion, tomato, mushroom, onion_chopped, tomato_chopped, mushroom_chopped,
    pot, plate, lambda: plate(dirty=True),
    chef_body, chef_head, chef_head_b, chef_hat, chef_hand, chef_foot,
)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    names = []
    for i, build in enumerate(BUILDERS):
        part = build()
        ob = part.build(x_offset=i * 0.9)
        names.append(ob.name)

    os.makedirs(OUT_DIR, exist_ok=True)
    glb = os.path.join(OUT_DIR, GLB_NAME)
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", export_apply=True, export_yup=True)
    with open(os.path.join(OUT_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"file": GLB_NAME, "parts": names, "blender": bpy.app.version_string}, f, indent=2)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "kitchen.blend"))
    print(f"[build_assets] wrote {len(names)} parts to {glb}")


if __name__ == "__main__":
    main()
