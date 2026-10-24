# flclash-ruleset · 规则中心

一处维护，多端下发。`sources.json` 是唯一手工维护的文件。

**三端各自独立**，不是强行同源：规则数据来自同一份清单，但每端用自己平台的能力和格式。

| 端 | 格式 | 走代理用什么 | 怎么更新 |
|---|---|---|---|
| **FlClash**（Win / Android） | JS 覆写脚本 | 策略组 `节点选择` | 重启 VPN 时重新拉取 |
| **Loon**（iOS） | `.conf` 的 `[Rule]` 段 | 策略组 `节点选择` | 手动或定时更新配置 |
| **OpenClash**（OpenWrt） | 纯 YAML 覆写模块（零 provider） | 订阅自带的策略组 | 手动设更新时间，或重启时重新拉取 |

```
sources.json
    │
    ├─ CI 拉取上游规则 ─→ 分类 ─→ 跨表去重 ─→ dist/mihomo/*.yaml
    │                     ├─ 域名    → behavior: domain        → FlClash / OpenClash
    │                     ├─ IP 段   → behavior: ipcidr        → FlClash / OpenClash
    │                     └─ 关键词  → behavior: classical     → FlClash / OpenClash
    │
    └─ Loon 端直接用上游原始链接（本来就是 Loon/Surge 格式，不需要转）
```

## 地址（固定，永不需要更换）

**FlClash** — 覆写 → 模式「脚本」→ 远程下载：

```
https://gh-proxy.com/https://raw.githubusercontent.com/A11255/flclash-ruleset/main/dist/flclash-override.js
```

**Loon** — 从 URL 导入配置，或把 `[Rule]` 段复制进现有配置：

```
https://gh-proxy.com/https://raw.githubusercontent.com/A11255/flclash-ruleset/main/dist/loon/loon.conf
```

**OpenClash** — 覆写模块 → 添加 → 订阅链接：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/openclash/module.conf
```

三个地址里都没有 commit SHA，只有不变的分支名 `main`。上游规则每天更新、CI 每次重建，**这三个地址都不会变**，你不需要改任何设备。

### 为什么用 gh-proxy.com 而不是 jsDelivr

「路径固定」和「内容实时」要同时成立，实测下来的结果：

| 地址 | 路径固定 | 内容实时 | 结论 |
|---|---|---|---|
| `cdn.jsdelivr.net/...@main/...` | ✅ | ❌ 脚本卡在 5 个版本前，还指向已删除的 `ruleset/` | 不能用 |
| `ghproxy.net/...` | ✅ | ✅ 但 7.5MB 要 44 秒 | 太慢 |
| `cdn.statically.io/...` | ✅ | ❌ 大文件被截断到 1458 条 | 不能用 |
| `raw.githubusercontent.com/...` | ✅ | ✅ | 可用，国内部分线路打不开 |
| **`gh-proxy.com/...`** | ✅ | ✅ **0.4 秒，5 次请求 MD5 全一致** | **采用** |

`gh-proxy.com` 是 GitHub raw 的反向代理，**不做长缓存**，每次请求回源，所以你拿到的永远是仓库里的最新内容。实测脚本连续 5 次请求全部一致、约 0.4 秒。

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

## OpenClash（OpenWrt 路由器）

OpenClash 内核同样是 mihomo，但**它不认 FlClash 的 JS 覆写脚本**——`main(config)` 是 FlClash 应用层自己实现的功能，mihomo 内核没有这个东西。

OpenClash 对应的是「**覆写模块**」。本模块是**纯 YAML、零 rule-provider** 形态：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/openclash/module.conf
```

> **为什么 OpenClash 用 jsDelivr，而 FlClash 用 gh-proxy？**
> `dist/openclash/` 是新路径，实测三个 jsDelivr 镜像（cdn / fastly / gcore）都实时同步、MD5 一致；而 `dist/flclash-override.js` 那个老路径被 jsDelivr 缓存粘住了，purge 也清不掉。另外你的路由器日志显示 `cdn.jsdelivr.net` 可直连、`gh-proxy.com` 曾 `i/o timeout`。

### 挂载步骤

1. OpenClash → **运行状态** 页顶部，点「**覆写模块**」按钮（和启动/停止、重启并排的那个图标）
2. 左下角「**+ 添加新模块**」→ 第一步选「**订阅链接**」→ 粘贴上面的地址 → 下一步
3. 填模块名，**匹配配置文件手动选 `all`**
4. **打开这个模块的开关**（新建模块默认是关的）
5. 回运行状态页点「**重启**」，然后等 60 秒

