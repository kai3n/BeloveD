# BeloveD Vendor Mobile

面向中国供应商的手机订单工作台原型。它独立于消费者站点，通过受限 Vendor API 与现有 BeloveD Express/PostgreSQL 后端连接。

## 运行

```bash
corepack enable
pnpm install
pnpm dev
```

默认是可完整点击的演示数据。复制 `.env.example` 为 `.env`，将 `VITE_DEMO_MODE=false` 后切换到真实 API。

真实模式包含邀请激活、邮箱密码登录、自助密码重置、当前 Vendor 自己的订单与库存。一个 Vendor 对应一个登录账号，没有额外的组织/成员层。

数据库继续使用主项目的 `DATABASE_URL`，新增表由迁移自动创建：

```bash
cd ../..
npm run db:migrate
```

## UI 品牌配置

Vendor 页面采用白标配置，默认中文显示“得月”，英文和韩文显示“De Lune”。部署时可通过环境变量替换，不需要修改组件：

```text
VITE_VENDOR_BRAND_ZH=得月
VITE_VENDOR_BRAND_EN=De Lune
VITE_VENDOR_BRAND_KO=De Lune
VITE_VENDOR_MARK_ZH=得
VITE_VENDOR_MARK_EN=DL
VITE_VENDOR_MARK_KO=DL
```

配置入口位于 `src/brand.js`。内部 API 名称不影响 Vendor 界面显示。

## 预览

本地开发预览：

```bash
cd apps/vendor-mobile
corepack enable
pnpm install
pnpm dev
```

打开 `http://127.0.0.1:5174/`。

GitHub Pages：仓库 `main` 分支部署成功后，打开：

```text
https://kai3n.github.io/BeloveD/vendor/
```

`.github/workflows/deploy.yml` 会先构建主站，再把本 App 构建到 Pages 的 `/vendor/` 子目录。Pages 版本固定使用演示数据，不会调用生产订单 API。

Vercel Production 的根目录执行 `npm run build` 时，会把本 App 以真实模式构建到主站 `dist/vendor/`。因此生产入口与 API 同源：

```text
Vendor App: https://belovediamond.com/vendor/
Vendor API: https://belovediamond.com/v1/vendor/*
```

这个构建会固定使用 `VITE_DEMO_MODE=false` 和空的 `VITE_VENDOR_API_URL`（即 same-origin），不需要为 Vendor 前端新增生产 API 地址变量。API 环境仍需设置 `VENDOR_ORIGIN=https://belovediamond.com` 与 `VENDOR_APP_URL=https://belovediamond.com/vendor/`。

## 已实现的原型范围

- 今日工作台：待响应、制作中、待质检、可用裸钻
- 订单列表：搜索、状态筛选、SLA/交期提示、新消息
- 订单工作区：匿名客户、规格、时间线、客户反馈、制作记录
- 手机上传：CAD、制作进度、成品 QC 照片/视频
- Vendor diamond pool：库存状态、证书、成本、媒体、添加裸钻
- 账号、通知、语言与隐私入口
- 一小时有效的一次性密码重置链接；其他已登录设备保持登录
- 演示/真实 API 双模式

## 真实环境联调前提

GitHub Pages 版本固定为 Demo，不能测试注册、登录或密码重置。真实联调至少需要：

这些配置不是全部用于“连接数据库”，应按测试范围拆开：

1. **只连接数据库**：设置 `DATABASE_URL`，运行 `npm run db:migrate`（包含 `0016`、`0017`）。
2. **本地测试真实账号**：同时运行 PostgreSQL、Express API、Admin 页面和 Vendor App；Vendor 构建设置 `VITE_DEMO_MODE=false` 与 `VITE_VENDOR_API_URL=http://127.0.0.1:8787`。
3. **让邀请链接跳到正确页面**：API 设置准确的 `VENDOR_ORIGIN`，以及可含子路径的 `VENDOR_APP_URL`。
4. **测试真实收件箱**：配置 `RESEND_API_KEY` 与已验证的 `MAIL_FROM`；不配置时邮件进入本地开发 sink，数据库和账号功能仍然可以测试。
5. **测试真实文件上传**：另外配置 COS 凭证、公开媒体域名和准确的 CORS Origin；这不是注册、登录或密码重置的前提。
6. **让外部 Vendor 远程测试**：部署 API 和真实模式 Vendor App，并使用 HTTPS。Admin 的 Vendor 页面可创建账号、自动发送邀请、复制备用链接、查看激活状态和分配订单。

如果 Vendor App 与 API 使用不同站点域名，需要额外验证浏览器第三方 Cookie 策略。正式环境优先使用同一主域名下的子域名，并全程 HTTPS。

更详细的架构与后端接口见 [docs/product-design.md](docs/product-design.md)。
