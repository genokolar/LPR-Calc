# LPR 利息计算器

民间借贷 LPR 利息计算工具，支持普通计息与还款冲抵（超额利息折抵本金）两种模式。

## 功能

- **普通计息**：一年期/五年期 LPR、分段 LPR、平均 LPR、起始月/截止月 LPR、自定义利率
- **还款冲抵**：多笔还款逐笔冲抵，利息超付折抵本金，不足累计欠息，可续计至指定截止日
- 利率倍数（如 4 倍）、天数算法（两头都算/算头不算尾）、天数基准（365/360）
- LPR 数据每月随构建自动更新（每月 20-24 日），亦可在「LPR数据管理」中手动维护

## 技术栈

React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui

## 开发与构建

```bash
npm install
npm run dev    # 本地开发
npm run build  # 生产构建（输出 dist/）
```

## LPR 数据更新（GitHub Actions）

`.github/workflows/deploy.yml` 每月 20-24 日定时触发：
`scripts/fetch-lpr.mjs` 从东方财富抓取自上次构建后新公布的全部 LPR 期次，
合并写入 `public/lpr-history.json` 与 `public/lpr-latest.json` 并提交回仓库。

## 移动端

本应用可作为纯 Web 使用（响应式），也已打包为 Android APK（TWA/WebView 套壳）。

## 免责声明

计算结果仅供参考，不构成法律意见。民间借贷利率以合同约定及司法保护上限为准。
