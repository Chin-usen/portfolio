# Sample Engineer portfolio - 1.3.0

The main v4 release follows the supplied N1 navigation and page structure. Home is a viewport-height hero with a static responsive module image. Work contains the black metrics band and three linked placeholder cases; Lab has its full list; About ends with Contact. Chinese and English routes share the same behavior. Career text, identity, figures and contact details remain fictional placeholders.

The 52 px sticky header selects the current parent section. Below 768 px its native dialog provides a fullscreen menu, keyboard containment, Escape, scroll lock and focus return. Astro ClientRouter updates page titles and moves focus to the destination heading; the transition respects reduced motion. Legacy `/contact/` and `/en/contact/` redirect to the localized About contact section. With static output these routes use generated redirect HTML; hosts may additionally map permanent HTTP redirects.

- `src/content/`: localized copy and placeholder cases, validated by Content Collections.
- `docs/`: 14 immutable upstream documents, byte-identical to approved v3. Original provenance is in `reports/v3/design-source-manifest.json`.
- `thermal-p2/`: all 67 tracked files of the independent P2 2.0.0 package remain unchanged. Frontend changes do not expand the numerical model's validity.
- `scripts/power-module-scene.mjs`: reproducible native Three.js illustration source. Home uses existing light/dark WebP assets and requires no WebGL.
- `scripts/subset-thermal-fonts.py`: optional reproducible S1 Chinese font generation and exact-outline/provenance checking. The four checked-in fonts total 103,192 bytes; normal Node-only builds use the checked-in assets. Shared-page Chinese subsets are regenerated from current v4 copy; early preloads reduce heading font discovery delay while retaining original licensed coverage and fallback.
- `CHANGELOG.md`: changes, including the explicitly authorized dark background token exception. No immutable design document is edited.
- `RELEASE-v4.md`: current validation and delivery guide. New generated v4 evidence accompanies the delivery outside the tracked source tree; `reports/v3/`, `reports/v2/` and older release files are historical evidence only.

No animation library is added. Three.js and Lenis remain lazy where used. S1 releases contexts, renderer resources, animation work and registered handlers on route departure; the browser regression records ten same-document round trips, renderer counters and heap samples where supported. These are bounded diagnostic measurements, not a proof about every browser's garbage collector.

This delivery is local source for human review. It does not publish to GitHub or Cloudflare, and local checks are not hosted GitHub Actions results. The separate bold experiment remains untouched.

# P3 芯片结温交互实验页

本包提供完整 P1 网站加 P3 仿真页面的源码、模型、测试与报告；运行 pnpm build 生成 dist。先读 [P3 功能与模型说明](P3-IMPLEMENTATION.md)，以下为保留的脚手架运行与部署说明。

# P1 — 中英双语作品集脚手架

这是只含虚构占位内容的静态工程脚手架。人物统一为「示例工程师 / Sample Engineer」。样式只提供布局、可访问性和 CSS tokens；视觉设计可直接替换 `src/styles/tokens.css` 与基础结构样式。

## 环境与开始

- Node **22.23.3**（`.node-version`、`.nvmrc`）；整个项目限定 Node 22。
- pnpm **12.11.2** (`packageManager`); Astro is pinned to **7.3.8**.
- TypeScript **6.0.3**、`astro/tsconfigs/strict`、`strict: true`。没有 React 或 Vue。

```sh
# 已安装 Node 22 后，使用 Corepack 或安装固定版 pnpm：
npm install --global pnpm@12.11.2
pnpm install --frozen-lockfile
pnpm dev
```

开发地址由 Astro 控制台显示，默认 `http://localhost:4321`。此项目使用资源分包与多页面路由，需通过 HTTP 服务器查看，不支持双击单个 HTML 完整预览。

```sh
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm preview
pnpm security:scan
pnpm lhci
```

`pnpm test` 顺序运行单测与冒烟测试。Playwright 会自行构建并启动本地静态服务器。Lighthouse CI 需要本机 Chrome/Chromium；必要时通过 `CHROME_PATH` 指向其可执行文件。报告仅写本地目录，不上传公开报告服务。

## 目录与内容

- `src/pages/`：中文默认页面与 `en/` 英文页面。
- `src/layouts/BaseLayout.astro`：title、description、OG、canonical、hreflang。
- `src/components/`：导航、语言切换、页脚、卡片、指标、邮箱组件及最小交互示例。
- `src/i18n/`：UI 字典及路由工具；`src/lib/`：内容选择与排序工具。
- `src/content/work/{zh,en}/`：职业案例 Markdown；`src/content/lab/{zh,en}/`：实验 Markdown。
- `src/content/profile/zh.yaml` 与 `en.yaml`：每种语言各一个个人信息文件。
- `src/content.config.ts`：Content Collections 与 Zod schema。
- `src/styles/tokens.css`：颜色、字体、间距变量占位。
- `tests/unit/`、`tests/e2e/`：工具函数和浏览器冒烟测试。
- `.github/workflows/`：质量门禁、提交格式与敏感信息扫描。

