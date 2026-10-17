import type { AclMode } from './params';
export type AclLocale = 'zh' | 'en';
export const aclCopy = {
  zh: {
    kicker: 'L2 · 3D 拆解',
    title: '车载镜头',
    subtitle: '沿光轴拆开镜筒、六片镜片与传感器模组，在截面光路中定位每一片镜片。',
    back: '返回实验台',
    stage: '通用六片式车载镜头模组三维拆解',
    modes: '视图选择',
    whole: '完整模组',
    optics: '光学元件',
    wholeCaption: '完整模组：压圈、镜片组、镜筒、镜座、滤光片、AA 胶层、传感器与 PCB 沿光轴展开。',
    opticsCaption: '光学元件：仅保留六片镜片、光阑、滤光片与传感器，按光路顺序排列。',
    reset: '重置视角',
    hint: '拖动旋转视角 · 滚轮缩放 · 点击零件查看说明',
    loading: '正在准备三维视图。零件说明、截面光路与近轴参数已可使用。',
    keyboardTitle: '键盘操作',
    keyboard:
      '方向键旋转视角，加减号缩放，Home 重置视角。Tab 切换零件按钮与截面中的光学元件，Enter 或空格选择；方向键调节分离滑块。',
    parts: '选择零件',
    selected: '当前零件',
    role: '作用',
    features: '特点',
    material: '常用材料',
    noJs: '当前为静态示意。下方保留全部零件说明、截面光路与近轴参数；启用 JavaScript 后可联动选择零件。',
    allParts: '全部零件',
    staticMode: '静态图片保持默认爆炸状态；截面光路与零件选择仍可联动',
    fallback: '静态模式。',
    fallbackReason: '遵循减少动态效果或设备资源设置；零件选择、截面光路与近轴参数仍可使用。',
    loadFailure: '三维视图暂不可用；零件选择、截面光路与近轴参数仍可使用。',
    staticAlt:
      '通用车载镜头模组沿光轴的爆炸示意：压圈、O 形圈、六片镜片与隔圈、光阑、镜筒、镜座、红外截止滤光片、AA 胶层、图像传感器与 PCB。',
    separation: '轴向分离',
    assembled: '装配',
    exploded: '爆炸',
    separationNote: '分离只改变沿光轴的展示间距；镜片组从镜筒前端取出，与装配方向一致。',
    sectionTitle: '截面光路',
    sectionIntro:
      '近轴追迹 0°、15° 与 30° 三个视场的光束。点击镜片、光阑、滤光片或传感器，模型、零件标签与本图同步高亮。',
    sectionDisclaimer: '示意，不代表真实光学设计',
    sectionAlt:
      '镜头子午截面：光线从左侧物方进入，依次经过六片镜片、光阑和红外截止滤光片，在右侧传感器面会聚。三个视场的光束分别以实线、虚线与点线绘制。',
    objectSide: '物方',
    imageSide: '像面',
    opticalAxis: '光轴',
    field: '视场',
    chiefRay: '主光线经过光阑中心',
    glass: '玻璃',
    plastic: '塑料',
    spherical: '球面',
    aspheric: '非球面',
    paraxialTitle: '近轴参数',
    efl: '有效焦距 f′',
    fNumber: 'F 数',
    halfField: '半视场角 θ',
    imageHeight: '像高 y′ = f′ tan θ',
    totalTrack: '光学总长（L1 顶点至像面）',
    backFocal: '后焦距（L6 后顶点至像面）',
    stopDiameter: '光阑孔径',
    elementsCaption: '镜片组成（点击选择）',
    colElement: '镜片',
    colType: '材料 · 面型',
    colIndex: '折射率 nd',
    colFocal: '焦距',
    paraxialNote: '数值由页面中的同一组示意参数在构建时计算；单位 mm。',
    modelScope: '原创通用结构 · 近轴示意 · 无成像质量计算',
    assumptions: '模型、公式与边界',
    traceTitle: '近轴追迹公式',
    traceTerms:
      'y 为光线高度，u 为光线与光轴夹角，n 为折射率，c = 1/R 为顶点曲率，t 为到下一面的轴向距离。φ 为单面光焦度。',
    traceFocal:
      '轴上平行光以 y₁ = 1、u₁ = 0 入射时，f′ = −1 / u′ₖ。孔径光阑半径按入瞳直径 D = f′ / F 推得；各视场边缘光线经过光阑边缘，主光线经过光阑中心。',
    asphereNote:
      '塑料面使用偶次非球面 z(r) = c r² / (1 + √(1 − (1 + k) c² r²)) + A₄ r⁴。锥面系数 k 与 A₄ 只改变绘制和三维面形；近轴追迹只使用顶点曲率，因此不能据此评价像差。',
    materialNote:
      '前片采用玻璃，耐刮擦、耐化学品与紫外，折射率随温度变化小；塑料非球面便于注塑并以较少片数校正像差，但折射率温度系数与热膨胀更大。实际车载镜头需做无热化设计，本页未计算温度引起的焦移。',
    aaNote:
      '主动对准（AA）在通电成像状态下调整镜头相对传感器的位置与倾斜，以图像清晰度指标确定最佳位置后固化胶层。工艺自由度、评价指标与固化收缩均未建模。',
    limitsNote:
      '未计算像差、畸变、MTF、相对照度、杂散光、公差或环境可靠性；视场角、折射率和尺寸均为示意值。材料为常用类别，不指定牌号、厂商或产品。',
    provenance:
      '参数化示意模型，几何经简化；不复刻任何厂商产品。截面光路、三维几何与静态图片由同一组参数生成。',
  },
  en: {
    kicker: 'L2 · 3D teardown',
    title: 'Automotive camera lens',
    subtitle:
      'Separate the barrel, six elements and sensor module along the optical axis, then locate each element in a paraxial section.',
    back: 'Back to lab',
    stage: 'Generic six-element automotive camera lens module in three dimensions',
    modes: 'View selection',
    whole: 'Full module',
    optics: 'Optical train',
    wholeCaption:
      'Full module: retaining ring, lens stack, barrel, holder, filter, AA adhesive, sensor and PCB spread along the optical axis.',
    opticsCaption:
      'Optical train: only the six elements, stop, filter and sensor remain, in light-path order.',
    reset: 'Reset view',
    hint: 'Drag to orbit · Scroll to zoom · Select a part for details',
    loading:
      'Preparing the 3D view. Part details, the ray section and paraxial data are already available.',
    keyboardTitle: 'Keyboard controls',
    keyboard:
      'Arrow keys orbit, plus and minus zoom, Home resets the view. Tab moves between part buttons and optical elements in the section; Enter or Space selects. Arrow keys adjust separation.',
    parts: 'Select a part',
    selected: 'Selected part',
    role: 'Role',
    features: 'Features',
    material: 'Common materials',
    noJs: 'Static schematic. All part details, the ray section and paraxial data remain below; enable JavaScript for linked selection.',
    allParts: 'All parts',
    staticMode:
      'The image keeps the default exploded state; the ray section and part selection remain linked',
    fallback: 'Static mode.',
    fallbackReason:
      'Respecting reduced motion or device resources; part selection, the ray section and paraxial data remain available.',
    loadFailure:
      'The 3D view is unavailable; part selection, the ray section and paraxial data remain available.',
    staticAlt:
      'Generic automotive camera lens module exploded along its optical axis: retaining ring, O-ring, six elements with spacers, stop, barrel, holder, IR-cut filter, AA adhesive, image sensor and PCB.',
    separation: 'Axial separation',
    assembled: 'Assembled',
    exploded: 'Exploded',
    separationNote:
      'Separation changes display spacing along the optical axis only. The lens stack leaves the barrel through its front, matching the assembly direction.',
    sectionTitle: 'Ray section',
    sectionIntro:
      'Paraxial bundles for 0°, 15° and 30° fields. Select an element, the stop, the filter or the sensor to highlight it in the model, the part tags and this diagram.',
    sectionDisclaimer: 'Illustrative, not a real optical design',
    sectionAlt:
      'Meridional lens section: light enters from the object side on the left, passes six elements, the stop and the IR-cut filter, and converges on the sensor at the right. The three field bundles use solid, dashed and dotted lines.',
    objectSide: 'Object side',
    imageSide: 'Image plane',
    opticalAxis: 'Optical axis',
    field: 'field',
    chiefRay: 'Chief rays pass the stop centre',
    glass: 'Glass',
    plastic: 'Plastic',
    spherical: 'spherical',
    aspheric: 'aspheric',
    paraxialTitle: 'Paraxial data',
    efl: 'Effective focal length f′',
    fNumber: 'F-number',
    halfField: 'Half-field angle θ',
    imageHeight: 'Image height y′ = f′ tan θ',
    totalTrack: 'Total track (L1 vertex to image)',
    backFocal: 'Back focal distance (L6 rear vertex to image)',
    stopDiameter: 'Stop diameter',
    elementsCaption: 'Element summary (select a row)',
    colElement: 'Element',
    colType: 'Material · surface',
    colIndex: 'Index nd',
    colFocal: 'Focal length',
    paraxialNote:
      'Values are computed at build time from the same illustrative parameters shown on this page; units are mm.',
    modelScope: 'Original generic structure · paraxial illustration · no image-quality calculation',
    assumptions: 'Model, equations and limits',
    traceTitle: 'Paraxial trace equations',
    traceTerms:
      'y is ray height, u the ray angle to the axis, n the refractive index, c = 1/R the vertex curvature and t the axial distance to the next surface. φ is the surface power.',
    traceFocal:
      'For an axial ray entering with y₁ = 1 and u₁ = 0, f′ = −1 / u′ₖ. The stop radius follows from the entrance-pupil diameter D = f′ / F. Marginal rays of each field pass the stop edge; chief rays pass its centre.',
    asphereNote:
      'Plastic surfaces use the even asphere z(r) = c r² / (1 + √(1 − (1 + k) c² r²)) + A₄ r⁴. The conic k and A₄ change only the drawn and modelled shape; the paraxial trace uses vertex curvature alone, so aberrations cannot be judged from it.',
    materialNote:
      'The front element is glass for scratch, chemical and UV resistance and a low thermal index change. Plastic aspheres are moulded and correct aberrations with fewer elements, but have larger thermo-optic and expansion coefficients. Real automotive lenses need athermal design; thermal focus shift is not calculated here.',
    aaNote:
      'Active alignment (AA) moves and tilts the lens relative to the powered sensor, chooses the position from a live sharpness metric and then cures the adhesive. Process axes, metrics and cure shrinkage are not modelled.',
    limitsNote:
      'Aberrations, distortion, MTF, relative illumination, stray light, tolerances and environmental reliability are not calculated. Field angles, indices and dimensions are illustrative. Materials are common categories, without grades, vendors or products.',
    provenance:
      'Parametric illustrative model with simplified geometry; no vendor product is reproduced. The ray section, 3D geometry and static images come from one parameter set.',
  },
} as const;
export function aclModes(locale: AclLocale) {
  const copy = aclCopy[locale];
  return (['whole', 'optics'] as const).map((id: AclMode) => ({
    id,
    label: copy[id],
    caption: copy[`${id}Caption`],
    showLabels: true,
  }));
}
