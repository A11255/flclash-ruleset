# flclash-ruleset · 规则中心

**只服务 FlClash**（Windows / Android）。**`upstreams.txt` 是唯一手工维护的文件**——一行一个规则源地址，加删规则就改这个文本。`sources.json` 只放全局参数（策略组名、内网兜底等），平时不用碰。

> Loon 和 OpenClash 两条线已移除（2026-10-27）。`dist/loon/` 和 `dist/openclash/` 不再生成，旧地址会 404。

```
upstreams.txt                 ← 只改这里：加/删一行 = 加/删一个规则源
    │
    └─ CI 拉取上游规则 ─→ 分类 ─→ 跨表去重 ─→ dist/mihomo/*.yaml
                          ├─ 域名    → behavior: domain
                          ├─ IP 段   → behavior: ipcidr
                          └─ 关键词  → behavior: classical
                                        ↓
                          dist/flclash-override.js（JS 覆写脚本）
```

## 地址（固定，永不需要更换）

**FlClash** — 覆写 → 模式「脚本」→ 远程下载：

```
https://gh-proxy.com/https://raw.githubusercontent.com/A11255/flclash-ruleset/main/dist/flclash-override.js
```

地址里没有 commit SHA，只有不变的分支名 `main`。上游规则每天更新、CI 每次重建，**这个地址都不会变**，你不需要改任何设备。改完规则源后在 FlClash 里重启一次 VPN 拉取即可。

### 为什么用 gh-proxy.com 而不是 jsDelivr

「路径固定」和「内容实时」要同时成立，实测下来的结果：

| 地址 | 路径固定 | 内容实时 | 结论 |
|---|---|---|---|
| `cdn.jsdelivr.net/...@main/...` | ✅ | ❌ 脚本卡在 5 个版本前，还指向已删除的 `ruleset/` | 不能用 |
| `ghproxy.net/...` | ✅ | ✅ 但 7.5MB 要 44 秒 | 太慢 |
| `cdn.statically.io/...` | ✅ | ❌ 大文件被截断到 1458 条 | 不能用 |
| `raw.githubusercontent.com/...` | ✅ | ✅ | 可用，国内部分线路打不开 |
| **`gh-proxy.com/...`** | ✅ | ✅ **0.4 秒，5 次请求 MD5 全一致** | **采用** |

`gh-proxy.com` 是 GitHub raw 的反向代理，**不做长缓存**，每次请求回源，所以你拿到的永远是仓库里的最新内容。

### 两段地址的分工（容易踩的点）

**脚本和规则文件是被两个不同的程序下载的，走不同的网络：**

| 谁下载 | 网络路径 | 地址 |
|---|---|---|
| FlClash 应用 | 经 TUN → 你的代理节点 | `gh-proxy.com`（脚本本体） |
| mihomo 内核 | **直接出网，不经 TUN** | `cdn.jsdelivr.net/@main/dist/mihomo/`（脚本内部） |

内核下载规则文件时不行经隧道，所以那部分必须用国内可直连的地址，jsDelivr 满足这个条件；而 `dist/mihomo/*.yaml` 这些路径的缓存是正常的，每次都返回最新内容（实测 21 个文件全部正确）。

这个分工写在脚本里的 `URL_BASE`，由生成器自动产出，你不需要管。

### 备选地址

如果哪天 `gh-proxy.com` 不可用，把地址开头的 `https://gh-proxy.com/` 删掉，直接用：

```
https://raw.githubusercontent.com/A11255/flclash-ruleset/main/dist/flclash-override.js
```

两者路径完全一致，前者只是替你在国内做中转。

## 规则源

清单在 **`upstreams.txt`**，一行一个地址。**行序 = 优先级**，上面的先匹配。

### 加一个规则源

在 `upstreams.txt` 末尾（或任意想放的位置）加一行：

```
REJECT   https://example.com/ads.list
```

保存 → CI 自动重建 `dist/`（约 1 分钟）→ FlClash 里重启 VPN 就生效。

### 删一个规则源

把那一行删掉，或者在前面加 `#` 注释掉。下次刷新就没了。

### 每行怎么写

```
[策略]  地址  [name=名字]
```

| 字段 | 说明 |
|---|---|
| 策略 | `REJECT` / `DIRECT` / `PROXY`，可简写 `R` / `D` / `P`。**省略则按地址关键词自动判断**（含 ad/adblock/adrule/reject/ban → REJECT；含 direct/cn → DIRECT；含 proxy/gfw → PROXY），判断不出会直接报错让你补 |
| 地址 | `http` / `https` 开头的直链。支持 Loon `.rule`/`.lsr`、Surge `.list`、Clash provider `.yaml` 三种格式，也支持纯域名列表，格式自动识别 |
| `name=名字` | 自定义源名字。省略则自动取地址里的文件名（`Reject_Rule.rule` → `Reject_Rule`），重名自动加 `_2` |

`#` 之后是注释，可以写在行尾。

### 当前清单

