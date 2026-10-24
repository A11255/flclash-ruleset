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
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/flclash-override.js
```

> `@main` 有最长 12 小时 CDN 缓存。要立刻拿到最新版就用固定 commit SHA（`@<sha7>`），改完我会给新 SHA。

**Loon（iOS）** — 配置从 URL 导入，或把 `[Rule]` 段复制进你现有配置：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/loon/loon.conf
```

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
| 9 | `Direct_Rule` | DIRECT | 110580 | 12557 | 13 | 国内直连主表 |
| 10 | `Proxy_Rule` | PROXY | 35083 | 1014 | 55 | 需要走代理的域名 |

`—` 表示该表不含此类规则。合计 **482072 条**（域名 467600 / IP 14113 / 关键词 359），生成 **21 个 provider / 35 条规则**。

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

**kelee.one 的 7 个规则源无法自动拉取。** 以下链接被 Cloudflare 按机房 IP 整体封锁（返回 `Attention Required! You have been blocked`），本机和 GitHub Actions 都拿不到：

```
rule.kelee.one/Loon/Cloudflarecn.lsr
rule.kelee.one/Loon/Cloudflare.lsr
kelee.one/Tool/Loon/Lsr/AppleAccount.lsr
kelee.one/Tool/Loon/Lsr/AppStore.lsr
rule.kelee.one/Loon/WeChat.lsr
rule.kelee.one/Loon/Tencent.lsr
rule.kelee.one/Loon/TestFlight.lsr
```

已跳过。需要的话有两个办法：换成 `blackmatrix7/ios_rule_script` 的同名表（WeChat / Tencent / Cloudflare / TestFlight / AppStore / AppleID 都能对上，`Cloudflarecn` 无对应），或你手动下载后作为快照固化进仓库。

## 说明

- 仓库 **Public**，只有域名和 IP 规则，**没有订阅链接、节点、密码**
- `dist/` 全部由 CI 生成，不要手改
- 内网/组网（节点小宝、Tailscale）放行规则在 `guardRules` 里，改动前先看 `tunExcludeExtra`
