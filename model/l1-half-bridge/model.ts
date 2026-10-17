import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import defaults from './params.json' with { type: 'json' };

export type Parameters = typeof defaults;
export type Point = [number, number, number];
export type Bounds = [Point, Point];
export type PartId = keyof Parameters['explodeOffsetsMm'];
export type ContactBox = { center: Point; size: Point };
export type Part = {
  name: string;
  partId: PartId;
  material: string;
  net: string | null;
  circuitNode: string;
  explodeZmm: number;
  gapMotion?: number;
  gapScale?: boolean;
  boundsMm: Bounds;
  boxes: ContactBox[];
  wirePoints?: Point[];
  radiusMm?: number;
  drainNet?: string;
  sourceNet?: string;
  gateNet?: string;
  arm?: string;
  integratedBodyDiode?: boolean;
  mesh: Mesh;
};
const palette = {
  copper: { color: 0xa66337, metalness: 0.65, roughness: 0.35 },
  nickel: { color: 0xb1bac3, metalness: 0.65, roughness: 0.31 },
  ceramic: { color: 0xe9e9df, metalness: 0, roughness: 0.78 },
  silicon: { color: 0x26323c, metalness: 0.25, roughness: 0.48 },
  solder: { color: 0x90989e, metalness: 0.5, roughness: 0.53 },
  aluminium: { color: 0xd1d6d9, metalness: 0.65, roughness: 0.3 },
  polyimide: { color: 0xdca23e, metalness: 0, roughness: 0.56 },
  pps: {
    color: 0x4c6067,
    metalness: 0,
    roughness: 0.54,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  },
};
type MaterialName = keyof typeof palette;
export function layerLevels(p: Parameters) {
  const solder = p.baseThickness;
  const bottomCopper = solder + p.ambSolderThickness;
  const ceramic = bottomCopper + p.bottomCopperThickness;
  const topCopper = ceramic + p.ceramicThickness;
  const dieAttach = topCopper + p.topCopperThickness;
  const die = dieAttach + p.dieAttachThickness;
  const pad = die + p.dieThickness;
  return { solder, bottomCopper, ceramic, topCopper, dieAttach, die, pad };
}
function requireCondition(value: boolean, message: string): asserts value {
  if (!value) throw new Error(message);
}
export function validateParameters(p: Parameters) {
  for (const [key, value] of Object.entries(p))
    if (typeof value === 'number')
      requireCondition(Number.isFinite(value), `Finite parameter: ${key}`);
  for (const key of [
    'baseLength',
    'baseWidth',
    'baseThickness',
    'dieLength',
    'dieWidth',
    'dieThickness',
    'gateWireDiameter',
    'busbarGap',
    'busbarThickness',
    'ambLength',
    'ambWidth',
  ] as const)
    requireCondition(p[key] > 0, `Positive dimension: ${key}`);
  requireCondition(p.units === 'mm', 'Source dimensions are millimetres');
  requireCondition(p.chipCentersY.length === 4, 'Four dies per arm');
  const ys = [...p.chipCentersY].sort((a, b) => a - b);
  requireCondition(
    ys.every((y, i) => !i || y - ys[i - 1]! > p.dieWidth),
    'Dies must not overlap',
  );
  requireCondition(p.ambLength < 2 * p.armCenterX, 'AMB tiles must not overlap');
  requireCondition(
    p.armCenterX + p.ambLength / 2 < p.housingInnerLength / 2 && p.ambWidth < p.housingInnerWidth,
    'AMB inside housing',
  );
  const gateRight = p.gateTraceOffsetX + p.signalTraceWidth / 2;
  const kelvinLeft = p.kelvinTraceOffsetX - p.signalTraceWidth / 2;
  const kelvinRight = p.kelvinTraceOffsetX + p.signalTraceWidth / 2;
  requireCondition(
    gateRight < kelvinLeft && kelvinRight < p.drainOffsetX - p.drainLength / 2,
    'Gate, Kelvin and drain copper separated',
  );
  requireCondition(
    p.gatePadOffsetX + p.gatePadLength / 2 < p.sourcePadOffsetX - p.sourcePadLength / 2,
    'Gate and source pads separated',
  );
  requireCondition(
    Math.abs(p.sourcePadOffsetX) + p.sourcePadLength / 2 <= p.dieLength / 2 &&
      p.sourcePadWidth <= p.dieWidth,
    'Source pad fits die',
  );
  requireCondition(
    Math.abs(p.gatePadOffsetX) + p.gatePadLength / 2 <= p.dieLength / 2 &&
      Math.abs(p.gatePadOffsetY) + p.gatePadWidth / 2 <= p.dieWidth / 2,
    'Gate pad fits die',
  );
  requireCondition(
    p.nRiseX - p.nRiseWidth / 2 > p.busbarLength / 2 + p.insulationEdgeMargin,
    'N riser outside P/dielectric edge',
  );
  requireCondition(
    p.signalPinY + p.signalPinDiameter / 2 < -p.busbarOverlapWidth / 2,
    'Signal pins outside laminate',
  );
  requireCondition(
    p.pFeedY + p.pFeedWidth / 2 < -p.collectorWidth / 2,
    'P feed outside SH source collector',
  );
  requireCondition(p.busbarGap >= 0.1 && p.busbarGap <= 2, 'Nominal insulation gap range');
  requireCondition(
    layerLevels(p).pad + p.padThickness < p.shCollectorBottom &&
      p.shCollectorBottom + p.collectorThickness < p.slCollectorBottom &&
      p.slCollectorBottom + p.collectorThickness < p.pBusbarBottom,
    'Separate power-routing levels',
  );
  requireCondition(
    p.mountingHoleCenterX + p.mountingHoleDiameter / 2 < p.baseLength / 2 &&
      p.mountingHoleCenterY + p.mountingHoleDiameter / 2 < p.baseWidth / 2,
    'Base holes inside outline',
  );
}
function box(x: number, y: number, z: number, dx: number, dy: number, dz: number) {
  return new BoxGeometry(dx, dy, dz).translate(x, y, z + dz / 2);
}
function contactBox(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
): ContactBox {
  return { center: [x, y, z + dz / 2], size: [dx, dy, dz] };
}
function rectangle(x: number, y: number, dx: number, dy: number) {
  const shape = new Shape();
  shape.moveTo(x - dx / 2, y - dy / 2);
  shape.lineTo(x + dx / 2, y - dy / 2);
  shape.lineTo(x + dx / 2, y + dy / 2);
  shape.lineTo(x - dx / 2, y + dy / 2);
  shape.closePath();
  return shape;
}
function holedPlate(
  x: number,
  y: number,
  z: number,
  dx: number,
  dy: number,
  dz: number,
  holes: { x: number; y: number; radius: number }[],
) {
  const shape = rectangle(x, y, dx, dy);
  for (const hole of holes) {
    const path = new Path();
    path.absarc(hole.x, hole.y, hole.radius, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  return new ExtrudeGeometry(shape, {
    depth: dz,
    bevelEnabled: false,
    curveSegments: 18,
  }).translate(0, 0, z);
}
function combine(geometries: BufferGeometry[]) {
  const normalized = geometries.map((geometry) => {
    const item = geometry.index ? geometry.toNonIndexed() : geometry;
    item.deleteAttribute('uv');
    return item;
  });
  const merged = mergeGeometries(normalized);
  requireCondition(merged !== null, 'Compatible component meshes');
  for (const geometry of new Set([...geometries, ...normalized])) geometry.dispose();
  return merged;
}
export function createModel(p: Parameters = defaults) {
  validateParameters(p);
  const scene = new Group();
  scene.name = 'generic-sic-half-bridge';
  const parts: Part[] = [];
  const levels = layerLevels(p);
  const materials = Object.fromEntries(
    Object.entries(palette).map(([name, props]) => {
      const material = new MeshStandardMaterial(props);
      material.name = name;
      return [name, material];
    }),
  ) as Record<MaterialName, MeshStandardMaterial>;
  function add(
    name: string,
    partId: PartId,
    geometry: BufferGeometry,
    material: MaterialName,
    net: string | null = null,
    circuitNode = net ?? 'none',
    extras: Partial<Part> = {},
  ) {
    geometry.deleteAttribute('uv');
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    const boundsMm: Bounds = [bounds.min.toArray() as Point, bounds.max.toArray() as Point];
    // Proper rotation: source (x,y,z) mm -> exported (x,z,-y) metres.
    geometry.rotateX(-Math.PI / 2).scale(0.001, 0.001, 0.001);
    geometry.deleteAttribute('uv');
    geometry.computeBoundingBox();
    const center = geometry.boundingBox!.getCenter(new Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    const mesh = new Mesh(geometry, materials[material]);
    mesh.name = name;
    mesh.position.copy(center);
    const part: Part = {
      name,
      partId,
      material,
      net,
      circuitNode,
      explodeZmm: p.explodeOffsetsMm[partId],
      boundsMm,
      boxes: [],
      ...extras,
      mesh,
    };
    const { mesh: _mesh, boxes: _boxes, wirePoints: _wirePoints, ...metadata } = part;
    mesh.userData = metadata;
    parts.push(part);
    scene.add(mesh);
    return part;
  }
  function addBox(
    name: string,
    partId: PartId,
    material: MaterialName,
    net: string | null,
    circuitNode: string | undefined,
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    extras: Partial<Part> = {},
  ) {
    return add(name, partId, box(x, y, z, dx, dy, dz), material, net, circuitNode, {
      boxes: [contactBox(x, y, z, dx, dy, dz)],
      ...extras,
    });
  }
  function addBoxes(
    name: string,
    partId: PartId,
    material: MaterialName,
    net: string,
    items: ContactBox[],
    extras: Partial<Part> = {},
  ) {
    return add(
      name,
      partId,
      combine(
        items.map(({ center: [x, y, z], size: [dx, dy, dz] }) => box(x, y, z - dz / 2, dx, dy, dz)),
      ),
      material,
      net,
      net,
      { boxes: items, ...extras },
    );
  }
  const holes = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => ({
      x: sx * p.mountingHoleCenterX,
      y: sy * p.mountingHoleCenterY,
      radius: p.mountingHoleDiameter / 2,
    })),
  );
  add(
    'baseplate-copper',
    'baseplate',
    holedPlate(0, 0, 0, p.baseLength, p.baseWidth, p.baseThickness, holes),
    'copper',
  );
  for (const arm of ['sh', 'sl'] as const) {
    const x = (arm === 'sh' ? -1 : 1) * p.armCenterX;
    const drainNet = arm === 'sh' ? 'p' : 'ac';
    const sourceNet = arm === 'sh' ? 'ac' : 'n';
    const gateNet = arm === 'sh' ? 'gate-h' : 'gate-l';
    const kelvinNet = arm === 'sh' ? 'kelvin-h' : 'kelvin-l';
    const clipTop = arm === 'sh' ? p.shCollectorBottom : p.slCollectorBottom;
    const inset = 2 * p.ambCopperEdgeInset;
    addBox(
      `amb-solder-${arm}`,
      'solder',
      'solder',
      null,
      undefined,
      x,
      0,
      levels.solder,
      p.ambLength - inset,
      p.ambWidth - inset,
      p.ambSolderThickness,
    );
    addBox(
      `amb-bottom-copper-${arm}`,
      'amb',
      'copper',
      null,
      undefined,
      x,
      0,
      levels.bottomCopper,
      p.ambLength - inset,
      p.ambWidth - inset,
      p.bottomCopperThickness,
    );
    addBox(
      `amb-ceramic-${arm}`,
      'amb',
      'ceramic',
      null,
      undefined,
      x,
      0,
      levels.ceramic,
      p.ambLength,
      p.ambWidth,
      p.ceramicThickness,
    );
    addBox(
      `amb-drain-${arm}`,
      'amb',
      'copper',
      drainNet,
      drainNet,
      x + p.drainOffsetX,
      0,
      levels.topCopper,
      p.drainLength,
      p.drainWidth,
      p.topCopperThickness,
    );
    for (const [label, offset, net] of [
      ['gate', p.gateTraceOffsetX, gateNet],
      ['kelvin', p.kelvinTraceOffsetX, kelvinNet],
    ] as const) {
      addBox(
        `amb-${label}-${arm}`,
        'amb',
        'copper',
        net,
        net,
        x + offset,
        0,
        levels.topCopper,
        p.signalTraceWidth,
        p.signalTraceLength,
        p.topCopperThickness,
      );
      const pin = new CylinderGeometry(
        p.signalPinDiameter / 2,
        p.signalPinDiameter / 2,
        p.signalPinHeight,
        16,
      )
        .rotateX(Math.PI / 2)
        .translate(x + offset, p.signalPinY, levels.dieAttach + p.signalPinHeight / 2);
      add(
        `signal-${label}-${arm}`,
        'signal-pin',
        pin,
        'nickel',
        net,
        label === 'gate' ? gateNet : sourceNet,
        {
          boxes: [
            contactBox(
              x + offset,
              p.signalPinY,
              levels.dieAttach,
              p.signalPinDiameter,
              p.signalPinDiameter,
              p.signalPinHeight,
            ),
          ],
        },
      );
    }
    p.chipCentersY.forEach((y, index) => {
      const id = `${arm}-${index + 1}`;
      addBox(
        `die-attach-${id}`,
        'solder',
        'solder',
        drainNet,
        drainNet,
        x,
        y,
        levels.dieAttach,
        p.dieLength,
        p.dieWidth,
        p.dieAttachThickness,
      );
      addBox(
        `mosfet-${id}`,
        'mosfet',
        'silicon',
        null,
        arm,
        x,
        y,
        levels.die,
        p.dieLength,
        p.dieWidth,
        p.dieThickness,
        { arm, drainNet, sourceNet, gateNet, integratedBodyDiode: true },
      );
      addBox(
        `source-pad-${id}`,
        'mosfet',
        'aluminium',
        sourceNet,
        arm,
        x + p.sourcePadOffsetX,
        y,
        levels.pad,
        p.sourcePadLength,
        p.sourcePadWidth,
        p.padThickness,
      );
      addBox(
        `gate-pad-${id}`,
        'mosfet',
        'aluminium',
        gateNet,
        arm,
        x + p.gatePadOffsetX,
        y + p.gatePadOffsetY,
        levels.pad,
        p.gatePadLength,
        p.gatePadWidth,
        p.padThickness,
      );
      addBox(
        `source-clip-${id}`,
        'busbar',
        'nickel',
        sourceNet,
        sourceNet,
        x + p.sourceClipOffsetX,
        y,
        levels.pad + p.padThickness,
        p.sourceClipLength,
        p.sourceClipWidth,
        clipTop - levels.pad - p.padThickness,
        { arm },
      );
      for (const [kind, net, sx, sy, ex, rise] of [
        ['gate', gateNet, p.gatePadOffsetX, p.gatePadOffsetY, p.gateTraceOffsetX, p.gateWireRise],
        [
          'kelvin',
          kelvinNet,
          p.kelvinBondOffsetX,
          p.kelvinBondOffsetY,
          p.kelvinTraceOffsetX,
          p.kelvinWireRise,
        ],
      ] as const) {
        const start = new Vector3(x + sx, y + sy, levels.pad + p.padThickness);
        const end = new Vector3(x + ex, y + sy, levels.dieAttach);
        const controls = [
          start,
          start
            .clone()
            .lerp(end, 0.28)
            .add(new Vector3(0, 0, rise)),
          start
            .clone()
            .lerp(end, 0.72)
            .add(new Vector3(0, 0, rise)),
          end,
        ];
        const curve = new CatmullRomCurve3(controls);
        const geometry = new TubeGeometry(curve, 28, p.gateWireDiameter / 2, 8, false);
        add(
          `${kind}-wire-${id}`,
          'gate-wire',
          geometry,
          'aluminium',
          net,
          kind === 'gate' ? gateNet : sourceNet,
          {
            radiusMm: p.gateWireDiameter / 2,
            wirePoints: curve.getPoints(56).map((point) => point.toArray() as Point),
          },
        );
      }
    });
  }
  const shX = -p.armCenterX + p.sourceClipOffsetX;
  const slX = p.armCenterX + p.sourceClipOffsetX;
  const acZ = p.shCollectorBottom;
  addBoxes('ac-source-drain-strap', 'ac-terminal', 'nickel', 'ac', [
    contactBox(shX, 0, acZ, p.collectorLength, p.collectorWidth, p.collectorThickness),
    contactBox(
      (shX + p.armCenterX) / 2,
      p.acBridgeY,
      acZ,
      p.armCenterX - shX + p.collectorLength,
      p.acBridgeWidth,
      p.collectorThickness,
    ),
    contactBox(
      p.armCenterX,
      p.acBridgeY,
      levels.dieAttach,
      p.acDrainFeedLength,
      p.acDrainFeedWidth,
      acZ + p.collectorThickness - levels.dieAttach,
    ),
  ]);
  const nBottom = p.pBusbarBottom + p.busbarThickness + p.busbarGap;
  addBoxes(
    'n-source-collector',
    'busbar',
    'nickel',
    'n',
    [
      contactBox(
        slX,
        0,
        p.slCollectorBottom,
        p.collectorLength,
        p.collectorWidth,
        p.collectorThickness,
      ),
      contactBox(
        (slX + p.nRiseX) / 2,
        p.nRiseY,
        p.slCollectorBottom,
        p.nRiseX - slX + p.nRiseWidth,
        p.nRiseDepth,
        p.collectorThickness,
      ),
      contactBox(
        p.nRiseX,
        p.nRiseY,
        p.slCollectorBottom,
        p.nRiseWidth,
        p.nRiseDepth,
        nBottom + p.busbarThickness - p.slCollectorBottom,
      ),
      contactBox(
        (p.nRiseX + p.nReturnX) / 2,
        p.nRiseY,
        nBottom,
        p.nRiseX - p.nReturnX + p.nRiseWidth,
        p.nRiseDepth,
        p.busbarThickness,
      ),
    ],
    { gapMotion: 1 },
  );
  const feedX = -p.armCenterX + p.pFeedOffsetX;
  addBoxes('p-drain-feed', 'busbar', 'nickel', 'p', [
    contactBox(
      feedX,
      p.pFeedY,
      levels.dieAttach,
      p.pFeedLength,
      p.pFeedWidth,
      p.pBusbarBottom + p.busbarThickness - levels.dieAttach,
    ),
    contactBox(feedX, p.pFeedY, p.pBusbarBottom, p.pFeedLength, p.pFootLengthY, p.busbarThickness),
  ]);
  addBox(
    'busbar-p',
    'busbar',
    'copper',
    'p',
    'p',
    0,
    0,
    p.pBusbarBottom,
    p.busbarLength,
    p.busbarOverlapWidth,
    p.busbarThickness,
    { gapMotion: 0 },
  );
  addBox(
    'busbar-insulation',
    'busbar',
    'polyimide',
    null,
    'none',
    0,
    0,
    p.pBusbarBottom + p.busbarThickness,
    p.busbarLength + 2 * p.insulationEdgeMargin,
    p.busbarOverlapWidth + 2 * p.insulationEdgeMargin,
    p.busbarGap,
    { gapMotion: 0.5, gapScale: true },
  );
  addBox(
    'busbar-n',
    'busbar',
    'copper',
    'n',
    'n',
    0,
    0,
    nBottom,
    p.busbarLength,
    p.busbarOverlapWidth,
    p.busbarThickness,
    { gapMotion: 1 },
  );
  function terminal(
    name: string,
    x: number,
    y0: number,
    z0: number,
    direction: number,
    group: PartId,
    net: string,
    motion = 0,
  ) {
    const endY = direction * p.terminalEndY;
    const thickness = p.terminalThickness;
    const footBox = contactBox(
      x,
      (y0 + endY) / 2,
      z0,
      p.terminalLength,
      Math.abs(endY - y0) + thickness,
      thickness,
    );
    const upright = holedPlate(
      0,
      p.terminalHeight / 2,
      0,
      p.terminalLength,
      p.terminalHeight,
      thickness,
      [{ x: 0, y: p.terminalHoleOffsetZ, radius: p.terminalHoleDiameter / 2 }],
    )
      .rotateX(Math.PI / 2)
      .translate(x, endY + thickness / 2, z0);
    add(
      name,
      group,
      combine([box(footBox.center[0], footBox.center[1], z0, ...footBox.size), upright]),
      'nickel',
      net,
      net,
      { boxes: [footBox], gapMotion: motion },
    );
  }
  terminal(
    'dc-terminal-p',
    -p.terminalX,
    p.terminalStartY,
    p.pBusbarBottom,
    -1,
    'dc-terminal',
    'p',
  );
  terminal('dc-terminal-n', p.terminalX, p.terminalStartY, nBottom, -1, 'dc-terminal', 'n', 1);
  terminal('ac-terminal-out', 0, p.acBridgeY, acZ, 1, 'ac-terminal', 'ac');
  // Frame pieces form one named mesh. Corner holes and terminal slots are actual open geometry.
  const frame: BufferGeometry[] = [];
  const wallX = (p.housingLength - p.housingInnerLength) / 2;
  const wallY = (p.housingWidth - p.housingInnerWidth) / 2;
  for (const sign of [-1, 1]) {
    frame.push(
      holedPlate(
        (sign * (p.housingLength + p.housingInnerLength)) / 4,
        0,
        p.housingBottom,
        wallX,
        p.housingWidth,
        p.housingHeight,
        holes.filter((hole) => Math.sign(hole.x) === sign),
      ),
    );
    const cuts = sign === -1 ? [-p.terminalX, p.terminalX] : [0];
    const floor = sign === -1 ? p.dcCutoutBottom : p.acCutoutBottom;
    const centerY = (sign * (p.housingWidth + p.housingInnerWidth)) / 4;
    frame.push(
      box(0, centerY, p.housingBottom, p.housingInnerLength, wallY, floor - p.housingBottom),
    );
    let left = -p.housingInnerLength / 2;
    for (const cut of [...cuts, p.housingInnerLength / 2 + p.terminalCutoutLength / 2]) {
      const right = cut - p.terminalCutoutLength / 2;
      if (right > left)
        frame.push(
          box(
            (left + right) / 2,
            centerY,
            floor,
            right - left,
            wallY,
            p.housingBottom + p.housingHeight - floor,
          ),
        );
      left = cut + p.terminalCutoutLength / 2;
    }
  }
  add('housing-pps-frame', 'housing', combine(frame), 'pps');
  scene.updateMatrixWorld(true);
  return { scene, parts, parameters: p };
}
export function disposeModel(model: ReturnType<typeof createModel>) {
  const materials = new Set<MeshStandardMaterial>();
  for (const part of model.parts) {
    part.mesh.geometry.dispose();
    materials.add(part.mesh.material as MeshStandardMaterial);
  }
  for (const material of materials) material.dispose();
}
