# 得月 / De Lune 供应商移动订单工作台

## 产品与架构边界

这是一个独立构建、只面向手机的白标 Vendor Web App。界面默认中文“得月”、英文/韩文“De Lune”，可用环境变量随时替换；页面不显示 BeloveD 或 Diamond D。它可以使用独立域名，但继续复用主项目的 Express/PostgreSQL 后端。

产品身份模型按当前决定实现为“一个 Vendor = 一个登录账号”，没有 Vendor 组织与成员两层。管理员创建 Vendor、生成一次性邀请链接并分配订单；Vendor 设置密码后使用独立 Cookie 登录。后端始终从 session 获取 `supplier_id`，不接受前端指定 vendorId。

Vendor 只看到被分配订单的生产字段。客户姓名、邮箱、电话、地址、零售价、付款记录、内部利润和管理备注不会进入 Vendor API 响应。

## 技术栈

- 手机端：React 19、Vite 7、三语 i18n。
- API：现有 Express 4 服务，新增 `/v1/vendor` 与 `/v1/admin/suppliers`。
- 数据库：现有 PostgreSQL；迁移 `0016_supplier_portal.sql`。
- 上传：现有 AWS S3 SDK 签发短期 PUT URL，支持腾讯云 COS 和原有 Cloudflare R2。

## 腾讯云 COS

中国 Vendor 上传建议使用广州地域 COS。后端已支持 COS 的 S3 兼容 Endpoint：

```text
VENDOR_MEDIA_PROVIDER=cos
COS_REGION=ap-guangzhou
COS_BUCKET=delune-vendor-<APPID>
COS_ACCESS_KEY_ID=<SecretId>
COS_SECRET_ACCESS_KEY=<SecretKey>
COS_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com
COS_PUBLIC_URL=https://media.example.com
```

SecretId/SecretKey 只放 API 服务环境变量，不能放进 `VITE_*`。上传 URL 有效期 10 分钟，视频最大 30MB；Vendor 文件 key 为 `vendor/<supplierId>/<scope>/<date>/<random>.<ext>`。

你还需要在 COS 控制台配置一条 CORS 规则：Origin 填 Vendor 网页的准确域名（不要用 `*`），Method 允许 `PUT`，Allowed-Headers 可填 `*`，Expose-Headers 建议 `ETag`。

## API 合同

| Method | Path | 用途 |
|---|---|---|
| POST | `/v1/vendor/auth/accept-invite` | 邀请 token + 新密码激活账号 |
| POST | `/v1/vendor/auth/password` | 邮箱密码登录 |
| POST | `/v1/vendor/auth/logout` | 注销当前 session |
| GET | `/v1/vendor/me` | 当前 Vendor |
| GET | `/v1/vendor/orders` | 只列出当前 Vendor 的订单 |
| GET | `/v1/vendor/orders/:code` | 脱敏订单详情 |
| POST | `/v1/vendor/orders/:code/updates` | 追加 NOTE/CAD/PROGRESS/QC 等记录 |
| POST | `/v1/vendor/orders/:code/stage` | ACKNOWLEDGE 或 HANDOFF_READY |
| POST | `/v1/vendor/media/upload-url` | 签发当前 Vendor 的 COS PUT URL |
| GET/POST | `/v1/vendor/inventory` | 当前 Vendor 裸钻库存 |
| PATCH | `/v1/vendor/inventory/:id` | 修改自己的库存 |
| GET/POST | `/v1/admin/suppliers` | 管理员查看/创建 Vendor |
| POST | `/v1/admin/suppliers/:code/invites` | 生成一次性邀请链接 |
| POST | `/v1/admin/orders/:code/supplier` | 分配订单 |

## 数据库

迁移新增 `suppliers`、`supplier_invites`、`supplier_order_assignments`、`supplier_updates`、`supplier_inventory`，并把 `supplier` 加入现有通用 session 类型。每一条订单分配、更新和库存都以 `supplier_id` 隔离。

不需要在数据库控制台手工建表。只要生产环境已有正确的 `DATABASE_URL`，部署时运行：

```bash
npm run db:migrate
```

## 上线配置

1. PostgreSQL 设置 `DATABASE_URL` 并执行迁移。
2. API 设置 `PUBLIC_ORIGIN`、`VENDOR_ORIGIN` 以及 COS 环境变量。
3. Vendor App 设置 `VITE_DEMO_MODE=false`、`VITE_VENDOR_API_URL=<API 地址>` 和白标名称。
4. 管理员创建 Vendor、复制邀请链接给对方，再为其分配订单。
5. 先用少量真实订单灰度，核对腾讯文档中的字段后再迁移历史数据。
