# P2 代理模型：方法、验收与前端接口

最终模型以 400 个真实三维 FEM 样本训练，在固定 100 个留出样本上，Rjmax 平均/最大相对误差为 **0.5490% / 2.6801%**，Rjavg 为 **0.4566% / 2.4177%**。这组已交付样本满足平均 <1%、最大 <3% 的指标；它不构成整个连续参数域的误差保证。

**验证审计边界：**最初模型的 100 个留出结果曾被检查，最大误差未达标。后续候选选择只使用 400 个训练样本的三折交叉验证；未将留出标签加入拟合，也未根据留出样本选择候选。但最终使用了同一组 100 个样本再次报告误差，因此这是“复用的留出集”，不能称为完全未触碰的最终盲测。初次与第二次审计保留在 `reports/initial-*`、`reports/second-*`。

## 可复现训练和选择

- FEM 数据固定为 `data/samples.npz`；不生成伪 FEM 数据。LHS seed 20261014，固定 400/100 划分。
- 初步在训练集内比较二/三阶多项式岭回归、小型 tanh MLP 和 RBF/Matérn 5/2 GP，记录见初次、第二次选择报告。
- 最终 `scripts/cv_select.py` 仅读取 400 个训练标签，固定三折 seed 20261018。每折拟合约 267 个样本、验证约 133 个，比较 36 个 GP 配置。选择分数为两种热阻中较大的平均相对误差，加上 0.15 倍较大的最大相对误差；分数在读取最终留出结果前确定。
- 最终选择：12 个正参数按固定物理范围取对数映射至 [-1,1]；一阶均值趋势 + ARD RBF GP；目标是相对于平滑一维基线的加性残差。基线为 `sum(t_i / (k_i A_i)) + 1/(h A_cooler)`，采用每层实际截面积，长度转为 SI。残差乘 `k_cu / 1000` 以改善尺度。它是统计建模的基线，不是最终 FEM 本身，也不替代独立 45°/Lee 解析对照。
- GP 核超参数按各训练折边际似然优化，最终在 400 个训练样本上重新拟合。预测为 GP 后验均值，不导出/宣称置信区间。
- RBF/Matérn 5/2 对数长度尺度和噪声梯度均做过中心差分验证：最大缩放误差分别约 1.25e-8、3.42e-9，见 `reports/gp-gradient-check.json`。

三折训练外预测的平均误差为 Rjmax 0.7398%、Rjavg 0.6640%，但最大误差分别为 **8.5695% / 8.5118%**，未达到 3%。每折训练数量较少，且它用于模型选择；仍应保留此证据，不能只展示最终 100 个样本的较好结果。不得将 <3% 写成全域保证。需要强独立证据时，应另外预注册并计算新 FEM 验证集。

默认训练命令会执行三折选择，再生成最终模型：

```sh
python scripts/train.py
```

仅按已保存的最终选择重新拟合：

```sh
python scripts/train.py --reuse-selection
```

`--benchmark-single-split` 仅用于复现早期候选家族探索，不是最终选择流程。完整 FEM→训练入口见 README。

## POD 与场坐标

场是 FEM 的中心 x-z 剖面（y=0），不是完整三维场。每个样本按其 Rjmax 归一化后，在固定层内相对坐标 eta 上取 128×64 个点；所有样本的几何掩码相同，物理 z 坐标随各层厚度变化。

POD 只用 400 个训练场，减去训练均值后 SVD。8 个模态保留 **99.9288208%** 的归一化、中心化训练样本平方能量；对原始 K/W 场的投影核查保留 **99.997356%** 的未中心化平方能量。这里的“能量”是离散场向量平方范数，不是热量守恒指标。各 POD 系数由单独多输出 GP 预测。

前端基底为小端 IEEE754 Float16 二进制。解码后的实际模型在 100 个留出场上的 NRMSE（各样本以其 FEM Rjmax 归一化）平均 **0.62307%**、最大 **2.94581%**；单独 Float16 量化引入的平均/最大 NRMSE 约 **0.01009% / 0.01138%**。见 `reports/field-export-validation.json`。场误差指标与标量热阻的逐样本相对误差是不同统计量。

## 模型文件与开销

