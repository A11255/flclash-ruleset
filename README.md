# flclash-ruleset · 规则中心

一处维护，多端下发。**`upstreams.txt` 是唯一手工维护的文件**——一行一个规则源地址，加删规则就改这个文本。`sources.json` 只放全局参数（策略组映射、内网兜底、去重开关等），平时不用碰。

**三端各自独立**，不是强行同源：规则数据来自同一份清单，但每端用自己平台的能力和格式。

| 端 | 格式 | 走代理用什么 | 怎么更新 |
|---|---|---|---|
| **FlClash**（Win / Android） | JS 覆写脚本 | 策略组 `节点选择` | 重启 VPN 时重新拉取 |
| **Loon**（iOS） | `.conf` 的 `[Rule]` 段 | 策略组 `节点选择` | 手动或定时更新配置 |
| **OpenClash**（OpenWrt） | 纯 YAML 覆写模块（零 provider） | 订阅自带的策略组 | 手动设更新时间，或重启时重新拉取 |

```
upstreams.txt                 ← 只改这里：加/删一行 = 加/删一个规则源
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

### 模块形态：小模块 + `.mrs` 规则集

这是按 [`Aethersailor/Custom_OpenClash_Rules`](https://github.com/Aethersailor/Custom_OpenClash_Rules) 的范式重做的。核心原则只有一条：

> **`[YAML]` 模块里只放 provider 定义和规则引用，绝不内联成千上万条规则。**

模块本体 5.5 KB、15 个 provider、26 条规则。真正的规则内容在 `dist/mihomo/*.mrs`，由内核自己下载和加载。

| | 早期做法（已废弃） | 现在 |
|---|---|---|
| 模块体积 | 792 KB（内联 17044 条） | **5.5 KB** |
| 规则存放 | 全部塞进 `+rules` | `rule-providers` + `.mrs` |
| 内核下载量 | 0（但配置巨大） | 3.06 MB |
| 配置初始化耗时 | 数秒（Ruby 合并） | **7 ms**（本机实测） |

### 为什么用 `.mrs` 而不是 `.yaml`

`.mrs` 是 mihomo 的二进制规则集格式，用内核自带的 `convert-ruleset` 生成：

```sh
mihomo convert-ruleset domain yaml  dist/mihomo/Reject_Rule_Domain.yaml dist/mihomo/Reject_Rule_Domain.mrs
mihomo convert-ruleset ipcidr yaml  dist/mihomo/Direct_Rule_IP.yaml      dist/mihomo/Direct_Rule_IP.mrs
```

本机实测（mihomo v1.19.18）：

| 表 | yaml | mrs |
|---|---|---|
| `Reject_Rule_Domain` | 7.77 MB | **2.27 MB** |
| `Direct_Rule_Domain` | 2.07 MB | 394 KB |
| `Proxy_Rule_Domain` | 729 KB | 191 KB |
| 17 张域名/IP 表合计 | 11.32 MB | **3.06 MB（省 72.9%）** |

**`.mrs` 只支持 `domain` 和 `ipcidr`。** 关键词表（`*_KW`，`behavior: classical`）必须保留 `.yaml` + `format: yaml`——实测 `convert-ruleset classical` 会让内核直接 panic。好在 4 张关键词表总共才 10 KB。

`format` 必须和文件扩展名严格一致，mihomo 不会按后缀猜。

### 本机实测结果

用 mihomo v1.19.18 加载这套配置（`type: file` 指向本地 mrs）：

```
Initial configuration complete, total time: 7ms
15/15 provider 加载成功，合计 322,770 条规则，0 error / 0 warn
  Reject_Rule      304969      adrules         15101
  Reject_Rule_KW      278      rejectAd          597
  AdBlock            1212      AdBlock_IP         10
```

### 不需要配置任何策略组名

规则只用 `DIRECT` / `REJECT` 两个内建出站，不引用任何自定义策略组。生成器做了降级：`sources.json` 里 `policyMap.openclash.PROXY` 缺失时，`PROXY` 类规则自动注释掉，配置仍能加载。

`Direct_Rule`（11 万条）和 `Proxy_Rule`（3.5 万条）在 `sources.json` 里标了 `"openclash": false`——**你的订阅自带 `GeoSite(cn)` / `Custom_Direct_Domain` / `Custom_Proxy_Domain`，这两张表是重复劳动**，而且靠 `+rules` 前置插入会抢在订阅自己的分流之前。

### 一个需要注意的优先级副作用

`+rules` 插到规则数组**最前面**，所以我们的规则会排在你订阅的 `Custom_Direct_Domain` / `Custom_Proxy_Domain` 之前。

- 广告表 `REJECT` 抢先 → 这是你要的
- 内网兜底和 Apple/FCM 直连抢先 → 无害

### 怎么确认生效

重启后看三处：

1. **插件日志**没有 `policy not found`、没有 `parse error`
2. **内核日志**出现 `Start initial provider Reject_Rule`
3. 仪表盘/内核日志里能看到 `match RuleSet(Reject_Rule) using REJECT`

如果内核日志连 `Start initial provider` 都没有，说明内核没起来，先查 `logread` 里的 `out of memory` / `killed process`。

### 规则文件由谁下载

路由器的 mihomo 内核**直接出网**拉规则文件，不走代理，所以 provider 的 `url` 指向 `cdn.jsdelivr.net`（你那台路由器实测可直连；`fastly.jsdelivr.net` 超时，别用）。

`interval`：域名表 1800 秒、IP 表 86400 秒，与上游项目一致。

### CI 会自动生成 mrs

`.github/workflows/build.yml` 会下载钉版本的 mihomo（`v1.19.18`，与上游项目一致），跑 `convert-ruleset`，把 `.mrs` 一起提交。**不要在本地手改 `dist/`，每次构建都会被覆盖。**


## 规则源

清单在 **`upstreams.txt`**，一行一个地址。**行序 = 优先级**，上面的先匹配。

### 加一个规则源

在 `upstreams.txt` 末尾（或任意想放的位置）加一行：

```
REJECT   https://example.com/ads.list
```

保存 → CI 自动重建 `dist/`（1~2 分钟）→ 各端点「刷新订阅」就生效。

### 删一个规则源

把那一行删掉，或者在前面加 `#` 注释掉。下次刷新就没了。

### 每行怎么写

```
[策略]  地址  [选项...]
```

| 字段 | 说明 |
|---|---|
| 策略 | `REJECT` / `DIRECT` / `PROXY`，可简写 `R` / `D` / `P`。**省略则按地址关键词自动判断**（含 ad/adblock/adrule/reject/ban → REJECT；含 direct/cn → DIRECT；含 proxy/gfw → PROXY），判断不出会直接报错让你补 |
| 地址 | `http` / `https` 开头的直链。支持 Loon `.rule`/`.lsr`、Surge `.list`、Clash provider `.yaml` 三种格式，也支持纯域名列表，格式自动识别 |
| `name=名字` | 自定义源名字。省略则自动取地址里的文件名（`Reject_Rule.rule` → `Reject_Rule`），重名自动加 `_2` |
| `flclash:off` | 不进 FlClash 端（用于 CI 拉不到、但设备能直连的源） |
| `loon:off` | 不进 Loon 端 |
| `openclash:off` | 不进 OpenClash 端（大表别进，路由器扛不住） |

`#` 之后是注释，可以写在行尾。

### 当前清单

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
| FlClash | 482072 | 21 | 34 |
| Loon | — | 16 个上游直链 | 16 条 RULE-SET |
| **OpenClash** | **322770** | **15（`.mrs`）** | **15 条 RULE-SET + 11 条内网兜底** |

标注「仅 Loon」的 7 个表在 `upstreams.txt` 对应行末尾写了 `flclash:off`。生成器**不会去下载它们**，只把链接写进 `loon.conf`。

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
2. 等 Actions 跑完（Actions 页面能看到「rebuild dist」的提交）
3. FlClash 里点「更新订阅」/ Loon 里点「更新配置」/ OpenClash 里点「更新配置」

**不需要动 `sources.json`，也不需要碰 `dist/`。**

### 改了全局参数（策略组名、内网兜底、去重开关）

改 `sources.json`，push 后同样自动重建。

### 本地预览

```powershell
cd D:\ProgramData\WorkBuddy\2026-10-24-10-31-21\flclash-ruleset
git pull
node tools/build.js --fetch     # 本地先跑一遍看效果（--fetch 强制重下）
git status                      # 看 dist 有没有变化
```

push 后 CI 自动拉上游、重新生成 `dist/` 并提交。各端下次拉取就是新的。

本地不加 `--fetch` 时用 `_upstream/` 缓存（该目录已 gitignore，不入库）。

**注意**：本地下载用 `curl`，不要用 PowerShell 的 `Invoke-WebRequest`。实测它会把 `limbopro.com` 的部分文件解码成十进制字节流（`35 35 32 ...`），写进缓存后解析全废。

## 目录

```
upstreams.txt               ★ 唯一真源：规则源清单（一行一个地址）
sources.json                全局参数（策略组映射 / 内网兜底 / 去重开关）
tools/build.js              生成器（零依赖，Node 18+）
tools/openclash-prepare.sh  路由器侧规则缓存预热 / 排障
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
