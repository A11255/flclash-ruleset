# flclash-ruleset · 规则中心

一处维护，多端下发。`sources.json` 是唯一手工维护的文件，CI 自动把上游规则转成 mihomo 格式给 FlClash 用，Loon 端直接引用上游原始链接。

```
sources.json
    │
    ├─ CI 拉取上游规则 ─→ 分类 ─→ 跨表去重 ─→ dist/mihomo/*.yaml ─→ FlClash
    │                     ├─ 域名    → behavior: domain
    │                     ├─ IP 段   → behavior: ipcidr
    │                     └─ 关键词  → behavior: classical
    │
    └─ Loon 端直接用上游原始链接（本来就是 Loon/Surge 格式，不需要转）
```

## 地址

**FlClash（Windows / Android）** — 覆写 → 模式「脚本」→ 远程下载：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@6b5394c/dist/flclash-override.js
```

**Loon（iOS）** — 从 URL 导入配置，或把 `[Rule]` 段复制进现有配置：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@6b5394c/dist/loon/loon.conf
```

### 为什么这两个地址写的是 SHA 而不是 @main

**这两个地址几乎永远不用换。** 它们只是「外壳」：真正的规则内容在 `dist/mihomo/*.yaml`，脚本内部的 `URL_BASE` 指向 `@main/dist/mihomo/`。上游规则每天更新时，变的只是那些 yaml，**脚本和 loon.conf 一个字都不会变**。

只有当我增删规则源、调整规则顺序时，这两个文件才会变，那时才会给新 SHA。日常规则更新不需要你动任何设备。

不用 `@main` 直接取这两个文件，是因为 jsDelivr 对它们的缓存粘住了（实测 4 个镜像各返回不同版本，purge 返回 200 但内容不变）：

| 路径 | `@main` 状态 |
|---|---|
| `dist/mihomo/*.yaml` | ✅ 正常，始终最新 |
| `dist/flclash-override.js` | ❌ 卡在 5 个版本前，指向**已删除的 `ruleset/`**，会导致规则全空 |
| `dist/loon/loon.conf` | ❌ 卡在更早的 16 个 `.list` 版本 |

yaml 路径不受影响，因为它们是 `dist/mihomo/` 下的独立文件，从未被旧版本引用过，缓存里没有历史包袱。这就是「脚本钉 SHA + 规则走 @main」这个组合能成立的原因。

## 规则源

按优先级排列（`sources.json` 里的数组顺序就是生效顺序）。

| # | 名称 | 策略 | 域名 | IP | 关键词 | 说明 |
|---|---|---|---|---|---|---|
| 1 | `Reject_Rule` | REJECT | 304969 | 490 | 278 | 综合广告/跟踪拦截，最大的一张 |
| 2 | `AdBlock` | REJECT | 1212 | 10 | — | dler-io 广告表 |
| 3 | `adrules` | REJECT | 15101 | — | — | adrules.top，与 #1 高度重合，去重后仅剩独有部分 |
| 4 | `rejectAd` | REJECT | 597 | 7 | 13 | 奶思广告合集（APP/小程序广告） |
| 5 | `Adblock4limbo` | REJECT | 37 | — | — | 仅 FlClash，不进 Loon（Surge 专有格式） |
| 6 | `apple_update` | DIRECT | 5 | — | — | Apple 系统更新 |
| 7 | `Google_FCM` | DIRECT | 13 | 26 | — | Google 推送 |
| 8 | `Apple_Push` | DIRECT | 3 | 9 | — | Apple 推送 |
| 9 | `Cloudflarecn` | DIRECT | — | — | — | 仅 Loon |
| 10 | `Cloudflare` | DIRECT | — | — | — | 仅 Loon |
| 11 | `AppleAccount` | DIRECT | — | — | — | 仅 Loon |
| 12 | `AppStore` | DIRECT | — | — | — | 仅 Loon |
| 13 | `WeChat` | DIRECT | — | — | — | 仅 Loon |
| 14 | `Tencent` | DIRECT | — | — | — | 仅 Loon |
| 15 | `TestFlight` | DIRECT | — | — | — | 仅 Loon |
| 16 | `Direct_Rule` | DIRECT | 110580 | 12557 | 13 | 国内直连主表 |
| 17 | `Proxy_Rule` | PROXY | 35083 | 1014 | 55 | 需要走代理的域名 |

`—` 表示该表不含此类规则。**FlClash 侧**合计 **482072 条**（域名 467600 / IP 14113 / 关键词 359），生成 **21 个 provider / 35 条规则**；**Loon 侧 16 条 RULE-SET**（含 7 个 kelee 表）。

标注「仅 Loon」的 7 个表在 `sources.json` 里写了 `"flclash": false`。生成器**不会去下载它们**，只把链接写进 `loon.conf`。

## 转换规则

上游是三种格式混在一起的，生成器按行内容自动判断，不依赖文件后缀：

