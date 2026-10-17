---
lang: 'zh'
translationKey: 'busbar-joule-heating'
title: '母排焦耳热仿真'
kind: 'simulation'
summary: 'L1 半桥 P 层、AC 连接片与 N 层的直流焦耳热：探索电流、导体尺寸、材料与对流对温度的影响。'
basis: 'FEM 训练的代理模型；电势场与稳态导热顺序耦合，常物性。'
status: '已接入 FEM 代理与三维场；解析对照与独立测试复核'
order: 7
parts:
  - id: 'p-layer'
    name: 'P 层'
    secondaryName: 'P layer'
    short: 'P 层'
    role: '把 DC+ 端子的电流分配到上桥臂衬板的漏极铜区。'
    features: '与 N 层隔绝缘膜叠放，形成低电感叠层母排；经馈电脚和立柱焊接到衬板 1。'
    material: '无氧铜或电解铜板，表面镀镍或镀锡'
    order: 0
  - id: 'ac-link'
    name: 'AC 连接片'
    secondaryName: 'AC link'
    short: 'AC'
    role: '连接上桥臂源极、下桥臂漏极与 AC 端子，构成半桥中点。'
    features: '收集条压在四个上桥臂源极夹片上，窄桥接带跨到衬板 2 的漏极铜区；两种开关状态下都通过负载电流。'
    material: '铜带或铜合金冲压件，表面镀镍'
    order: 1
  - id: 'n-layer'
    name: 'N 层'
    secondaryName: 'N layer'
    short: 'N 层'
    role: '把下桥臂源极电流汇集后引回 DC− 端子。'
    features: '收集条经立柱带绕过 P 层边缘上升，返回到叠层上层平板。'
    material: '无氧铜或电解铜板，表面镀镍或镀锡'
    order: 2
---
