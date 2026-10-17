import type { RobotJointMode } from './parts';
export type RobotJointLocale = 'zh' | 'en';
export const robotJointCopy = {
  zh: {
    kicker: 'L5 · 系统拆解',
    title: '一体化机器人关节',
    subtitle: '沿中空轴线拆开十四个部件，追踪电能、转矩与双编码器反馈。',
    back: '返回实验室',
    stage: '通用中空一体化机器人关节三维拆解',
    modes: '视图选择',
    whole: '完整模块',
    mechanism: '内部机构',
    wholeCaption: '完整模块：电机、减速器、双编码器、制动器与驱动板沿中空轴线集成。',
    mechanismCaption: '内部机构：隐藏壳体及前后端盖，其余部件保持原有装配关系。',
    reset: '重置视角',
    hint: '拖动旋转视角 · 滚轮缩放 · 点击部件查看说明',
    loading: '正在准备三维视图。部件说明、流程图与分离滑块已可使用。',
    keyboardTitle: '键盘操作',
    keyboard:
      '方向键旋转视角，加减号缩放，Home 重置视角。Tab 切换部件与流程节点，Enter 或空格选择；方向键调节分离滑块。',
    parts: '选择部件',
    selected: '当前部件',
    role: '作用',
    features: '特点',
    material: '材料示例',
    noJs: '当前为静态示意。下方保留全部部件说明；启用 JavaScript 后可联动选择和调节分离程度。',
    allParts: '全部部件',
    staticMode: '静态图片保持默认爆炸状态；下方二维分层示意响应分离与选择',
    fallback: '静态模式。',
    fallbackReason: '遵循减少动态效果或设备资源设置；部件选择、流程图与二维分离仍可操作。',
    loadFailure: '三维视图暂不可用；部件选择、流程图与二维分离仍可操作。',
    staticAlt:
      '原创中空机器人关节爆炸示意，包含电机、谐波减速器、双编码器、制动器、驱动板、轴承、壳体与端盖。',
    separation: '分离程度',
    assembled: '装配',
    exploded: '爆炸',
    separationNote: '分离滑块只改变展示间距，不模拟运行、传动或制造公差。',
    flowTitle: '电能、转矩与反馈',
    flowIntro: '选择一个节点，定位它在模块中的对应部件。',
    flowAlt:
      '直流母线经过驱动板供给电机，电机经减速器驱动输出。电机侧与输出侧编码器分别反馈至驱动板；驱动板控制制动器释放。',
    dcBus: '直流母线',
    external: '外部电源',
    driver: '驱动板',
    motor: '电机',
    reducer: '谐波减速器',
    output: '机械输出',
    motorFeedback: '电机侧编码器',
    outputFeedback: '输出侧编码器',
    brake: '失电制动器',
    power: '电能',
    mechanical: '机械转矩',
    feedback: '反馈信号',
    control: '制动控制',
    flowPowerNote:
      '实线：电能；粗实线：转矩；虚线：反馈；点划线：制动控制。箭头表示标称驱动方向，未展开回馈制动。',
    contextDriver:
      '驱动板将外部直流电能变为电机相电流，并接收双编码器反馈。母线是未建模的外部边界，选择它会定位驱动板输入。',
    contextMotor:
      '电机节点包含定子与转子：定子建立旋转磁场，转子把转矩传给减速器。选择任一部件都会高亮此节点。',
    contextReducer:
      '减速器连接电机与机械输出。这里只展示集成位置和功能关系，不播放传动动画，也不计算速比或负载。',
    contextOutput: '输出法兰是模块的机械输出接口。输出侧编码器测量该侧位置；它不承载驱动功率。',
    contextMotorEncoder:
      '增量编码器反馈电机侧相对转角与转速；换相所需的初始电角度基准或辅助信号未展开。虚线表示反馈，不是动力传递。',
    contextOutputEncoder:
      '输出侧编码器向驱动板反馈输出位置；与电机侧测量位置不同，虚线表示反馈信号。',
    contextBrake:
      '示意采用弹簧施加、通电释放的保持制动器。控制线表示释放许可；受控停机后断电保持，不代表紧急制动能力或安全等级。',
    contextNeutral:
      '该部件承担结构、支承或散热功能，不属于图中的能量与信号节点。流程保持中性，模型与部件说明继续联动。',
    staticSeparation: '二维分层示意',
    staticSeparationAlt:
      '十四个简化轴向层。滑块控制间距，选择的部件高亮；内部机构模式隐藏壳体及端盖。',
    modelScope: '原创通用拓扑 · 中空集成 · 无传动动画',
    assumptions: '模型与系统边界',
    geometryNote:
      '几何以同轴环件与简化局部特征表达集成关系。减速器作为一个功能组件；齿形、线圈、磁钢、电子器件与交叉滚子均为简化示意。',
    hollowNote:
      '中央通孔表示布线通道的设计意图，未绘出电缆、密封、紧固与接插件。装配方向与分离距离仅用于阅读。',
    brakeNote:
      '制动器表示断电保持的功能拓扑。实际系统需按负载、停机过程与风险分析选择制动及安全回路，本图不构成接线或安全设计。',
    limitsNote:
      '未计算转矩、热平衡、刚度、寿命、控制性能或安全等级。材料为通用占位示例，不指定厂商、牌号或制造工艺。',
    provenance:
      '原创参数化教学模型；不复刻厂商 CAD、外形或尺寸。静态图片与交互几何来自同一模型生成流程。',
  },
  en: {
    kicker: 'L5 · SYSTEM TEARDOWN',
    title: 'Integrated robot joint',
    subtitle:
      'Separate fourteen parts around a hollow axis. Follow power, torque and dual-encoder feedback.',
    back: 'Back to lab',
    stage: 'Generic hollow integrated robot joint in three dimensions',
    modes: 'View selection',
    whole: 'Full module',
    mechanism: 'Internal mechanism',
    wholeCaption:
      'Full module: motor, reducer, dual encoders, brake and driver integrated around a hollow axis.',
    mechanismCaption:
      'Internal mechanism: the housing and both covers are hidden; other parts retain their assembly relationships.',
    reset: 'Reset view',
    hint: 'Drag to orbit · Scroll to zoom · Select a part for details',
    loading:
      'Preparing the 3D view. Part details, the flow diagram and separation control are available.',
    keyboardTitle: 'Keyboard controls',
    keyboard:
      'Arrow keys orbit, plus and minus zoom, Home resets the view. Tab moves between parts and flow nodes; Enter or Space selects. Arrow keys adjust separation.',
    parts: 'Select a part',
    selected: 'Selected part',
    role: 'Role',
    features: 'Features',
    material: 'Example material',
    noJs: 'Static schematic. All part details remain below; enable JavaScript for linked selection and separation.',
    allParts: 'All parts',
    staticMode:
      'The image retains the default explosion; the 2D layer diagram follows separation and selection',
    fallback: 'Static mode.',
    fallbackReason:
      'Respecting reduced motion or device resources; part selection, the flow diagram and 2D separation remain available.',
    loadFailure:
      'The 3D view is unavailable; part selection, the flow diagram and 2D separation remain available.',
    staticAlt:
      'Original hollow robot joint exploded schematic showing a motor, harmonic reducer, dual encoders, brake, driver board, bearing, housing and covers.',
    separation: 'Exploded separation',
    assembled: 'Assembled',
    exploded: 'Exploded',
    separationNote:
      'Separation changes display spacing only. It does not simulate operation, transmission or manufacturing tolerance.',
    flowTitle: 'Power, torque and feedback',
    flowIntro: 'Select a node to locate its corresponding part in the module.',
    flowAlt:
      'The DC bus supplies the driver and motor. The motor drives the output through a reducer. Motor and output encoders each feed back to the driver; the driver controls brake release.',
    dcBus: 'DC bus',
    external: 'External supply',
    driver: 'Driver board',
    motor: 'Motor',
    reducer: 'Harmonic reducer',
    output: 'Mechanical output',
    motorFeedback: 'Motor encoder',
    outputFeedback: 'Output encoder',
    brake: 'Fail-safe brake',
    power: 'Electrical power',
    mechanical: 'Mechanical torque',
    feedback: 'Feedback signal',
    control: 'Brake control',
    flowPowerNote:
      'Solid: power; thick solid: torque; dashed: feedback; dash-dot: brake control. Arrows show nominal motoring direction; regenerative operation is omitted.',
    contextDriver:
      'The driver converts the external DC supply into motor phase currents and receives both encoder signals. The unmodeled DC bus is an external boundary; selecting it locates the driver input.',
    contextMotor:
      'The motor node includes stator and rotor. The stator establishes the rotating field; the rotor transmits torque to the reducer. Selecting either part highlights this node.',
    contextReducer:
      'The reducer connects the motor to the mechanical output. This view explains integration and function; it has no transmission animation or ratio and load calculation.',
    contextOutput:
      'The output flange is the mechanical interface. The output encoder measures position on this side; it does not carry drive power.',
    contextMotorEncoder:
      'The incremental encoder feeds relative motor position and speed to the driver. The initial electrical-angle reference or auxiliary commutation signals are omitted. The dashed path carries feedback, not power.',
    contextOutputEncoder:
      'The output encoder feeds output position to the driver. It measures a different location from the motor encoder; the dashed line is feedback.',
    contextBrake:
      'The schematic uses a spring-applied, electrically released holding brake. The control line permits release; power-off holding follows a controlled stop. No emergency-stop capability or safety rating is implied.',
    contextNeutral:
      'This part supports structure, bearings or heat transfer rather than a power or signal node. The flow stays neutral while the model and part details remain linked.',
    staticSeparation: '2D layer schematic',
    staticSeparationAlt:
      'Fourteen simplified axial layers. Spacing follows the slider and the selected part is highlighted. Internal mode hides the housing and covers.',
    modelScope: 'Original generic topology · hollow integration · no transmission animation',
    assumptions: 'Model and system boundaries',
    geometryNote:
      'Coaxial rings and simplified local features describe integration. The reducer is one functional assembly; teeth, windings, magnets, electronics and crossed rollers are schematic.',
    hollowNote:
      'The central opening expresses a routing intent. Cables, seals, fasteners and connectors are omitted. Assembly order and separation distances serve readability only.',
    brakeNote:
      'The brake represents power-off holding as a functional topology. Actual brake and safety circuits depend on load, stopping sequence and risk assessment; this is not a wiring or safety design.',
    limitsNote:
      'Torque, thermal balance, stiffness, life, control performance and safety ratings are not calculated. Materials are generic placeholders, with no vendor, grade or manufacturing process specified.',
    provenance:
      'Original parametric teaching model, without vendor CAD, shape or dimension replication. Static images and interactive geometry use the same model-generation process.',
  },
} as const;
export function robotJointModes(locale: RobotJointLocale) {
  const copy = robotJointCopy[locale];
  return (['whole', 'mechanism'] as const).map((id: RobotJointMode) => ({
    id,
    label: copy[id],
    caption: copy[`${id}Caption`],
    showLabels: true,
  }));
}
