import type { ValidityId, ValidityStatus, CorrelationId } from './evaluator';
import type { FlowRegime } from './correlations';
import type { PartId } from './geometry';
import type { Arrangement, CoolantId, GroupId, NumericKey, PinMaterialId } from './parameters';

export type PinFinLocale = 'zh' | 'en';

interface ValidityCopy {
  label: string;
  explain: string;
}

interface PinFinCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  back: string;
  stageLabel: string;
  previewAlt: string;
  loading: string;
  load3d: string;
  manualLoad: string;
  fallback: string;
  noScript: string;
  coverToggle: string;
  resetView: string;
  interaction: string;
  modelNote: string;
  partOverline: string;
  partFields: { role: string; features: string; material: string };
  partsLabel: string;
  rthLabel: string;
  rthDefinition: string;
  dpLabel: string;
  hLabel: string;
  reLabel: string;
  regimeLabel: string;
  regimes: Record<FlowRegime, string>;
  pumpingLabel: string;
  tBaseLabel: string;
  statusAllOk: string;
  statusOut: string;
  statusCaution: string;
  statusLink: string;
  parameterTitle: string;
  parameterTabs: string;
  tabs: Record<GroupId, string>;
  tabNotes: Record<GroupId, string>;
  parameterLabels: Record<NumericKey, string>;
  arrangementLabel: string;
  arrangements: Record<Arrangement, string>;
  coolantLabel: string;
  coolants: Record<CoolantId, string>;
  materialLabel: string;
  materials: Record<PinMaterialId, string>;
  resetParameters: string;
  sweepTitle: string;
  sweepLabel: string;
  sweepDescription: string;
  axisDp: string;
  axisRth: string;
  chartLabel: string;
  currentPoint: string;
  outsideRange: string;
  tableToggle: string;
  streamTitle: string;
  streamBadge: string;
  streamCaption: string;
  streamLabel: string;
  flowDirection: string;
  detailsTitle: string;
  details: {
    pins: string;
    rows: string;
    area: string;
    vMax: string;
    nu: string;
    c1c2: string;
    finEfficiency: string;
    surfaceEfficiency: string;
    ntu: string;
    rConv: string;
    rCaloric: string;
    tOut: string;
    xi: string;
    props: string;
  };
  validityTitle: string;
  validityIntro: string;
  validityColumns: { item: string; value: string; range: string; status: string };
  correlations: Record<CorrelationId, string>;
  statusNames: Record<ValidityStatus, string>;
  validity: Record<ValidityId, ValidityCopy>;
  methodTitle: string;
  method: string[];
  formulasTitle: string;
  assumptionsTitle: string;
  assumptions: string[];
  propertiesNote: string;
  referencesTitle: string;
  references: string[];
  inputError: string;
  noPins: string;
  currentResult: string;
  partNames: Record<PartId, string>;
}