| 上游写法 | 转成 | behavior |
|---|---|---|
| `.example.com`（前导点） | `example.com` | `domain` |
| 裸域名 `example.com` | 原样 | `domain` |
| `DOMAIN,x` / `DOMAIN-SUFFIX,x` | `x` | `domain` |
| `IP-CIDR,x` / `IP-CIDR6,x` | 取 CIDR 部分 | `ipcidr` |
| `DOMAIN-KEYWORD,x` | 原样保留前缀 | `classical` |
| `USER-AGENT` / `URL-REGEX` / `IP-ASN` / `AND` 等 | **丢弃** | mihomo 不支持 |

细节：
- 前导点会被去掉。mihomo 的 `domain` provider 本身就是后缀匹配，语义和 Loon 的 `.` 前缀一致。
- 只取规则行的第一个字段，所以 `DOMAIN-SUFFIX,x,reject`（带 policy 的 Surge 写法）能正确解析。
- 注释行（`#`、`#!name=`、`;`、`//`、`!`）全部跳过。
- 不符合域名/CIDR 格式的行会计入「非法丢弃」并打印出来。

## 跨表去重

mihomo 按 `rules` 顺序匹配，先命中先生效。同一个域名在后面的表里再出现一次，行为完全不变，只是多占一份内存。

所以生成器做了一次全局去重：**按表顺序保留首次出现的那条**。实测移除 **204608 条**重复项，其中 `adrules` 的 210717 条里有 195616 条与 `Reject_Rule` 完全重复，去重后只剩 15101 条独有的。

这一步把总规则数从 686620 压到 482072，内存占用约减少三成。**行为没有任何变化**。

## 更新

```powershell
cd D:\ProgramData\WorkBuddy\2026-10-24-10-31-21\flclash-ruleset
git pull
node tools/build.js --fetch     # 本地先跑一遍看效果（--fetch 强制重下）
git add -A
git commit -m "update"
git push
```

push 后 CI 自动拉上游、重新生成 `dist/` 并提交。各端下次拉取就是新的。

本地不加 `--fetch` 时用 `_upstream/` 缓存（该目录已 gitignore，不入库）。

**注意**：本地下载用 `curl`，不要用 PowerShell 的 `Invoke-WebRequest`。实测它会把 `limbopro.com` 的部分文件解码成十进制字节流（`35 35 32 ...`），写进缓存后解析全废。

## 目录

```
sources.json                ★ 唯一真源
tools/build.js              生成器（零依赖，Node 18+）
.github/workflows/build.yml CI
dist/
├── flclash-override.js     → FlClash 覆写脚本
├── mihomo/                 → 21 个 rule-provider yaml
└── loon/loon.conf          → Loon 配置
_upstream/                  上游规则缓存（不入库）
```

## 已知限制

**kelee.one 的 7 个表只给 Loon。** 这些链接被 Cloudflare 按机房 IP 封锁（`Attention Required! You have been blocked`，连站点根路径都 403），本机和 GitHub Actions 都拿不到；但手机上的 Loon 走运营商出口，可以正常读取。

所以这 7 个表在 `sources.json` 里标了 `"flclash": false`：**只写进 `loon.conf`，生成器不下载、不转成 yaml**。FlClash 端少了这 7 个表，影响很小——它们全是 DIRECT 规则（微信/腾讯/App Store/TestFlight/Apple 账号/Cloudflare CDN），而 `Direct_Rule` 的 11 万条域名已经覆盖了绝大部分。

想让它们也进 FlClash，只有一条路：把这 7 个 `.lsr` 文件手动存下来放进仓库（`_vendor/`），生成器读本地文件。这样 CI 不依赖网络。

**Adblock4limbo 只有 DNS 层规则能用于 FlClash。** 它那 548 条域名规则里，511 条已被 `Reject_Rule` 覆盖，去重后只剩 37 条。真正去网页广告靠的是配套的三个 JS：

| 脚本 | 作用 | 依赖 |
|---|---|---|
| `Adblock4limbo.js` | 重写脚本，告诉代理软件如何注入 | `[rewrite_local]` + `[mitm]` |
| `Adblock4limbo.user.js` | 实际删除网页广告元素 | 被注入到页面 |
| `Adblock4limbo.function.js` | 右下角导航按钮 | 被 `user.js` 引用 |

这需要 **TLS 中间人解密（MITM）+ 页面 JS 注入**，是 Surge / Loon / QuantumultX 的能力。mihomo（FlClash 内核）没有 MITM 引擎，**做不了**。

- **Loon**：支持 MITM，按 limbopro 文章配 `[Rewrite]` 和 `[Mitm]` 即可，与本文库无关
- **PC**：装油猴（Tampermonkey）后加 `Adblock4limbo.user.js`

## 说明

- 仓库 **Public**，只有域名和 IP 规则，**没有订阅链接、节点、密码**
- `dist/` 全部由 CI 生成，不要手改
- 内网/组网（节点小宝、Tailscale）放行规则在 `guardRules` 里，改动前先看 `tunExcludeExtra`
