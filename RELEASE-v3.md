# 主线 v3 · 1.2.0

本版按提供的 D1 示意稿重做首页，并将 S1 改为“顶部测量栏、左模型、右参数”的桌面布局。中英文、手机和深色模式同步实现。职业标题、案例和指标仍是明确的占位内容；首页 S1 卡片的温度由现有解析模型实时计算。

## 本版内容

- 首页采用 52 px 导航、88 / 38 px 两行标题、蓝色文字链接、三端子功率模块、纯黑数据区块、28 px 圆角实验卡片和占位页脚。
- 模块图保留 Three.js 原生几何源码与可复现渲染脚本，输出 4 张浅/深色响应式 WebP；首页显示静态图，无需 WebGL。
- S1 保留解析 / FEM 代理、材料预设、选中层信息、温度色标、热阻分解、剖面、爆炸、复位、键盘和 2D 回退。对流项现在定位到工况/h；色标旁直接说明温度场的解释边界；放大文字后的长警告不会遮住参数。
- GSAP 已从依赖图移除，示例改用原生 Web Animations API，保留减弱动效处理。
- 首页内容由 Content Collections 校验。L1 / L3 / S3 明确标为尚未实现的概念预览。
- 中文字体仅调整加载分组，保留原 Noto 字体、真实字重、字形轮廓和度量；12 个字体资源通过校验，新字符保留原字体回退。S1 再通过页面 head 预加载既有字体，未改变字体文件、CSS、布局或数值模型。
- 14 个上游文档与参考图逐字节保留；来源见 `reports/v3/design-source-manifest.json`。

## 验收入口与当前记录

`reports/v3/comparison.html` 提供首页 / S1 × 中文 / 英文 × 1440 / 390 × 浅 / 深色的 16 状态对照，最终图片均经过人工视觉检查。`reports/v3/README.md` 汇总测试、审查与来源。

独立审查原始评分为 A **26/40 → 30/40**、B **13/20 → 17/20**。修复后的复核有明确范围，并非重新盲评；原分数未被追溯上调。11 px 手机指标说明遵循原始 D1 要求，检测器的三条同规则警告如实保留。薄层 SVG 仍需精确点选，旁边有等价的 44 px 图例按钮；直接输入任意数值仍是后续增强项。

| 检查                 | 当前证据                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 类型检查             | 86 个文件，0 错误 / 警告 / 提示；见 `reports/v3/ci/s1-preload-typecheck.log`。                                                                                                                                                                                                                                                                                  |
| 单元测试             | 48 项通过；后续只改字体加载时序，数值模块未变。                                                                                                                                                                                                                                                                                                                 |
| 浏览器回归           | 54 项通过，22.2 秒；最终预加载版本完成 20 页生产构建，见 `reports/v3/ci/browser-release.log` 与 `reports/v3/ci/s1-all-preload-build.log`。                                                                                                                                                                                                                      |
| ESLint / 格式        | `reports/v3/ci/lint-release.log` 记录通过；汇总报告后续文字修订另由发布检查覆盖。                                                                                                                                                                                                                                                                               |
| 手机 Lighthouse 全量 | PASS: 54 retained mobile measurements across 18 routes, 3 per route; median Performance 92-100, Accessibility >= 100, SEO >= 100. Original 90/95/95 median budgets and Lighthouse assertion engine passed. Same-source interrupted collection resumed without replacing completed samples; see reports/v3/lighthouse/summary.json and collection-sessions.json. |
| 最终安全与 Gitleaks  | PASS: phone/birthday scan (482 text files at the recorded pre-finalization scan) and Gitleaks for source/history/dist. Custom blocked-keyword policy was not configured. Final report-inclusive scan is recorded in reports/v3/ci/security-release.log; exact archive bytes are independently scanned during packaging.                                         |
| 源码版本             | 压缩包的 `SOURCE-REVISION.json` 记录实际 commit。                                                                                                                                                                                                                                                                                                               |
| 恢复与附件记录       | 使用 `00-START-HERE.zip` 中的清单和恢复工具；实际附件回执见最终交付消息。                                                                                                                                                                                                                                                                                       |

字体分组的中文首页专项三次为 **99 / 99 / 99**，LCP 为 **1.811 / 1.808 / 2.114 秒**。随后旧源码全量尝试在 39/54 次时中断，其中中文 S1 中位性能分为 86；该记录保留在 `reports/v3/lighthouse/attempt-2/`。S1 仅预加载拉丁字体的专项为 88/88/88；最终同时预加载已使用的中文字体后为 **92/93/92**，中位 LCP 约 **3.16 秒**（3,159.561 ms）、FCP **1.274 秒**，字体传输量仍为 **354,417 字节**。这证明 S1 专项达到性能分门槛，并不证明 S1 LCP 低于 2.5 秒。专项与全量结果分开记录，失败尝试均保留。v3 的图像首页与 v2 的文字首页构图不同，不能宣称相对 v2 的 LCP 更快。

16 状态视觉图早于最后一次 S1 预加载调整。该调整仅涉及 `BaseLayout.astro` 的 head 字体加载提示；源文件比对确认其余 88 个运行时文件及 15 个字体/CSS/配套文件未变。已有视觉证据描述稳定加载后的外观，最终浏览器回归覆盖预加载后的版本；没有将旧截图冒充为重新拍摄。

## P2 与交付边界

`thermal-p2/` 2.0.0 的 67 个已跟踪文件与已交付 v2 逐字节相同；9 个数值 / 模型 / 查看器模块也未改变。新验证输出放在 `reports/v3/ci/p2-current-*`，没有覆盖既有模型和报告。复核覆盖 30 项测试、严格类型、TS / Python 一致性、负载线性、15 组新 FEM 负载求解和实际网格。

原有科学边界仍适用：100 个 holdout 在开发期间已被查看，属于重复验证，不是新盲测。Rjmax 最大相对误差 2.680149%、Rjavg 2.417713% 只描述该验证集，不能推导为全参数域误差低于 3% 或实验验证。页面继续区分解析示意、代理中央截面重建和完整 FEM 求解。

交付范围仅包含主线；bold 保持原 commit，不在本次交付范围。将全部分卷与 `00-START-HERE.zip` 放在同一目录，先解压启动包，再按其中 README 使用 Python 或 PowerShell 恢复工具。启动包清单记录分卷和完整归档的字节数与 SHA256；每个分卷的上限为 1,000,000 字节。实际源码 commit 以归档内 `SOURCE-REVISION.json` 为准，实际附件回执以最终交付消息为准；本文不预先宣称恢复或上传已完成。

本次没有推送、部署或在维护者账户执行 GitHub Actions。敏感词环境变量未配置，安全结果只覆盖启用的手机号 / 生日规则及 Gitleaks。没有宣称实体手机、跨浏览器、屏幕阅读器或整体 WCAG 认证。身份和联系方式继续使用示例内容。