Markdown 正文是集合条目的原生 body，通过 Astro `render()` 渲染，不在 frontmatter 重复保存。中英文文件分开维护，同一内容使用相同 `translationKey` / slug；新增案例或实验时同时添加两种语言。`order` 决定显示顺序，`metrics` 是 `{ label, value, note }` 对象数组。实验的 `kind` 只能是 `teardown` 或 `simulation`；`basis` 应写明真实依据及证据边界。占位指标不代表实测数据。

## 路由与语言

中文：`/`, `/work/`, `/work/sample-case/`, `/work/career-case-b/`, `/work/career-case-c/`, `/lab/`, `/lab/sample-teardown/`, `/lab/sample-simulation/`, `/lab/chip-junction-temperature/`, `/about/`, `/contact/`, `/404/`。

英文：上述路径增加 `/en/` 前缀，首页为 `/en/`。规范 URL 采用尾斜杠。语言切换保留页面种类与 slug；每页生成 `zh`、`en`、`x-default` 的 hreflang。404 模板保留双语，但真正不存在的 URL 应返回 **404**，不能为了“每个路由 200”而返回成功码；冒烟测试分别检查正常路由与错误语义。

## 交互与隐私

Header 手机菜单支持键盘与 Escape。邮箱由独立 user/domain 字段在浏览器运行时拼接；静态 HTML 不含完整邮箱。这只是降低直接抓取便利性，不是加密；执行 JavaScript 的访问者仍能读取公开邮箱。

Three.js and Lenis are installed for on-demand demonstrations and the S1 viewer. The animation demo uses the browser Web Animations API without an animation-library dependency. There are no analytics, tracking, remote fonts or third-party external scripts. Optional Lenis React/Vue peers are neither installed nor used.

## Cloudflare Pages（纯静态）

本项目 `output: 'static'`，不需要 Cloudflare adapter、Functions 或其他服务端。

| 设置      | 值                                                  |
| --------- | --------------------------------------------------- |
| 根目录    | 仓库根目录（或此文件夹所在子目录）                  |
| 构建命令  | `pnpm build`                                        |
| 输出目录  | `dist`                                              |
| Node 版本 | `NODE_VERSION=22.23.3`（同时提供 `.node-version`）  |
| pnpm 版本 | `PNPM_VERSION=12.11.2`（同时提供 `packageManager`） |
| 生产域名  | `SITE_URL=https://你的正式域名`，只填 origin        |

如构建环境没有自动安装匹配的 pnpm，可关闭自动依赖安装并采用固定安装步骤；常规情况下保留 Cloudflare 自动安装即可。请先在预览部署核验构建日志使用 Node 22 与固定 pnpm。正式发布前必须替换 `SITE_URL`；当前 canonical/OG/hreflang 指向 `https://example.com` 占位。

该包提供部署配置与说明，尚未连接 Cloudflare 账户或实际发布。GitHub Actions 负责质量验证，不包含部署凭据或自动部署授权。

## 提交与 CI

提交信息使用 Conventional Commits，例如 `feat: add sample case`、`fix: preserve locale links`。本地可用 `pnpm commitlint --edit .git/COMMIT_EDITMSG` 校验；CI 会检查提交格式。

质量 job 执行 install → lint → typecheck → tests → build → Lighthouse CI。移动端门槛：Performance ≥ 90、Accessibility ≥ 95、SEO ≥ 95。Lighthouse 的数值会受机器与后续内容影响；应保留 CI 硬门槛，修改设计后重新验证。

敏感信息 job 使用 gitleaks 与自定义扫描。脚本扫描中国手机号模式、生日字段中的日期，以及 `BLOCKED_KEYWORDS` 的逗号分隔关键词；输出只显示文件和规则，不输出命中内容。请在 GitHub 仓库 **Actions secrets** 设置 `BLOCKED_KEYWORDS`。不要把关键词写入仓库、前端环境变量或日志。fork PR 通常不能读取仓库 secrets，需按工作流提示由受信任环境补做关键词检查；禁止用不安全的 `pull_request_target` 执行陌生 PR 代码。

## 已知限制与假设

- The site uses fictional content and a generic geometric module illustration. It does not include a real career history, proprietary CAD, contact backend or CMS.
- “profile 单个 YAML”按“每语言单个文件”实现，以满足中英内容分文件；两种语言共两个 YAML。
- 内容一对一翻译使用相同 slug；不做自动翻译或不同语言 slug 映射。
- 静态国际化 404 的最终回退由托管平台决定；部署后需要再次验证中文和英文未知路径。
- All current declared dependency licenses are open-source; see `DEPENDENCIES.md` for exact installed versions and license metadata. Historical reports may still describe the removed GSAP package.
- `@astrojs/check` 和 typescript-eslint 尚不支持 TypeScript 7，故固定兼容的 TypeScript 6，而非盲目使用其 latest。
- Use `RELEASE-v4.md` and the external v4 evidence included in this delivery for current local validation. Older release files and tracked reports describe historical releases; providing CI configuration does not mean hosted CI has run.

## 参考

- [Astro 国际化路由](https://docs.astro.build/en/guides/internationalization/)
- [Astro 内容集合](https://docs.astro.build/en/guides/content-collections/)
- [Cloudflare Pages 构建设置](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages Astro 指南](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)