> 改内容、切开关、新建模块之后都必须**重启插件**，不是 `reload`。覆写模块只在 `start_service` 里解析。

### 模块形态：纯 YAML，零 provider

整个文件只有一个 `[YAML]` 段，**所有规则直接写在 `+rules:` 里，不下载任何外部文件**：

| 组成 | 条数 |
|---|---|
| 广告域名 `DOMAIN-SUFFIX` | 16968 |
| 广告关键词 `DOMAIN-KEYWORD` | 13 |
| 广告 IP（v4 用 `IP-CIDR`，v6 用 `IP-CIDR6`） | 17 |
| 内网 / 组网兜底 | 12 |
| Apple 推送 / FCM / 系统更新直连 | 56 |
| **合计** | **17045**（文件约 774 KB） |

广告内容来自 `AdBlock` + `adrules` + `rejectAd` + `Adblock4limbo` 四张表**全部条目**，已做跨表去重。

**为什么不用 `rule-providers`**：带 provider 的版本在你机器上稳定卡在启动「第五步」，内核 0 个 provider 活动。见下节实测记录。

**注意**：内联到 `rules` 里必须区分 `IP-CIDR` 和 `IP-CIDR6`。provider 版靠 `behavior: ipcidr` 自动识别 v4/v6，内联时不会——写错会让内核直接拒绝解析。

### 不需要配置任何策略组名

模块里**没有一条规则引用自定义策略组**，全部使用 `DIRECT` / `REJECT` 两个内建出站。所以不管你的订阅模板把策略组叫 `🚀 节点选择` 还是 `🐟 漏网之鱼`，都不会出现 `policy not found`。

能做到这一点是因为 OpenClash 端**只做广告拦截**，不再重复下发「国内直连」和「走代理」两类规则——那两件事你订阅自带的 `GeoSite(cn)` / `Custom_Direct_Domain` / `Custom_Proxy_Domain` 已经在做了。

### 为什么弃用 rule-provider（完整排查记录）

带 `rule-providers` 的版本在你机器上从来没起来过（除了一次）。四次失败表现完全一致：**卡在启动「第五步」，之后零日志，内核 0 个 provider 活动**。

| 时间 | 模块内容 | provider 启动数 | 结果 |
|---|---|---|---|
| 15:52 | 18 条规则 / 21 provider | **30 个** | ✅ 唯一一次成功 |
| 16:13 | 21 条 + `[General]` | 未知（日志截断） | ❌ 卡第五步 |
| 16:17 | 21 条 + `[General]` | **0 个** | ❌ |
| 17:17 | 12 provider + `[General]` | **0 个** | ❌ |
| 17:44 | 12 provider，纯 YAML | **0 个** | ❌ |
| 16:52 / 17:10 | **无模块** | 9 个（订阅自带） | ✅ 12 秒起来 |

逐个排除的假设：

| 假设 | 验证结果 |
|---|---|
| 内存不足 | ❌ N1 有 2GB，15:52 全量成功过 |
| 策略组 `🚀 手动选择` 不存在 | ❌ 订阅自己的 `Custom_Proxy_Domain` 在用它，匹配正常 |
| `ENABLE_META_SNIFFER = 1` | ❌ 去掉后照样卡 |
| `[General]` 段 | ❌ 去掉后照样卡 |

**唯一共同点就是 `rule-providers` 本身**，所以改成零 provider 的内联形态。这版把所有外部依赖（下载、文件路径、provider 解析）全部去掉，只剩纯文本规则。

### 一个需要注意的优先级副作用

`+rules` 是插到数组**开头**，所以我们的规则会排在你自己模板规则的前面（你的日志里是 `Custom_Direct_Domain` / `Custom_Proxy_Domain` / `Custom_Port_Direct` / `GeoSite(github)` / `Match`）。

这意味着：

- 广告表 `REJECT` 优先 → 这是想要的效果
- **`Direct_Rule`（11 万条）会抢在 `Custom_Proxy_Domain` 之前** → 某个域名如果你模板里特意设成走代理，但它同时存在于 `Direct_Rule` 里，就会被改成直连

如果遇到「某个网站本该走代理却直连了」，把模块里这三行注释掉即可（只保留广告拦截，直连交回你自己的模板）：

```yaml
#  - 'RULE-SET,Direct_Rule,DIRECT'
#  - 'RULE-SET,Direct_Rule_IP,DIRECT,no-resolve'
#  - 'RULE-SET,Direct_Rule_KW,DIRECT'
```

### 怎么确认生效

重启后看这三处：