| # | 名称 | 策略 | 域名 | IP | 关键词 | 说明 |
|---|---|---|---|---|---|---|
| 1 | `Reject_Rule` | REJECT | 304969 | 490 | 278 | 综合广告/跟踪拦截，最大的一张 |
| 2 | `AdBlock` | REJECT | 1212 | 10 | — | dler-io 广告表 |
| 3 | `adrules` | REJECT | 15101 | — | — | adrules.top，与 #1 高度重合，去重后仅剩独有部分 |
| 4 | `rejectAd` | REJECT | 597 | 7 | 13 | 奶思广告合集（APP/小程序广告） |
| 5 | `Adblock4limbo` | REJECT | 37 | — | — | 见「已知限制」 |
| 6 | `apple_update` | DIRECT | 5 | — | — | Apple 系统更新 |
| 7 | `Google_FCM` | DIRECT | 13 | 26 | — | Google 推送 |
| 8 | `Apple_Push` | DIRECT | 3 | 9 | — | Apple 推送 |
| 9 | `Direct_Rule` | DIRECT | 110580 | 12557 | 13 | 国内直连主表 |
| 10 | `Proxy_Rule` | PROXY | 35083 | 1014 | 55 | 需要走代理的域名 |

`—` 表示该表不含此类规则。最终产出：

| 总条数 | provider | 覆写规则 |
|---|---|---|
| 482072 | 21 | 34 |

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

### 日常：加/删规则源（最常见）

直接改 `upstreams.txt` 就行，本地都不用装环境：

1. GitHub 网页上点开 `upstreams.txt` → 铅笔图标 → 加一行 / 删一行 → Commit
2. 等 Actions 跑完（仓库首页能看到 bot 的 `chore: rebuild dist` 提交）
3. FlClash 里重启 VPN / 重新拉取覆写脚本

**不需要动 `sources.json`，也不需要碰 `dist/`。**

### 改了全局参数（策略组名、内网兜底）

改 `sources.json`，push 后同样自动重建。

> `policyMap.flclash.PROXY` 必须是订阅里真实存在的策略组名（当前是 `节点选择`）。改订阅模板后要同步改这里。

### 本地预览

```powershell
cd D:\ProgramData\WorkBuddy\2026-10-24-10-31-21\flclash-ruleset
git pull
node tools/build.js --fetch     # 本地先跑一遍看效果（--fetch 强制重下）
git status                      # 看 dist 有没有变化
```

本地不加 `--fetch` 时用 `_upstream/` 缓存（该目录已 gitignore，不入库）。

**注意**：本地下载用 `curl`，不要用 PowerShell 的 `Invoke-WebRequest`。实测它会把 `limbopro.com` 的部分文件解码成十进制字节流（`35 35 32 ...`），写进缓存后解析全废。

## 目录

```
upstreams.txt               ★ 唯一真源：规则源清单（一行一个地址）
sources.json                全局参数（策略组映射 / 内网兜底 / 去重开关）
tools/build.js              生成器（零依赖，Node 18+）
.github/workflows/build.yml CI
dist/
├── flclash-override.js     → FlClash 覆写脚本（JS）
└── mihomo/                 → 21 个 rule-provider yaml
_upstream/                  上游规则缓存（不入库）
```

## 已知限制

**Adblock4limbo 只有 DNS 层规则能用于 FlClash。** 它那 548 条域名规则里，511 条已被 `Reject_Rule` 覆盖，去重后只剩 37 条。真正去网页广告靠的是配套的三个 JS：

| 脚本 | 作用 | 依赖 |
|---|---|---|
| `Adblock4limbo.js` | 重写脚本，告诉代理软件如何注入 | `[rewrite_local]` + `[mitm]` |
| `Adblock4limbo.user.js` | 实际删除网页广告元素 | 被注入到页面 |
| `Adblock4limbo.function.js` | 右下角导航按钮 | 被 `user.js` 引用 |

这需要 **TLS 中间人解密（MITM）+ 页面 JS 注入**，是 Surge / Loon / QuantumultX 的能力。mihomo（FlClash 内核）没有 MITM 引擎，**做不了**。

- **PC**：装油猴（Tampermonkey）后加 `Adblock4limbo.user.js`，效果比代理层拦截更彻底

**kelee.one 那 7 张表已移除。** 它们当年只喂给 Loon（Cloudflare 按机房 IP 封锁，CI 拉不到），FlClash 端从来没用到过（当时标的是 `flclash:off`）。它们全是 DIRECT 规则（微信/腾讯/App Store/TestFlight/Apple 账号/Cloudflare CDN），`Direct_Rule` 的 11 万条域名已覆盖绝大部分。

## 说明

- 仓库 **Public**，只有域名和 IP 规则，**没有订阅链接、节点、密码**
- `dist/` 全部由 CI 生成，不要手改
- 内网/组网（节点小宝、Tailscale）放行规则在 `guardRules` 里，改动前先看 `tunExcludeExtra`
