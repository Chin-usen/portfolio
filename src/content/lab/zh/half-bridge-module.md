---
lang: zh
translationKey: half-bridge-module
title: SiC 半桥功率模块
kind: teardown
summary: 叠层母排互联与栅极键合线引出；两组四芯片并联，联动查看装配、拓扑与电感趋势。
basis: 参数化示意模型，几何经简化。
status: 交互模型
order: 1
---

## 模型边界

每个桥臂含四颗并联 SiC MOSFET，共八颗；体二极管属于 MOSFET，不额外配置二极管芯片。直流电容位于模块外。

## 换流与电感

SH 开通与 SL 体二极管反向恢复构成所示瞬态回路；不表示上下桥臂持续同时导通。平行板近似仅比较母排几何趋势，忽略边缘效应、端子及芯片内部电感。
