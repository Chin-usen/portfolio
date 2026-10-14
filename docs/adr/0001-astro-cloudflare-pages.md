# ADR 0001：使用 Astro + Cloudflare Pages

- 状态：已接受（2026-10-14）

## 背景
站点以内容为主，另有少量重交互（3D、仿真）。需要首屏快、双语、免费托管，并能通过 PDF 二维码长期访问。

## 决策
- 框架：Astro（静态输出，交互组件按"岛"按需加载），TypeScript。
- 3D 与动效：Three.js、GSAP、Lenis。
- 托管：Cloudflare Pages，免费子域 `chin-usen.pages.dev`；PR 自动预览。

## 备选与理由
- Next.js：对内容站偏重。
- ChatGPT Sites：公开测试版，有用量限制，无明确代码导出。
- GitHub Pages / Vercel：国内访问稳定性较差。

## 后果
以后如购买自有域名，可在 Cloudflare 绑定，并从 pages.dev 跳转，二维码不失效。