export const pinFinCopy: Record<PinFinLocale, PinFinCopy> = {
  zh: {
    eyebrow: 'S3 · 仿真',
    title: 'Pin-fin 散热器仿真',
    subtitle: '针翅冷板的热阻与压降：管束经验关联式估算',
    back: '返回实验台',
    stageLabel:
      '针翅冷板三维参数化模型。拖动或方向键旋转，滚轮或加减键缩放，Home 复位。点击部件或使用下方部件按钮选择。',
    previewAlt: '默认参数下的针翅冷板：底板、叉排圆柱针、半透明盖板与两端集流腔',
    loading: '正在准备三维模型',
    load3d: '加载 3D 模型',
    manualLoad: '静态预览为默认参数。点按“加载 3D 模型”后随参数实时重建。',
    fallback: '已切换为静态预览；计算、流线示意与权衡图仍随参数更新。',
    noScript: '交互需要 JavaScript。当前显示默认工况的计算结果。',
    coverToggle: '盖板',
    resetView: '复位视角',
    interaction: '拖动 / 方向键旋转 · 滚轮 / +/- 缩放 · Home 复位 · 点击选择部件',
    modelNote: '参数化示意模型，几何经简化',
    partOverline: '部件',
    partFields: { role: '作用', features: '特点', material: '常用材料' },
    partsLabel: '选择部件',
    rthLabel: '热阻',
    rthDefinition: '底板上表面 → 冷却液入口',
    dpLabel: '压降',
    hLabel: '平均换热系数',
    reLabel: '最大流速雷诺数',
    regimeLabel: '流动区间',
    regimes: {
      creeping: '蠕流（低于关联式下限）',
      laminar: '层流主导',
      transitional: '过渡区',
      subcritical: '亚临界混合流',
      critical: '临界区',
    },
    pumpingLabel: '泵功',
    tBaseLabel: '底板温度',
    statusAllOk: '全部输入在关联式适用范围内',
    statusOut: '项超出关联式适用范围，结果仅作趋势参考',
    statusCaution: '项需注意',
    statusLink: '查看适用范围',
    parameterTitle: '探索参数',
    parameterTabs: '参数分组',
    tabs: { flow: '工况', pins: '针翅', footprint: '底板' },
    tabNotes: {
      flow: '流量按体积计。热负荷只影响出口温度与壁温（Pr_s 修正），对热阻影响很小。',
      pins: '间距以针径的倍数给出：横向 S_T 垂直于来流，纵向 S_L 沿来流方向。针高等于流道高度。',
      footprint: '阵列在长 × 宽内居中排布，来流沿长度方向。',
    },
    parameterLabels: {
      flow: '流量',
      tIn: '入口温度',
      heat: '热负荷',
      diameter: '针径 D',
      pitchT: '横向间距 S_T/D',
      pitchL: '纵向间距 S_L/D',
      height: '针高 H',
      width: '宽度（垂直来流）',
      length: '长度（沿来流）',
    },
    arrangementLabel: '排布',
    arrangements: { inline: '顺排', staggered: '叉排' },
    coolantLabel: '冷却液',
    coolants: { water: '水', glycol50: '50% 乙二醇水溶液' },
    materialLabel: '针翅材料',
    materials: { copper: '铜 · 390', aluminium: '铝 6061 · 167' },
    resetParameters: '恢复默认参数',
    sweepTitle: 'R_th – Δp 权衡',
    sweepLabel: '扫描参数',
    sweepDescription:
      '在所选参数的完整滑块范围内重新计算，其余参数保持当前值。空心点表示至少一个关联式超出适用范围。',
    axisDp: 'Δp（kPa，对数坐标）',
    axisRth: 'R_th（K/W）',
    chartLabel: '热阻与压降权衡曲线',
    currentPoint: '当前',
    outsideRange: '超出适用范围',
    tableToggle: '查看数据表',
    streamTitle: '流线示意 · 俯视',
    streamBadge: '示意，非 CFD',
    streamCaption:
      '均匀来流叠加各针的势流偶极子，仅用于理解绕流与排布；不含尾流、分离、端壁与侧壁效应。',
    streamLabel: '针翅阵列俯视图与示意流线，来流从左向右',
    flowDirection: '来流方向',
    detailsTitle: '计算明细',
    details: {
      pins: '针数',
      rows: '排数 N_L × 每排',
      area: '换热面积（针 + 底面）',
      vMax: '最小截面流速 V_max',
      nu: 'Nu_D',
      c1c2: 'C₁ · C₂',
      finEfficiency: '肋效率 η_f',
      surfaceEfficiency: '总面效率 η_o',
      ntu: 'NTU · ε',
      rConv: '对流热阻 1/(η_o hA)',
      rCaloric: '温升热阻',
      tOut: '出口温度',
      xi: 'ξ · 主阻力数 N_W',
      props: '平均液温物性 ρ · c_p · k · μ · Pr',
    },
    validityTitle: '关联式适用范围',
    validityIntro: '每次计算都会检查输入是否落在所用关联式的数据范围内；边界值视为在范围内。',
    validityColumns: { item: '检查项', value: '当前值', range: '适用范围', status: '状态' },
    correlations: {
      zukauskas: 'Zukauskas 管束换热',
      gaddis: 'Gaddis–Gnielinski 压降',
      fin: '针翅一维导热',
      properties: '冷却液物性表',
      geometry: '几何',
    },
    statusNames: { ok: '范围内', caution: '注意', out: '超出' },
    validity: {
      'zk-re': {
        label: 'Re_D,max',
        explain: '超出 Zukauskas 管束数据范围，换热系数为外推值。',
      },
      'zk-pr': { label: 'Pr', explain: '超出 0.7 ≤ Pr ≤ 500，Pr 指数修正不再可靠。' },
      'zk-band': {
        label: '10² ≤ Re < 10³ 区间',
        explain:
          '该区间按表 7.5 用单圆柱关联式（C = 0.51, m = 0.5）近似；区间边界处 Nu 存在跳变，扫描曲线会出现折点。',
      },
      'zk-rows': {
        label: '排数 N_L',
        explain: '排数修正 C₂ 仅给出 Re ≥ 10³ 的数据；当前取 C₂ = 1，可能高估换热。',
      },
      'zk-aligned': {
        label: 'S_T/S_L（顺排）',
        explain: '顺排且 S_T/S_L < 0.7 时换热效率低，教材建议不采用顺排。',
      },
      'gg-re': { label: 'Re₀', explain: '超出 Gaddis–Gnielinski 关联式范围，压降为外推值。' },
      'gg-a': { label: 'a = S_T/D', explain: '横向间距比超出关联式数据范围。' },
      'gg-b': { label: 'b = S_L/D', explain: '纵向间距比超出关联式数据范围。' },
      'gg-c': { label: 'c（叉排对角间距比）', explain: '叉排对角间距比低于 1.25。' },
      'gg-rows': {
        label: '主阻力数 N_W',
        explain: '少于 5 排时进出口修正未定义；当前按 N_W = 5 估算，压降不确定度大。',
      },
      'gg-low-re': {
        label: '低 Re 层流段',
        explain: 'Re₀ < 10³ 时层流项占主导，其数据仅来自少数间距组合，误差较大。',
      },
      'fin-biot': {
        label: 'Bi = hD/(4k)',
        explain: 'Bi > 0.1 时针内径向温差不可忽略，一维肋效率偏乐观。',
      },
      'prop-bulk': { label: '平均液温', explain: '超出物性表温度范围，物性按表端值截取。' },
      'prop-wall': { label: '平均壁温', explain: '壁温超出物性表范围，Pr_s 按表端值截取。' },
      'prop-boil': {
        label: '底板温度',
        explain: '底板温度超过 100 °C，近常压下可能出现局部沸腾，单相关联式不再适用。',
      },
      'geo-short': {
        label: 'H/D',
        explain: '管束关联式基于长圆柱；H/D < 4 的短针受端壁影响明显，结果偏差可能较大。',
      },
    },
    methodTitle: '计算方法',
    method: [
      '以最小截面流速 V_max 计算 Re，按 Zukauskas 管束关联式（含排数修正）求平均 Nu 与 h；针翅按等截面直肋、针顶绝热计算肋效率，底面未覆盖面积按同一 h 换热。',
      '以有效度–NTU 关系求底板到冷却液入口的热阻，并迭代平均液温与壁温。压降采用 Gaddis–Gnielinski 管束关联式，只计阵列本身。',
    ],
    formulasTitle: '公式',
    assumptionsTitle: '假设与限制',
    assumptions: [
      '稳态单相流；底板上表面（针根）等温，不计底板导热与热扩展。',
      '盖板贴合针顶、无旁通，盖板与侧壁绝热；集流腔分配均匀，其压降未计入。',
      '关联式来自长圆柱管束数据，未计端壁对短针的影响；Δp 未作壁面黏度修正。',
      '热负荷只用于出口温度与壁温（Pr_s）；底板温度为平均意义上的估算。',
    ],
    propertiesNote:
      '物性随温度插值（μ 按对数插值）。水：饱和液态，IAPWS-95 与 IAPWS 黏度、导热公式；50% 乙二醇水溶液（质量分数）：Melinder (2010) 数据拟合。均由 CoolProp 8.0.0 生成并在单元测试中与 Incropera 表 A.6 对照。',
    referencesTitle: '参考文献',
    references: [
      'Incropera, DeWitt, Bergman, Lavine. Fundamentals of Heat and Mass Transfer, 6th ed., Wiley, 2007 — §7.6 式 7.58、表 7.5–7.6；§3.6 针翅；表 A.6。',
      'Žukauskas, A. Heat transfer from tubes in crossflow. Advances in Heat Transfer 8 (1972) 93–160.',
      'Gaddis, E. S., Gnielinski, V. Pressure drop in cross flow across tube bundles. Int. Chem. Eng. 25 (1985) 1–15；VDI Heat Atlas, 2nd ed., 2010, Ch. L1.',
      'Melinder, Å. Properties of Secondary Working Fluids for Indirect Systems. IIR, 2010；Bell et al., CoolProp, Ind. Eng. Chem. Res. 53 (2014) 2498–2508.',
    ],
    inputError: '当前参数无法计算，请检查数值或恢复默认参数。',
    noPins: '当前尺寸下放不下一排针，请增大底板尺寸或减小间距。',
    currentResult: '当前计算结果',
    partNames: {
      'base-plate': '底板',
      'pin-array': '针翅阵列',
      cover: '盖板与侧壁',
      'inlet-manifold': '入口集流腔',
      'outlet-manifold': '出口集流腔',
    },
  },
  en: {
    eyebrow: 'S3 · SIMULATION',
    title: 'Pin-fin cold plate',
    subtitle: 'Thermal resistance and pressure drop from tube-bank correlations',
    back: 'Back to Lab',
    stageLabel:
      'Parametric 3D pin-fin cold plate. Drag or use arrow keys to orbit, scroll or use plus/minus to zoom, Home to reset. Click a part or use the part buttons below to select it.',
    previewAlt:
      'Pin-fin cold plate at the default values: base plate, staggered cylindrical pins, translucent cover and two manifolds',
    loading: 'Preparing the 3D model',
    load3d: 'Load 3D model',
    manualLoad:
      'The static preview shows the default values. Tap “Load 3D model” to rebuild it live from the parameters.',
    fallback:
      'The static preview is active; calculations, the streamline sketch and the trade-off chart still follow the parameters.',
    noScript: 'JavaScript is required for interaction. The default operating point is shown.',
    coverToggle: 'Cover',
    resetView: 'Reset view',
    interaction: 'Drag / arrows to orbit · Scroll / +/- to zoom · Home to reset · Click to select',
    modelNote: 'Parametric illustrative model, simplified geometry',
    partOverline: 'Part',
    partFields: { role: 'Role', features: 'Features', material: 'Typical materials' },
    partsLabel: 'Select a part',
    rthLabel: 'Thermal resistance',
    rthDefinition: 'Base top surface → coolant inlet',
    dpLabel: 'Pressure drop',
    hLabel: 'Mean heat-transfer coefficient',
    reLabel: 'Reynolds number at V_max',
    regimeLabel: 'Flow regime',
    regimes: {
      creeping: 'Creeping (below correlation range)',
      laminar: 'Laminar-dominated',
      transitional: 'Transitional',
      subcritical: 'Subcritical mixed',
      critical: 'Critical',
    },
    pumpingLabel: 'Pumping power',
    tBaseLabel: 'Base temperature',
    statusAllOk: 'All inputs lie within the correlation ranges',
    statusOut: 'outside a correlation range; treat results as trends only',
    statusCaution: 'to note',
    statusLink: 'Validity ranges',
    parameterTitle: 'Explore parameters',
    parameterTabs: 'Parameter groups',
    tabs: { flow: 'Conditions', pins: 'Pins', footprint: 'Base' },
    tabNotes: {
      flow: 'Volumetric flow. Heat load only sets the outlet and wall temperatures (Pr_s correction); its effect on resistance is small.',
      pins: 'Pitches are multiples of the pin diameter: transverse S_T across the flow, longitudinal S_L along it. Pin height equals the channel height.',
      footprint: 'The array is centred in length × width; the coolant flows along the length.',
    },
    parameterLabels: {
      flow: 'Flow rate',
      tIn: 'Inlet temperature',
      heat: 'Heat load',
      diameter: 'Pin diameter D',
      pitchT: 'Transverse pitch S_T/D',
      pitchL: 'Longitudinal pitch S_L/D',
      height: 'Pin height H',
      width: 'Width (across flow)',
      length: 'Length (along flow)',
    },
    arrangementLabel: 'Arrangement',
    arrangements: { inline: 'In-line', staggered: 'Staggered' },
    coolantLabel: 'Coolant',
    coolants: { water: 'Water', glycol50: '50% ethylene glycol' },
    materialLabel: 'Pin material',
    materials: { copper: 'Copper · 390', aluminium: 'Al 6061 · 167' },
    resetParameters: 'Restore defaults',
    sweepTitle: 'R_th – Δp trade-off',
    sweepLabel: 'Sweep parameter',
    sweepDescription:
      'Recalculated across the full slider range of the selected parameter, others held at their current values. Hollow points have at least one correlation outside its range.',
    axisDp: 'Δp (kPa, log scale)',
    axisRth: 'R_th (K/W)',
    chartLabel: 'Thermal resistance versus pressure drop',
    currentPoint: 'Current',
    outsideRange: 'outside range',
    tableToggle: 'Show data table',
    streamTitle: 'Streamline sketch · top view',
    streamBadge: 'Illustrative, not CFD',
    streamCaption:
      'Uniform flow plus a potential-flow doublet at each pin, to read the arrangement only. No wakes, separation, end-wall or side-wall effects.',
    streamLabel: 'Top view of the pin array with illustrative streamlines, flow from left to right',
    flowDirection: 'Flow',
    detailsTitle: 'Calculation details',
    details: {
      pins: 'Pins',
      rows: 'Rows N_L × per row',
      area: 'Wetted area (pins + base)',
      vMax: 'Narrowest-section velocity V_max',
      nu: 'Nu_D',
      c1c2: 'C₁ · C₂',
      finEfficiency: 'Fin efficiency η_f',
      surfaceEfficiency: 'Overall surface efficiency η_o',
      ntu: 'NTU · ε',
      rConv: 'Convective 1/(η_o hA)',
      rCaloric: 'Coolant-rise resistance',
      tOut: 'Outlet temperature',
      xi: 'ξ · main resistances N_W',
      props: 'Bulk properties ρ · c_p · k · μ · Pr',
    },
    validityTitle: 'Correlation validity',
    validityIntro:
      'Every calculation checks whether the inputs lie inside the data range of each correlation; boundary values count as inside.',
    validityColumns: { item: 'Check', value: 'Current', range: 'Valid range', status: 'Status' },
    correlations: {
      zukauskas: 'Zukauskas bank heat transfer',
      gaddis: 'Gaddis–Gnielinski pressure drop',
      fin: '1D pin conduction',
      properties: 'Coolant property table',
      geometry: 'Geometry',
    },
    statusNames: { ok: 'Within', caution: 'Note', out: 'Outside' },
    validity: {
      'zk-re': {
        label: 'Re_D,max',
        explain:
          'Outside the Zukauskas tube-bank data; the heat-transfer coefficient is extrapolated.',
      },
      'zk-pr': {
        label: 'Pr',
        explain: 'Outside 0.7 ≤ Pr ≤ 500; the Prandtl-number scaling is no longer reliable.',
      },
      'zk-band': {
        label: '10² ≤ Re < 10³ band',
        explain:
          'Table 7.5 approximates this band with the single-cylinder correlation (C = 0.51, m = 0.5). Nu jumps at the band limits, so sweep curves show kinks.',
      },
      'zk-rows': {
        label: 'Rows N_L',
        explain:
          'The row correction C₂ is tabulated only for Re ≥ 10³; C₂ = 1 is used, which may overestimate heat transfer.',
      },
      'zk-aligned': {
        label: 'S_T/S_L (in-line)',
        explain:
          'In-line banks with S_T/S_L < 0.7 transfer heat poorly; the textbook advises against them.',
      },
      'gg-re': {
        label: 'Re₀',
        explain: 'Outside the Gaddis–Gnielinski range; the pressure drop is extrapolated.',
      },
      'gg-a': {
        label: 'a = S_T/D',
        explain: 'Transverse pitch ratio outside the correlation data.',
      },
      'gg-b': {
        label: 'b = S_L/D',
        explain: 'Longitudinal pitch ratio outside the correlation data.',
      },
      'gg-c': {
        label: 'c (staggered diagonal ratio)',
        explain: 'Staggered diagonal pitch ratio below 1.25.',
      },
      'gg-rows': {
        label: 'Main resistances N_W',
        explain:
          'The inlet/outlet term is undefined below five rows; it is evaluated at N_W = 5, so the pressure drop is uncertain.',
      },
      'gg-low-re': {
        label: 'Low-Re laminar part',
        explain:
          'Below Re₀ = 10³ the laminar term dominates; its data come from only a few pitch combinations.',
      },
      'fin-biot': {
        label: 'Bi = hD/(4k)',
        explain:
          'Above Bi = 0.1 the radial temperature difference in a pin matters; the 1D fin efficiency is optimistic.',
      },
      'prop-bulk': {
        label: 'Mean bulk temperature',
        explain: 'Outside the property table; properties are held at the table limit.',
      },
      'prop-wall': {
        label: 'Mean wall temperature',
        explain: 'Wall temperature outside the property table; Pr_s is held at the table limit.',
      },
      'prop-boil': {
        label: 'Base temperature',
        explain:
          'Base above 100 °C: local boiling is possible near atmospheric pressure and single-phase correlations no longer apply.',
      },
      'geo-short': {
        label: 'H/D',
        explain:
          'Tube-bank correlations come from long cylinders; short pins with H/D < 4 are strongly affected by the end walls.',
      },
    },
    methodTitle: 'Method',
    method: [
      'Re uses the narrowest-section velocity V_max. The Zukauskas tube-bank correlation with its row correction gives the mean Nu and h. Pins are uniform fins with adiabatic tips; the uncovered base area uses the same h.',
      'An effectiveness–NTU relation gives the resistance from the base to the coolant inlet, iterating the mean bulk and wall temperatures. The Gaddis–Gnielinski bundle correlation gives the pressure drop of the array alone.',
    ],
    formulasTitle: 'Equations',
    assumptionsTitle: 'Assumptions and limits',
    assumptions: [
      'Steady single-phase flow; the base top surface (pin roots) is isothermal. Base conduction and spreading are not included.',
      'The cover touches the pin tips with no bypass; cover and side walls are adiabatic. Manifolds distribute uniformly and their losses are excluded.',
      'The correlations come from long-tube banks and omit end-wall effects on short pins; Δp has no wall-viscosity correction.',
      'Heat load sets only the outlet and wall (Pr_s) temperatures; the base temperature is an average estimate.',
    ],
    propertiesNote:
      'Properties are interpolated in temperature (μ logarithmically). Water: saturated liquid, IAPWS-95 with the IAPWS viscosity and conductivity formulations. 50% ethylene glycol by mass: fit to Melinder (2010). Both were generated with CoolProp 8.0.0 and are cross-checked against Incropera Table A.6 in the unit tests.',
    referencesTitle: 'References',
    references: [
      'Incropera, DeWitt, Bergman, Lavine. Fundamentals of Heat and Mass Transfer, 6th ed., Wiley, 2007 — §7.6 Eq. 7.58, Tables 7.5–7.6; §3.6 pin fins; Table A.6.',
      'Žukauskas, A. Heat transfer from tubes in crossflow. Advances in Heat Transfer 8 (1972) 93–160.',
      'Gaddis, E. S., Gnielinski, V. Pressure drop in cross flow across tube bundles. Int. Chem. Eng. 25 (1985) 1–15; VDI Heat Atlas, 2nd ed., 2010, Ch. L1.',
      'Melinder, Å. Properties of Secondary Working Fluids for Indirect Systems. IIR, 2010; Bell et al., CoolProp, Ind. Eng. Chem. Res. 53 (2014) 2498–2508.',
    ],
    inputError:
      'These parameters could not be evaluated. Check the values or restore the defaults.',
    noPins: 'Not even one row of pins fits. Enlarge the base or reduce the pitch.',
    currentResult: 'Current calculation',
    partNames: {
      'base-plate': 'Base plate',
      'pin-array': 'Pin-fin array',
      cover: 'Cover and side walls',
      'inlet-manifold': 'Inlet manifold',
      'outlet-manifold': 'Outlet manifold',
    },
  },
};

/** Equations shown on the page; identical in both locales. */
export const FORMULAS = [
  'Re_D,max = ρ V_max D / μ,   V_max = S_T/(S_T − D) · V  (or S_T/[2(S_D − D)] · V)',
  'Nu_D = C₁ C₂ Re_D,max^m Pr^0.36 (Pr/Pr_s)^1/4,   h = Nu_D k / D',
  'η_f = tanh(mH)/(mH),   m = √(4h / (k_f D)),   η_o = 1 − (A_f/A)(1 − η_f)',
  'NTU = η_o h A / (ṁ c_p),   ε = 1 − e^−NTU,   R_th = 1 / (ε ṁ c_p)',
  'Δp = ξ N_W ρ u₀² / 2,   ξ = ξ_lam + (ξ_turb + f_n)[1 − e^−(Re+k₁)/k₂]',
] as const;