| 文件 | 含义 |
| --- | --- |
| `models/scalar-model.json` | 标量与中心轴温降代理、范围、元数据，216,323 字节 |
| `models/field-model.json` | POD 系数 GP、掩码、x/eta/层索引 |
| `models/field-basis.f16` | 训练均值及 8 个基底，每组 64×128 |

三个模型合计 **509,168 字节**，是未压缩实际文件大小。标量 JSON <300 KB，总量 <1 MB。文件大小不含开发测试工具、原始 FEM 数据和图表。

在 Intel Core Ultra 7 265、Windows、Node 22.23.3 上，预热后 1,000 次测量：仅标量 p95 **0.0302 ms**，含 8,192 点场重建 p95 **0.1262 ms**。这不是手机浏览器性能保证；模型下载和一次性解码不包含在 `evaluate()` 耗时中。原始记录见 `reports/typescript-validation.json`。

## 前端接口

`web/evaluator.ts` 在运行时没有第三方依赖。将模型加载与同步计算分开：

```ts
import { createEvaluator, decodeFieldBasis } from './evaluator';
import type { ScalarModel, FieldModel } from './evaluator';
const evaluate = createEvaluator(
  scalarJson as ScalarModel,
  fieldJson as FieldModel,
  decodeFieldBasis(fieldArrayBuffer),
);
const result = evaluate(params); // 可选 { includeField: false }
```

输入采用 P3 相同 12 个参数键，另加 `P`、`T_cool`。超出 12 参数训练边界或非有限数值会抛出 RangeError。恒定材料参数、线性边界条件下按 `T = T_cool + P * R` 缩放；不以新的 P/Tcool 重跑 FEM。

返回 `tjMax`、`tjAvg`、`rthTotal`、`layers`（由上到下）、`rConv`、可选 `field`。最大值与面积平均值是独立 FEM 目标；数值上限制平均不超过最大。各层温降代理为正，并归一化使中心轴贡献闭合到预测 Rjmax。**rConv 是中心轴底面相对冷却液温升/P 的有效贡献，不是全底面平均的 1/(hA)**；后者单独返回 `rConvAreaAverage`。不要把这些中心轴贡献解释为严格一维串联的空间平均热阻网络。

`field.values` 为摄氏度 Float32Array，`mask` 指示物理域，`xMm[128]`、`zMm[64]` 给出明确坐标；z 非均匀。几何外温度填 Tcool 仅为掩码哨兵。中心剖面沿其他方位复制/插值只是显示近似，不能称为真实三维 FEM 温度。

## 独立测试工具安装

Node 22，pnpm 12.11.2：

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm verify
```

`web/evaluator.test.ts` 包含固定 seed 20261017、不放回随机抽取的 20 个留出样本，另检查全部 100 例。**原 24 项 Vitest 实际通过；v2 新增 6 项线性验证，共 30 项通过**；随机 20 例 Rjmax 平均/最大误差为 0.47687% / 2.36195%，Rjavg 为 0.35843% / 2.10330%。Python 与 TypeScript 最大相对差 1.314e-11，中心轴闭合最大绝对差 4.44e-16 K/W。验收测试没有跳过或降低 FEM 精度阈值。

开发工具固定为 Vitest 5.0.4（MIT）、Vite 8.3.4（MIT）、TypeScript 6.0.3（Apache-2.0）、@types/node 22.20.5（MIT），只用于测试/类型检查，不进入浏览器评估器。

## 方法来源

- [Rasmussen & Williams, Gaussian Processes for Machine Learning, 第 2 章](https://gaussianprocess.org/gpml/chapters/RW2.pdf)：GP 回归后验、边际似然的主要方法参考。此项目自行实现 NumPy/SciPy 训练与 TypeScript 均值预测，没有复制书中代码。
- [SciPy SVD 官方文档](https://docs.scipy.org/doc/scipy/reference/generated/scipy.linalg.svd.html)：POD 使用的奇异值分解接口及数值后端。
- [SciPy L-BFGS-B 官方文档](https://docs.scipy.org/doc/scipy/reference/optimize.minimize-lbfgsb.html)：有界核超参数与小型 MLP 优化。

这套模型没有实验校准、接触热阻、材料温变、辐射、瞬态或流体求解。物理和 FEM 网格边界见 SOLVER-REPORT.md。
