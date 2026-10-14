# ADR 0003：建模与仿真只用开源工具

- 状态：已接受（2026-10-14）

## 决策
CAD：CadQuery / build123d；网格：Gmsh；求解：FEniCSx 或 Elmer（热、电、热应力），OpenFOAM（流体）；导出：glTF。

## 理由
避免商业软件授权用于个人公开项目的合规风险，并保证任何人可复现。
