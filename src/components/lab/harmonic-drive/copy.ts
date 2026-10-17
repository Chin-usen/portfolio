export type HarmonicLocale = 'zh' | 'en';
export type HarmonicStage = 'whole' | 'mechanism';
export const HARMONIC_TIME_FACTOR = 1 / 60;
export const harmonicCopy = {
  zh: {
    kicker: 'L4 · 机械传动拆解',
    title: '谐波减速器',
    subtitle: '旋转的椭圆带动柔轮变形；两齿之差，让输出缓慢反转。',
    back: '返回实验室',
    stage: '谐波减速器三维示意',
    modes: '视图选择',
    whole: '整体',
    mechanism: '传动核心',
    wholeCaption: '整体：输入轴 → 波发生器与柔性轴承 → 杯形柔轮 → 输出法兰',
    mechanismCaption: '核心：刚轮固定，两个长轴啮合区域随波发生器旋转，柔轮缓慢反转',
    reset: '重置视角',
    hint: '拖动旋转 · 滚轮缩放 · 选择零件查看详情',
    loading: '正在准备三维视图；参数计算、相位示意和零件说明已可使用。',
    keyboardTitle: '键盘操作',
    keyboard: '方向键旋转，加减键缩放，Home 重置视角。按 Tab 和 Enter 选择零件；滑杆支持方向键。',
    parts: '选择零件',
    selected: '当前零件',
    role: '作用',
    features: '结构特点',
    material: '示例材料',
    noJs: '静态示意。下方保留全部零件说明和默认计算；启用 JavaScript 后可编辑参数。',
    allParts: '全部零件',
    staticMode: '爆炸图保留默认 200 / 202 齿；下方相位示意与读数跟随编辑',
    fallback: '静态模式。',
    fallbackReason: '遵循减少动态效果或设备资源设置；计算、手动相位和零件说明仍可使用。',
    loadFailure: '三维视图不可用；计算、手动相位和零件说明仍可使用。',
    staticAlt:
      '通用谐波减速器爆炸示意，包含杯形柔轮、椭圆波发生器、柔性轴承、刚轮、交叉滚子轴承和输出法兰。',
    explode: '轴向分离',
    assembled: '装配',
    exploded: '爆炸',
    motion: '输入与输出',
    play: '播放',
    pause: '暂停',
    speed: '输入转速',
    speedError: '请输入 0–3000 rpm 范围内的整数。结果仍使用上一有效转速 {rpm} rpm。',
    outputSpeed: '输出转速',
    playback: '动画时间倍率',
    slowNote: '动画按真实时间的 1/60 播放；读数保留真实轴速。负号表示反向。',
    displayedSpeed: '屏幕输入转速',
    phase: '输入相位',
    outputPhase: '输出角度',
    calculation: '减速比',
    flexTeeth: '柔轮齿数 zf',
    circularTeeth: '刚轮齿数 zc',
    toothRange: '80–240 · 偶数',
    fixedModule: '固定模数 m',
    defaults: '恢复默认',
    pending: '编辑偶数齿数，刚轮保持多 2 齿；计算与几何自动更新。',
    applied: '参数已应用，三维几何与相位示意已更新。',
    appliedStatic: '计算与相位示意已更新；爆炸图保留默认齿数。',
    invalid: '请输入 80–240 范围内的偶数齿数。仍保留上一有效结果。',
    rebuildError: '无法生成新几何，仍保留上一有效结果。',
    deformation: '名义径向变形 w₀',
    displayedDeformation: '示意位移 ×4',
    deformationNote: '视觉放大 ×4 只作用于形状，名义变形与减速比计算不变。',
    modelScope: '刚轮固定 · 柔轮输出 · 通用运动学示意',
    stageNote:
      '杯口变形放大 ×4，杯底随输出旋转。高亮表示两处长轴啮合方向；示意齿形与径向显示间隙不代表真实接触。',
    diagram: '端面相位示意',
    staticSeparation: '二维轴向分离示意',
    staticSeparationAlt: '九个部件的简化轴向分层示意；间距随分离滑杆变化，高亮跟随当前零件。',
    diagramAlt:
      '端面示意：固定刚轮内，椭圆变形与两个长轴啮合区域随输入转动；输出标记反向缓慢旋转。',
    engagement: '两个长轴啮合区',
    outputMarker: '柔轮输出标记',
    diagramNote: '手动拖动相位，观察啮合方向与输出角度。',
    assumptions: '模型与公式边界',
    ratioText:
      '刚轮固定、波发生器输入、柔轮输出：i = n输入 / n输出 = −zf / (zc − zf)。默认 200 / 202 齿，i = −100；输入转一圈，输出反转 3.6°。',
    deformationText:
      '名义节圆半径 rf = m zf / 2，rc = m zc / 2；w₀ = rc − rf = m (zc − zf) / 2。固定 m = 0.5 mm、齿差 2，故 w₀ = 0.5 mm；画面显示 4w₀ = 2 mm。',
    geometryText:
      '杯口采用双波径向变形，沿杯深逐渐减弱至杯底。椭圆波发生器与柔性轴承为参数化示意，柔轮齿位随输出旋转；几何不构成共轭齿面或弹性有限元解。',
    clearanceText:
      '放大位移时，刚轮加入径向显示偏移与间隙以便观察。高亮仅标识两处啮合方向，不能用于判断齿面穿透、接触压力或装配公差。',
    limitsText:
      '不计算载荷、应力、回差、效率、润滑或寿命；材料仅为通用占位示例，不对应厂商、牌号、热处理或制造规范。',
    sources: '原理参考',
    principleSource: 'Harmonic Drive：应变波传动原理',
    provenance:
      '原创参数化通用示意；未复刻厂商 CAD，未使用厂商几何或材料数据。交互模型与静态 GLB 由同一生成器生成；原理链接仅用于说明运动关系。',
  },
  en: {
    kicker: 'L4 · MECHANISM STUDY',
    title: 'Harmonic drive',
    subtitle:
      'A rotating ellipse flexes the cup. A two-tooth difference turns the output slowly in reverse.',
    back: 'Back to lab',
    stage: 'Schematic harmonic drive in three dimensions',
    modes: 'View selection',
    whole: 'Assembly',
    mechanism: 'Mechanism',
    wholeCaption:
      'Assembly: input shaft → wave generator and flexible bearing → cup flexspline → output flange',
    mechanismCaption:
      'Mechanism: a fixed circular spline, two rotating major-axis engagement zones and slow reverse output',
    reset: 'Reset view',
    hint: 'Drag to orbit · Scroll to zoom · Select a part for its details',
    loading:
      'Preparing the 3D view. Calculations, the phase diagram and part details are available.',
    keyboardTitle: 'Keyboard controls',
    keyboard:
      'Arrow keys orbit, plus and minus zoom, Home resets. Use Tab and Enter to select parts; arrow keys adjust sliders.',
    parts: 'Select a part',
    selected: 'Selected part',
    role: 'Role',
    features: 'Features',
    material: 'Example material',
    noJs: 'Static schematic. All part details and default calculations remain below; enable JavaScript to edit parameters.',
    allParts: 'All parts',
    staticMode:
      'The exploded image retains 200 / 202 teeth; the phase diagram and readings follow edits',
    fallback: 'Static mode.',
    fallbackReason:
      'Respecting reduced motion or device resources; calculations, manual phase and part details remain available.',
    loadFailure:
      'The 3D view is unavailable; calculations, manual phase and part details remain available.',
    staticAlt:
      'Exploded generic harmonic drive with a cup flexspline, elliptical wave generator, flexible bearing, circular spline, cross-roller bearing and output flange.',
    explode: 'Axial separation',
    assembled: 'Assembled',
    exploded: 'Exploded',
    motion: 'Input and output',
    play: 'Play',
    pause: 'Pause',
    speed: 'Input speed',
    speedError:
      'Enter a whole number from 0 to 3000 rpm. Results still use the last valid speed of {rpm} rpm.',
    outputSpeed: 'Output speed',
    playback: 'Animation time',
    slowNote:
      'Animation runs at 1/60 of real speed; readings retain real shaft speeds. A minus sign means reverse rotation.',
    displayedSpeed: 'On-screen input speed',
    phase: 'Input phase',
    outputPhase: 'Output angle',
    calculation: 'Reduction ratio',
    flexTeeth: 'Flexspline teeth zf',
    circularTeeth: 'Circular spline teeth zc',
    toothRange: '80–240 · even',
    fixedModule: 'Fixed module m',
    defaults: 'Restore defaults',
    pending:
      'Edit an even tooth count. The circular spline retains two extra teeth; calculations and geometry update automatically.',
    applied: 'Parameters applied; the 3D geometry and phase diagram have updated.',
    appliedStatic:
      'Calculations and the phase diagram updated; the exploded image retains default teeth.',
    invalid: 'Enter an even tooth count from 80 to 240. The last valid result is retained.',
    rebuildError: 'The new geometry could not be built. The last valid result is retained.',
    deformation: 'Nominal radial deflection w₀',
    displayedDeformation: 'Display displacement ×4',
    deformationNote:
      'The ×4 magnification affects the shape only. Nominal deflection and the ratio remain unchanged.',
    modelScope: 'Fixed circular spline · flexspline output · generic kinematic schematic',
    stageNote:
      'Cup-mouth deflection is magnified ×4; the cup base follows the output. Highlights indicate two major-axis engagement directions. Schematic teeth and radial display clearance do not represent solved contact.',
    diagram: 'End-view phase diagram',
    staticSeparation: '2D schematic separation',
    staticSeparationAlt:
      'Nine simplified component layers. Spacing follows the separation slider; the selected part is highlighted.',
    diagramAlt:
      'End view: the ellipse and two major-axis engagement zones rotate inside the fixed circular spline; the flexspline output marker rotates slowly in reverse.',
    engagement: 'Two major-axis engagement zones',
    outputMarker: 'Flexspline output marker',
    diagramNote: 'Adjust the phase to compare engagement direction and output angle.',
    assumptions: 'Model and equation limits',
    ratioText:
      'With the circular spline fixed, wave-generator input and flexspline output: i = ninput / noutput = −zf / (zc − zf). The default 200 / 202 teeth give i = −100: one input turn produces −3.6° of output.',
    deformationText:
      'Nominal pitch radii are rf = m zf / 2 and rc = m zc / 2; w₀ = rc − rf = m (zc − zf) / 2. Fixed m = 0.5 mm and a two-tooth difference give w₀ = 0.5 mm. The display uses 4w₀ = 2 mm.',
    geometryText:
      'The cup-mouth profile has two radial waves, tapering toward the base. The elliptical wave generator and flexible bearing are schematic; tooth positions follow output rotation. This is neither a conjugate tooth surface nor an elastic finite-element solution.',
    clearanceText:
      'The magnified view adds radial offset and clearance to the circular spline for visibility. Highlighted zones indicate engagement directions only; they cannot establish tooth interference, contact pressure or assembly tolerance.',
    limitsText:
      'Loads, stress, backlash, efficiency, lubrication and life are not calculated. Materials are generic placeholders, with no vendor, grade, heat-treatment or manufacturing specification implied.',
    sources: 'Principle reference',
    principleSource: 'Harmonic Drive: strain-wave operating principle',
    provenance:
      'Original generic parametric schematic. No vendor CAD, geometry or material data is reproduced. Interactive geometry and the static GLB share one generator; the reference explains the motion only.',
  },
} as const;
export function harmonicModes(locale: HarmonicLocale) {
  const copy = harmonicCopy[locale];
  return (['whole', 'mechanism'] as const).map((id) => ({
    id,
    label: copy[id],
    caption: copy[`${id}Caption`],
    showLabels: true,
  }));
}
