# flclash-ruleset · 规则中心

一处维护，多端下发。`sources.json` 是唯一手工维护的文件。

**三端各自独立**，不是强行同源：规则数据来自同一份清单，但每端用自己平台的能力和格式。

| 端 | 格式 | 走代理用什么 | 怎么更新 |
|---|---|---|---|
| **FlClash**（Win / Android） | JS 覆写脚本 | 策略组 `节点选择` | 重启 VPN 时重新拉取 |
| **Loon**（iOS） | `.conf` 的 `[Rule]` 段 | 策略组 `节点选择` | 手动或定时更新配置 |
| **OpenClash**（OpenWrt） | INI 三段的覆写模块 | 策略组 `🚀 手动选择` | `#!CRON` 每天 4 点自动拉取并重启 |

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
https://gh-proxy.com/https://raw.githubusercontent.com/A11255/flclash-ruleset/main/dist/openclash/module.conf
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

OpenClash 对应的是「**覆写模块**」，格式是 INI 三段（`[General]` / `[Overwrite]` / `[YAML]`），靠 `[YAML]` 段的操作符把内容合并进运行配置。生成器已经专门为它产出：

```
https://gh-proxy.com/https://raw.githubusercontent.com/A11255/flclash-ruleset/main/dist/openclash/module.conf
```

### 挂载步骤

1. OpenClash → **运行状态** 页顶部，点「**覆写模块**」按钮（和启动/停止、重启并排的那个图标）
2. 左下角「**+ 添加新模块**」→ 第一步选「**订阅链接**」→ 粘贴上面的地址 → 下一步
3. 模块名、匹配配置（`all`）会从文件头的 `#!` 元信息**自动回填**，确认后直接添加
4. **打开这个模块的开关**（新建模块默认是关的）
5. 回运行状态页点「**重启**」

> 改内容、切开关、新建模块之后都必须**重启插件**，不是 `reload`。覆写模块只在 `start_service` 里解析。

### 模块由三段组成

按官方 `luci-app-openclash/root/etc/openclash/overwrite/default` 的规范写的：

| 段 | 作用 | 本模块内容 |
|---|---|---|
| `#!` 元信息 | 添加模块时自动回填表单 | `NAME` / `DESC` / `CONFIG=all` / `CRON=0 4 * * *` |
| `[General]` | 覆盖插件设置（Web UI 里那些开关） | 3 项，见下 |
| `[YAML]` | 用操作符合并运行配置 | 规则集 + 规则 + fake-ip-filter + TUN 排除 |

`#!CRON=0 4 * * *` 让插件**每天凌晨 4 点重新下载本模块**，配合 `RESTART = true` 自动重启生效——这是 OpenClash 端的「跟随更新」，和 FlClash 的重启拉取是两条独立路径。

`[General]` 只覆盖 3 项，其余全部保持你在 Web UI 里的设置：

| 项 | 值 | 为什么 |
|---|---|---|
| `INTRANET_ALLOWED_WAN_NAME` | `wan` | 修掉日志里的「设置仅允许内网功能失败，无法获取 IPv4 的 WAN 接口名称」。你的 WAN 区域名如果叫别的，改这里 |
| `ENABLE_META_SNIFFER` | `1` | 开启域名嗅探。纯 IP 连接也能提取 SNI/Host，让域名规则命中 |
| `RESTART` | `true` | 模块更新后自动重启插件，否则新规则不加载 |

### 策略组名：只有一个地方要配置

模块里的规则绝大多数用 `DIRECT` / `REJECT` 两个内建出站，只有「走代理」那 3 条需要指向一个真实存在的策略组。

**这个组名写在 `sources.json` 里，不写在模块里**：

```json
"policyMap": {
  "openclash": { "PROXY": "🚀 手动选择", "DIRECT": "DIRECT", "REJECT": "REJECT" }
}
```

当前值是 `🚀 手动选择`。**如果你 OpenClash 的「策略组」页面里组名不是这个，把 JSON 里那个值改掉，push 后 CI 会自动重建**——不要手改 `module.conf`，每次构建都会覆盖。

为什么必须配置：OpenClash 的策略组名由订阅模板决定（`🚀 节点选择` / `🐟 漏网之鱼` / `🎯 全球直连` …），每套模板都不一样。规则里写死一个不存在的组名，内核会报 `policy not found`、**整份配置拒绝加载**。所以生成器做了降级：`policyMap.openclash.PROXY` 为空或还是占位符时，这 3 条会自动被注释掉，配置仍能正常加载。

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

1. **插件日志**（运行状态页 → 日志 → 插件日志）没有 `policy not found`、没有 `parse error`
2. **内核日志**里出现形如 `match RuleSet(Reject_Rule)` 的行 —— 说明我们的规则正在被匹配
3. 打开一个广告域名，内核日志显示 `match RuleSet(Reject_Rule) using REJECT`

如果内核日志里连 `Reject_Rule` 字样都没有，说明模块没加载：检查模块开关是否打开、`匹配配置文件` 是否填了 `all`、以及**是否真的重启了插件**（`reload` 不算）。

### 模块做了什么

`[YAML]` 段用的全是 OpenClash 覆写模块的操作符：

| 写法 | 语义 | 用途 |
|---|---|---|
| `rule-providers:` | 哈希递归合并 | 追加 21 个规则集，不动订阅自带的部分 |
| `+rules:` | **数组前置插入** | 把 33 条规则插到订阅规则**前面**，保证优先匹配 |
| `dns.fake-ip-filter+:` | 数组末尾追加 | 内网域名不走 fake-ip |
| `tun.route-exclude-address+:` | 数组末尾追加 | 组网网段不进 TUN |

生效的 33 条 = 12 条内网兜底 + 21 条 RULE-SET（4 个关键词表 + 10 个域名表 + 7 个 IP 表），规则内容与 FlClash 端同源，同一个 `sources.json`、同一个顺序（`guards → KW → domain → IP`）。

生成器自带自检：每条 `RULE-SET` 引用的 provider 必须在同一文件里定义过，否则构建直接失败。

### 和 FlClash 版唯一的差别

**没有 `GEOIP,CN,DIRECT`**

FlClash 脚本里它是末尾的兜底规则。但 OpenClash 是往订阅规则**前面**插，带上它会抢在你订阅自己的分流规则之前把所有国内 IP 直连，可能破坏已有的流媒体分组。OpenClash 一般自带国内直连兜底，所以省掉。

如果确认配置里没有国内直连规则，在模块的 `+rules` 块末尾手动补一条即可。

### 规则文件由谁下载

路由器的 mihomo 内核**直接出网**拉规则文件，不走代理，所以模块里 21 个 provider 的 `url` 指向 `cdn.jsdelivr.net`（国内可直连），而不是 gh-proxy。这和 FlClash 端的逻辑一致：入口文件走代理可达的地址，规则文件走内核可直连的地址。

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
