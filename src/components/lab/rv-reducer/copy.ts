export type RvLocale = 'zh' | 'en';
export type RvStage = 'whole' | 'first' | 'second';
export const RV_TIME_FACTOR = 1 / 60;
export const rvCopy = {
  zh: {
    kicker: 'L3 · 机械传动拆解',
    title: 'RV 减速器',
    subtitle: '从渐开线齿轮到双摆线盘，看两级传动如何汇入同一输出架。',
    back: '返回实验室',
    stage: 'RV 减速器三维示意',
    modes: '传动级选择',
    whole: '整体',
    first: '第一级',
    second: '第二级',
    wholeCaption: '整体：输入轴 → 行星齿轮与曲轴 → 双摆线盘 → 输出法兰',
    firstCaption: '第一级：太阳轮驱动三个行星齿轮，行星轴随输出架公转',
    secondCaption: '第二级：偏心曲轴带动双摆线盘，与固定针齿圈啮合',
    reset: '重置视角',
    hint: '拖动旋转 · 滚轮缩放 · 选择零件查看详情',
    loading: '正在准备三维视图；参数计算和零件说明已可使用。',
    keyboard: '方向键旋转，加减键缩放，Home 重置视角。按 Tab 和 Enter 选择零件按钮。',
    parts: '选择零件',
    selected: '当前零件',
    role: '作用',
    features: '结构特点',
    material: '典型材料',
    noJs: '静态示意。下方保留全部零件说明和默认计算；启用 JavaScript 后可编辑参数。',
    allParts: '全部零件',
    staticMode: '静态图显示默认齿数的爆炸装配',
    fallback: '静态模式。',
    fallbackReason: '遵循减少动态效果或设备资源设置，计算和零件说明仍可使用。',
    loadFailure: '三维视图不可用，计算和零件说明仍可使用。',
    staticAlt:
      '通用 RV 减速器爆炸示意，包含太阳轮、三个行星齿轮和曲轴、双摆线盘、针齿圈及输出法兰。',
    explode: '轴向分离',
    assembled: '装配',
    exploded: '爆炸',
    motion: '传动运动',
    play: '播放',
    pause: '暂停',
    speed: '输入转速',
    speedError: '请输入 0–3000 rpm 范围内的整数。结果仍使用上一有效转速 {rpm} rpm。',
    outputSpeed: '输出转速',
    playback: '动画时间倍率',
    slowNote: '动画按真实时间的 1/60 播放，转速读数保留真实轴速。',
    displayedSpeed: '屏幕输入轴转速',
    phase: '输入轴相位',
    calculation: '减速比',
    inputGear: '太阳轮齿数 z₁',
    planetGear: '行星轮齿数 z₂',
    pinCount: '针齿数 zₚ',
    apply: '应用齿数',
    defaults: '恢复默认',
    pending: '编辑整数齿数，计算与几何自动同步更新。',
    applied: '参数已应用，三维几何已重建。',
    appliedStatic: '参数已应用；静态图仍显示默认齿数。',
    invalid: '该组合不满足齿廓、间隙或装配约束。请调整齿数；仍保留上一有效结果。',
    integerError: '请在标示范围内输入整数齿数。',
    rebuildError: '无法生成新几何，仍保留上一有效结果。',
    lobeCount: '摆线盘齿数 z꜀',
    modelScope: '固定针齿圈 · 输出架输出 · 理想刚体运动',
    stageNote: '分级视图隐藏其他部件，但保留两级耦合运动；第一级不是独立的固定架减速器。',
    assumptions: '模型与公式边界',
    ratioText:
      'i = n输入 / n输出 = 1 + (z₂ / z₁) zₚ，其中 z꜀ = zₚ − 1。默认 10 / 30 / 40 对应 121∶1。',
    geometryText:
      '轮廓为针齿中心轨迹的法向偏置。采用圆柱针齿、1.5 mm 偏心距和 82 mm 针齿圆半径。双盘偏心相位相差 π，第二盘轮廓另有 −π/z꜀ 分度修正；孔位相对输出架定位。',
    spurText:
      '第一级采用模数 2 mm、压力角 30° 的渐开线直齿。基圆以内以径向线段连接齿根，属于示意齿根，并非制造刀具包络。',
    contactText: '仅描述几何关系，不求解载荷分配、摩擦、应力、背隙、润滑或寿命；材料为通用示例。',
    formulaTitle: '摆线轮廓参数式（mm）',
    formulaTerms:
      't 为轮廓参数；R = 82，e = 1.5，rₚ = 3.5，u(t) = (cos t, sin t)。名义法向修形量为零。',
    formulaConstraint: '短幅系数 K₁ = e zₚ / R < 1；默认 K₁ = 60/82。针齿分布半径 R 即 Rₚ。',
    formulaPhase: '双盘中心 c₂ = −c₁；结构角均为 θ输出；第二盘轮廓角 θ₂ = θ输出 − π/z꜀。',
    sources: '原理参考',
    ratioSource: 'JAMDSM：RV 运动学与减速比（式 3）',
    gearSource: 'KHK：渐开线齿轮尺寸',
    provenance:
      '参数化示意模型，几何经简化；不复刻某一产品。交互几何与静态 GLB 使用同一参数生成器。',
  },
  en: {
    kicker: 'L3 · MECHANISM STUDY',
    title: 'RV reducer',
    subtitle: 'Follow the involute and cycloidal stages as they share one output carrier.',
    back: 'Back to lab',
    stage: 'Schematic RV reducer in three dimensions',
    modes: 'Transmission stage',
    whole: 'Assembly',
    first: 'First stage',
    second: 'Second stage',
    wholeCaption:
      'Assembly: input shaft → planet gears and cranks → paired cycloidal discs → output flange',
    firstCaption:
      'First stage: the sun drives three planet gears; their axes orbit with the output carrier',
    secondCaption: 'Second stage: eccentric cranks drive paired discs against the fixed pin ring',
    reset: 'Reset view',
    hint: 'Drag to orbit · Scroll to zoom · Select a part for its details',
    loading: 'Preparing the interactive view. Parameters and part details are already available.',
    keyboard:
      '3D canvas: arrow keys orbit, plus and minus zoom, Home resets the view. Use Tab and Enter to select part buttons.',
    parts: 'Select a part',
    selected: 'Selected part',
    role: 'Role',
    features: 'Features',
    material: 'Typical material',
    noJs: 'Static schematic. All part details and default calculations remain below; enable JavaScript to edit parameters.',
    allParts: 'All parts',
    staticMode: 'The static image shows the default exploded assembly',
    fallback: 'Static mode.',
    fallbackReason:
      'Respecting reduced motion or device resources; calculations and part details remain available.',
    loadFailure: 'The 3D view is unavailable; calculations and part details remain available.',
    staticAlt:
      'Exploded generic RV reducer with a sun gear, three planets and cranks, paired cycloidal discs, pin ring and output flange.',
    explode: 'Axial separation',
    assembled: 'Assembled',
    exploded: 'Exploded',
    motion: 'Transmission motion',
    play: 'Play',
    pause: 'Pause',
    speed: 'Input speed',
    speedError:
      'Enter a whole number from 0 to 3000 rpm. Results still use the last valid speed of {rpm} rpm.',
    outputSpeed: 'Output speed',
    playback: 'Animation time',
    slowNote:
      'Animation runs at 1/60 of real speed. Numeric readings retain the real shaft speeds.',
    displayedSpeed: 'On-screen input speed',
    phase: 'Input shaft phase',
    calculation: 'Reduction ratio',
    inputGear: 'Sun teeth z₁',
    planetGear: 'Planet teeth z₂',
    pinCount: 'Ring pins zₚ',
    apply: 'Apply tooth counts',
    defaults: 'Restore defaults',
    pending: 'Edit whole tooth counts to update the calculation and geometry automatically.',
    applied: 'Parameters applied; the 3D geometry has been rebuilt.',
    appliedStatic: 'Parameters applied; the static image retains the default tooth counts.',
    invalid:
      'This combination fails a tooth profile, clearance or assembly constraint. Adjust the counts; the last valid result is retained.',
    integerError: 'Enter whole tooth counts within the displayed ranges.',
    rebuildError: 'The new geometry could not be built. The last valid result is retained.',
    lobeCount: 'Disc lobes z꜀',
    modelScope: 'Fixed pin ring · output carrier · ideal rigid-body kinematics',
    stageNote:
      'Stage views hide other components but retain the coupled motion. The first stage is not treated as a separate fixed-carrier reducer.',
    assumptions: 'Model and equation limits',
    ratioText:
      'i = ninput / noutput = 1 + (z₂ / z₁) zₚ, with z꜀ = zₚ − 1. The default 10 / 30 / 40 combination gives 121:1.',
    geometryText:
      'The outline is a normal offset of the pin-centre locus, using cylindrical pins, 1.5 mm eccentricity and an 82 mm pin-circle radius. Disc eccentric phases differ by π; the second outline has an index correction of −π/z꜀. Hole locations remain indexed to the output carrier.',
    spurText:
      'The first stage uses 30° involute teeth at module 2 mm. Radial segments join the sub-base tooth roots; these are schematic roots, not a manufacturing cutter envelope.',
    contactText:
      'Geometry only: no load sharing, friction, stress, backlash, lubrication or life is solved. Materials are generic examples.',
    formulaTitle: 'Cycloidal outline parameterization (mm)',
    formulaTerms:
      't is the profile parameter; R = 82, e = 1.5, rₚ = 3.5 and u(t) = (cos t, sin t). Nominal normal relief is zero.',
    formulaConstraint:
      'Shortening coefficient K₁ = e zₚ / R < 1; the default is K₁ = 60/82. R is the pin-circle radius Rₚ.',
    formulaPhase:
      'Disc centres c₂ = −c₁; both structural angles are θoutput; the second outline angle is θ₂ = θoutput − π/z꜀.',
    sources: 'Principle references',
    ratioSource: 'JAMDSM: RV kinematics and reduction ratio (Equation 3)',
    gearSource: 'KHK: involute gear dimensions',
    provenance:
      'Parametric schematic model with simplified geometry; no specific product is reproduced. Interactive geometry and the static GLB share one parametric generator.',
  },
} as const;
export function rvModes(locale: RvLocale) {
  const copy = rvCopy[locale];
  return (['whole', 'first', 'second'] as const).map((id) => ({
    id,
    label: copy[id],
    caption: copy[`${id}Caption`],
    showLabels: true,
  }));
}