1. **插件日志**（运行状态页 → 日志 → 插件日志）没有 `parse error`，并且出现「启动成功」
2. **内核日志**里出现 `match RuleSet(...)` 或 `match Match` 的行，说明内核在正常处理规则
3. 打开一个广告域名（比如 `doubleclick.net`），内核日志应显示命中我们的规则并 `using REJECT`

内联版没有 provider 名可查，判断规则是否加载要看 `config.yaml` 的 `rules` 段——在「配置文件」页面能看到，搜 `DOMAIN-SUFFIX` 应该有约 1.7 万条。

### 模块做了什么

`[YAML]` 段用的全是 OpenClash 覆写模块的操作符：

| 写法 | 语义 | 用途 |
|---|---|---|
| `+rules:` | **数组前置插入** | 把 17045 条规则插到订阅规则**前面**，保证优先匹配 |

就这一个操作符。模块里没有 `rule-providers`、没有 `dns` 段、没有 `tun` 段——把变量压到最少，只保留必要的那一项。

内网/组网直连靠规则本身解决（`GEOIP,LAN` / `GEOIP,private` / 8 条私有网段），不依赖 `tun.route-exclude-address`。如果你的节点小宝（100.66.1.x）在路由器上还需要 TUN 层排除，那是 FlClash 那边的问题，路由器走的是 Redir/TProxy 模式，规则层 `IP-CIDR,100.64.0.0/10,DIRECT` 已经够了。

### 和 FlClash 版的差别

| 项 | FlClash | OpenClash |
|---|---|---|
| 形态 | JS 覆写脚本 + 21 个 rule-provider | **纯 YAML + 零 provider** |
| 规则量 | 48 万条 | **17045 条** |
| 广告来源 | 5 张表（含 30 万条 `Reject_Rule`） | 4 张表（不含 `Reject_Rule`） |
| 国内直连 | `Direct_Rule` 11 万条 | 订阅自带 `GeoSite(cn)` |
| 走代理 | `Proxy_Rule` 3.5 万条 → `节点选择` | 订阅自带 `Custom_Proxy_Domain` |
| `GEOIP,CN,DIRECT` | 有（末尾兜底） | **无** |

**为什么 OpenClash 不含 `Reject_Rule` 那 30 万条**：内联规则会全部展开成 `config.yaml` 的 `rules` 数组，内核要逐条解析成规则对象（不像 provider 那样走预编译的 payload）。30 万条内联会让配置文件膨胀到 10 MB 以上、解析时间从毫秒级变成分钟级。4 张小表合计 1.7 万条已覆盖主流广告。

**为什么不要 `GEOIP,CN,DIRECT`**：FlClash 里它是末尾兜底，但 OpenClash 是往订阅规则**前面**插，带上它会抢在你订阅自己的分流规则之前把所有国内 IP 直连，可能破坏已有的流媒体分组。你订阅自带 `GeoSite(cn)`，所以省掉。

### 规则文件由谁下载

**不用下载了。** 内联版没有任何 `rule-providers`，所有规则都在 `module.conf` 这一个文件里，由 OpenClash 插件自身拉取（走系统网络，不经代理）。`sources.json` 里 `openclashInline: true` 控制这个形态，改成 `false` 就回到 provider 版。

## 规则源

按优先级排列（`sources.json` 里的数组顺序就是生效顺序）。

| # | 名称 | 策略 | 域名 | IP | 关键词 | 说明 |
|---|---|---|---|---|---|---|
| 1 | `Reject_Rule` | REJECT | 304969 | 490 | 278 | 综合广告/跟踪拦截，最大的一张。**不进 OpenClash**（太重，实测卡死） |
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
| 16 | `Direct_Rule` | DIRECT | 110580 | 12557 | 13 | 国内直连主表。**不进 OpenClash**（订阅自带 `GeoSite(cn)`） |
| 17 | `Proxy_Rule` | PROXY | 35083 | 1014 | 55 | 需要走代理的域名。**不进 OpenClash**（订阅自带 `Custom_Proxy_Domain`） |

`—` 表示该表不含此类规则。三端最终产出：

| 端 | 总条数 | provider | 规则 |
|---|---|---|---|
| FlClash | 482072 | 21 | 35 |
| Loon | — | 16 个上游直链 | 16 条 RULE-SET |
| **OpenClash** | **17045** | **0（内联）** | **1 个 `+rules` 块** |

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
├── flclash-override.js     → FlClash 覆写脚本（JS）
├── openclash/module.conf   → OpenClash 覆写模块（INI + [YAML]）
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
