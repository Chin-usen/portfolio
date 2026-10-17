---
lang: 'zh'
translationKey: 'pin-fin-cooler'
title: 'Pin-fin 散热器仿真'
kind: 'simulation'
summary: '针翅冷板：用管束经验关联式估算热阻与压降，扫描流量、针径、间距与排布的权衡。'
basis: 'Zukauskas 换热与 Gaddis–Gnielinski 压降关联式、等截面直肋效率；非 CFD。'
status: '经验关联式 · 适用范围实时检查'
order: 6
parts:
  - id: 'base-plate'
    name: '底板'
    secondaryName: 'Base plate'
    short: '底板'
    role: '承接器件热量，并以针根与未被覆盖的底面向冷却液散热。'
    features: '热阻以底板上表面（针根）为起点；底板导热与热扩展未计入。'
    material: '无氧铜或铝合金'
    order: 0
  - id: 'pin-array'
    name: '针翅阵列'
    secondaryName: 'Pin-fin array'
    short: '针翅'
    role: '扩展换热面积，并扰动流动以提高换热系数。'
    features: '圆柱针，顺排或叉排；按等截面直肋、针顶绝热计算肋效率。'
    material: '与底板相同，钎焊、铲齿或增材制造'
    order: 1
  - id: 'cover'
    name: '盖板与侧壁'
    secondaryName: 'Cover and side walls'
    short: '盖板'
    role: '封闭流道，使冷却液从针间通过。'
    features: '假设贴合针顶且无旁通；盖板与侧壁按绝热处理。'
    material: '铝合金、铜或工程塑料'
    order: 2
  - id: 'inlet-manifold'
    name: '入口集流腔'
    secondaryName: 'Inlet manifold'
    short: '入口'
    role: '把来流沿宽度方向分配到针翅阵列入口。'
    features: '假设分配均匀；集流腔与接头压降未计入。'
    material: '铝合金或工程塑料'
    order: 3
  - id: 'outlet-manifold'
    name: '出口集流腔'
    secondaryName: 'Outlet manifold'
    short: '出口'
    role: '汇集流出阵列的冷却液并引向出口接头。'
    features: '出口温度由能量平衡给出；局部损失未计入。'
    material: '铝合金或工程塑料'
    order: 4
---

原创通用参数化示意。冷板几何、材料与默认工况均为教学用占位值，不对应任何厂商产品；结果为经验关联式估算，不能替代试验或 CFD。
