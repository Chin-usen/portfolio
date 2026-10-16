# P2 v2 · 三维热传导 FEM 与浏览器代理模型

本目录包含真正运行过的 500 组三维稳态导热 FEM 数据、求解源码、收敛证据，以及代理模型训练与浏览器推理代码。FEM 使用开源 NumPy/SciPy 自定义 Q1 六面体单元；没有用解析热阻公式冒充 FEM。

先看 [REPORT.md](REPORT.md) 获取结果与证据索引，详细物理假设、矩阵组装和数据坐标约定见 [SOLVER-REPORT.md](SOLVER-REPORT.md)。代理模型最终是否达到精度、大小和耗时目标，以 `reports/surrogate-validation.json` 和 `reports/typescript-validation.json` 的实际验收标志为准。

## 直接查看交付结果

- `data/parameters.csv`：500 组、12 个物理参数和固定 400/100 训练/测试划分。
- `data/samples.csv`：每个 FEM 样本的最大/平均结温热阻、残差、热平衡及独立解析对照。
- `data/samples.npz`：不可变的训练源数据，场为 Float32。
- `data/samples-float16.npz`：压缩后的同构交付数据，仅场数组转为 Float16；量化误差已单独验证。
- `models/`：代理模型 JSON 与 Float16 POD 基底。
- `web/evaluator.ts`：浏览器端、无运行时第三方依赖的模型评估器。
- `reports/`：真实收敛、数据校验、模型验证及图表。

温度场为真实三维 FEM 解的 y=0 中心截面，单位 K/W。实际温度为 `T_cool + P × field`。场使用逐层固定 η 网格，**z 方向不是均匀间距**；需要读取 `field_z_mm`，或者用 `field_layer`/`field_eta` 与当前厚度还原。不要把零掩膜区域当作材料。

## 本机复现

已验证环境为 Python 3.12.10。首次准备环境：

```text
python -m venv .venv
```

Windows：

```text
.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
.venv\Scripts\python.exe scripts/reproduce.py
```

macOS / Linux：

```text
.venv/bin/python -m pip install -r requirements-lock.txt
.venv/bin/python scripts/reproduce.py
```

最后一条命令完整执行：单元解析校验 → 三档及以上网格收敛 → 500 FEM 样本 → 数据/Float16 校验 → 代理模型训练。每个 FEM 样本会保存检查点，原主机上平均直接求解约 1.21 秒/样本；不同机器和平台运行时间会变化。恢复时必须保持参数、网格与求解器版本一致。不要同时启动两个数据集写进程。

使用已交付数据重新训练，无需重复 FEM：

```text
python scripts/reproduce.py --reuse-data
```

仅检查交付数据：

```text
python scripts/reproduce.py --verify-only
```

若 PATH 中有 Node 22，可增加 `--check-web`，或单独运行：

```text
node --experimental-strip-types web/test.mjs
```

入口不会把“成功生成文件”等同于“达到验收指标”：Python 入口检查平均/最大相对误差和文件大小验收标志；Node 测试继续检查 Python/TypeScript 一致性、独立抽取的测试样本和推理耗时，失败会返回非零退出码。

## Docker 复现配置

Dockerfile 固定了 Python 3.12.10 官方多架构镜像摘要；直接依赖及传递依赖版本见 `requirements-lock.txt`。

```text
docker build -t thermal-p2 .
docker run --rm thermal-p2
```

默认容器内重新计算并训练。需要把生成的结果保存在本机，可将当前目录绑定到 `/work`，例如 macOS / Linux：

```sh
docker run --rm --mount type=bind,source="$(pwd)",target=/work thermal-p2
```

本次已核实官方镜像摘要，但本地 Docker Linux daemon 未启动，构建尝试被其缺失的管道阻断。**Docker 构建和容器运行未在本机验证**；已验证的是完整原生 Python FEM 和数据校验流程。跨平台浮点求解及归档字节不要求逐字节相同，应比较固定输入、网格与数值容差。

## 科学边界

此模型假设材料均匀各向同性、导热系数恒定、理想接触、稳态、均匀芯片热流，且利用了四分之一对称域。没有接触热阻、流体求解、辐射、瞬态或实验校准。三档网格的 <0.5% 结温热阻变化仅在规定的参数中点验证，不能当成整个参数域任意局部温度梯度的严格误差上界。

解析模式在默认点得到 125.6 °C；真实 FEM 在同样 100 W/65 °C 下得到最大 114.27 °C、表面平均 108.48 °C。两者不是同一模型，不应为了匹配显示目标而改动 FEM 数据。代理模型应标明其 FEM 来源、适用参数范围及实际留出集误差。

打包时排除 `.venv/`、`checkpoints/`、`__pycache__/`、日志和 `data/samples-preview.npz`。保留源码、锁定依赖、数据、最终模型、验证报告与许可文件。

## TypeScript / Vitest 自包含验证

Node 22、pnpm 12.11.2；本目录包含独立 package.json、pnpm-lock.yaml、tsconfig.json，不依赖其他项目文件夹：

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm verify
pnpm verify:linearity
```

固定 Vitest 5.0.4、Vite 8.3.4、TypeScript 6.0.3。30 个测试实际通过，其中包括固定 seed 20261017 随机抽出的 20 个留出 FEM 样本及全 100 例验收。详细方法、最终数值与复用留出集的审计边界见 [SURROGATE.md](SURROGATE.md)。默认训练入口自动先进行 400 训练例的三折交叉验证，再重新拟合并导出；模型运行时没有第三方依赖。

## v2 数据追溯与线性复核

本版保留全部 500 组数据与最终模型，新增 6 项 P/T_cool 仿射关系测试及独立 FEM 边界载荷复核。结果、运行命令、浮点容差和复用留出集限制见 [V2-VALIDATION.md](V2-VALIDATION.md)；版本变化见 [CHANGELOG.md](CHANGELOG.md)。执行 `python scripts/audit_v2.py` 可复查数据来源、划分和 15 个 FEM 载荷场景，无需重新训练。

### v2 实体网格导出

除参数化网格生成器外，本包直接提供 `data/mesh-l3-quarter.npz`（24,897 节点 / 21,648 六面体）及 `reports/mesh-export-v2.json`。字段和所有样本的物理坐标重建方法见 `V2-VALIDATION.md`；再生成命令为 `python scripts/export_mesh.py`。
