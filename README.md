# flclash-ruleset · 规则中心

**主端 FlClash**（Windows / Android），**附赠 Loon 规则集**。**`upstreams.txt` 是唯一手工维护的文件**——一行一个规则源地址，加删规则就改这个文本。`sources.json` 只放全局参数（策略组名、内网兜底等），平时不用碰。

> 2026-10-27 起规则源改为直接拉 `blackmatrix7/ios_rule_script`，不再经过 `Code-Dramatist/Rule_Actions` 这层中间商。少一个仓库、少一次转发、少一个故障点。

```
upstreams.txt                 ← 只改这里：加/删一行 = 加/删一个规则源
    │
    └─ CI 拉取上游规则 ─→ 分类 ─→ 按 group 合并 ─→ 跨表去重
                          ├─ 域名    → behavior: domain     ─┐
                          ├─ IP 段   → behavior: ipcidr      ├→ dist/mihomo/*.yaml
                          ├─ 关键词  → behavior: classical   ─┘       │
                          │                                          ↓
                          │                              dist/flclash-override.js（FlClash）
                          └─ 全类型（含 USER-AGENT / URL-REGEX）
                                                              ↓
                                                      dist/loon/*.rule（Loon RULE-SET）
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

## Loon 怎么用

`dist/loon/` 下每个组一个 `.rule` 文件，是 Loon 原生的规则集格式（`TYPE,value[,no-resolve]`，不带策略列）。在你 Loon 配置的 `[Rule]` 段里加对应行即可，**策略写在 RULE-SET 那一行**：

```
RULE-SET,https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/loon/Reject_Rule.rule,REJECT
RULE-SET,https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/loon/Direct_Rule.rule,DIRECT
RULE-SET,https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/loon/Proxy_Rule.rule,PROXY
```

三条就够，其余小表（`AdBlock` / `adrules` / `rejectAd` / `Adblock4limbo` / `apple_update` / `Google_FCM` / `Apple_Push`）按需再加。

**顺序很重要**：`Reject_Rule` 放最前，`Direct_Rule` 和 `Proxy_Rule` 放你自己的分流规则之后。Loon 和 FlClash 一样是自上而下先命中先生效。

Loon 端比 FlClash 端多 202 条规则——`USER-AGENT`（188 条）和 `URL-REGEX`（15 条）mihomo 不支持，只写进了 `.rule` 文件。

### 文件大小与下载速度（实测 2026-10-27）

| 文件 | 条数 | 体积 |
|---|---|---|
| `Reject_Rule.rule` | 306365 | 9.8 MB |
| `Direct_Rule.rule` | 122944 | 3.3 MB |
| `Proxy_Rule.rule` | 36243 | 1.1 MB |
| 其余 7 个 | 合计 2641 | 合计 553 KB |

`Reject_Rule` 偏大，是因为每行都写了显式的 `DOMAIN-SUFFIX,` 前缀（裸域名格式能省 40%，但 Loon 对裸域名的处理没有官方保证，这里不赌）。

**jsDelivr 第一次请求要回源 GitHub，9.8 MB 花了 26 秒；命中边缘缓存后 1.6–10 秒。** iOS 上第一次加载会慢，之后就正常。raw.githubusercontent.com 直连实测要 114 秒，不建议。

如果 jsDelivr 拉不动，把地址前缀换成 gh-proxy（和 FlClash 脚本用的是同一条线路）：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main   ← 默认
https://gh-proxy.com/https://raw.githubusercontent.com/A11255/flclash-ruleset/main   ← 备选
```

## OpenClash 怎么用

`dist/openclash/` 下是 `.mrs` 二进制规则集，**只给 OpenClash 那套配置做广告拦截用**。

### 为什么是 .mrs 而不是 yaml

`Reject_Rule` 有 30 万条域名，yaml 是 7.8 MB 文本，路由器每次启动都要现场解析。mrs 是二进制，**实测 30.5 万条 7 ms 加载完**，文件也从 7.8 MB 压到 2.2 MB。N1 这种设备差别很明显。

转换用 `mihomo convert-ruleset`，CI 里跑。它**只支持 domain / ipcidr**，`classical`（关键词表）会 panic，所以 `*_KW` 不转 mrs，OpenClash 那边用 `dist/mihomo/*_KW.yaml` 引。

### 怎么用

不单独用，**配一个覆写模块一起用**——模块在另一个仓库：

```
https://cdn.jsdelivr.net/gh/A11255/Custom_OpenClash_Rules@main/overwrite/yaml/Custom_Clash_AdBlock.conf
```

那套配置（Aethersailor 系）的 46 条规则里**一条 REJECT 都没有**，本身不做任何广告拦截。这个模块负责：下载配置 → 写入订阅 → 把这里的 `Reject_Rule` 等规则插到 `rules` 最前面。

具体步骤看那个仓库的 `SELF_USE.md`。

### 产物清单

| 文件 | 条数 | 体积 |
|---|---|---|
| `Reject_Rule_domain.mrs` | 305583 | 2.2 MB |
| `Direct_Rule_domain.mrs` | 110308 | 384 KB |
| `Proxy_Rule_domain.mrs` | 35095 | 188 KB |
| `adrules_domain.mrs` | 14666 | 132 KB |
| `Direct_Rule_ip.mrs` | 12557 | 52 KB |
| 其余 12 个 | 合计 12419 | 合计 24 KB |

**17 个 mrs，合计 481632 条**，另有 359 条关键词规则留在 yaml 里。

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
[策略]  地址  [name=名字]  [group=组名]
```

| 字段 | 说明 |
|---|---|
| 策略 | `REJECT` / `DIRECT` / `PROXY`，可简写 `R` / `D` / `P`。**省略则按地址关键词自动判断**（含 ad/adblock/adrule/reject/ban → REJECT；含 direct/cn → DIRECT；含 proxy/gfw → PROXY），判断不出会直接报错让你补 |
| 地址 | `http` / `https` 开头的直链。支持 Loon `.rule`/`.lsr`、Surge `.list`、Clash provider `.yaml` 三种格式，也支持纯域名列表，格式自动识别 |
| `name=名字` | 自定义源名字。省略则自动取地址里的文件名（`Reject_Rule.rule` → `Reject_Rule`），重名自动加 `_2` |
| `group=组名` | **把几行合并成一张规则集**。写了同一个 group 的行，最终只产出一个 provider（FlClash）和一个 `.rule`（Loon），组名就是产物名。同组必须同策略，不写就自成一组 |

`#` 之后是注释，可以写在行尾。

### 为什么需要 group：blackmatrix7 把表拆成了两半

`blackmatrix7/ios_rule_script` 的每张规则集都拆成两个互补的文件：

| 文件 | 装什么 |
|---|---|
| `Advertising.list` | IP-CIDR、IP-CIDR6、DOMAIN-KEYWORD、USER-AGENT、URL-REGEX —— **一条域名都没有** |
| `Advertising_Domain.list` | 全部是裸域名（29.6 万行） |

**只拉其中一个会拿到一半规则，而且内核不报错、不告警，静默失效。** 所以必须成对写，再用 `group=` 拼回去。

> 这段是实测出来的。早期版本只挂 `Xxx.list` 当 provider，内核只加载了 768 条（正好等于 IP-CIDR + 关键词 + IP-CIDR6 的数量），30 万条域名一条没进去。

### 当前清单

| 组 | 策略 | 域名 | IP | 关键词 | 上游来源 |
|---|---|---|---|---|---|
| `Extra_Reject` | REJECT | 5 | — | — | `sources.json` 的 `extraRejectDomains`，手动补充，优先级最高 |
| `Reject_Rule` | REJECT | 305583 | 490 | 278 | `Advertising` + `Advertising_Domain` + `Privacy` + `Privacy_Domain` |
| `AdBlock` | REJECT | 1212 | 10 | — | dler-io 广告表 |
| `adrules` | REJECT | 14666 | — | — | adrules.top，与 `Reject_Rule` 高度重合，去重后仅剩独有部分 |
| `rejectAd` | REJECT | 597 | 7 | 13 | 奶思广告合集（APP/小程序广告） |
| `Adblock4limbo` | REJECT | 37 | — | — | 见「已知限制」 |
| `apple_update` | REJECT | 5 | — | — | Apple 系统更新（**故意拦截**，防手机被强制升级） |
| `Google_FCM` | DIRECT | 13 | 26 | — | Google 推送 |
| `Apple_Push` | DIRECT | 3 | 9 | — | Apple 推送 |
| `Direct_Rule` | DIRECT | 110308 | 12557 | 13 | `ChinaMax` + `ChinaMax_Domain` |
| `Proxy_Rule` | PROXY | 35095 | 1014 | 55 | `GlobalMedia` + `Global` + `Proxy` 及各自 `_Domain` |

`—` 表示该表不含此类规则。最终产出：

| 端 | 总条数 | provider / 文件 | 覆写规则 |
|---|---|---|---|
| FlClash | 481995 | 22 个 provider | 35 条 |
| Loon | 482197 | 11 个 `.rule` | — |
| OpenClash | 481636 | 18 个 `.mrs` + 3 个 `_KW.yaml` | — |

差额 202 条是 `USER-AGENT` 和 `URL-REGEX`，mihomo 不认，只有 Loon 收。OpenClash 那行少的是 359 条关键词规则（mrs 不支持 classical），它们走 yaml。

### 补充自定义拦截项

上游表没覆盖、又不值得为它新建一个规则源的域名，直接加在 `sources.json`：

```json
"extraRejectDomains": [
  "sentry-cdn.com",
  "updates.cdn-apple.com"
]
```

规则：

- 单独成一组 `Extra_Reject`，**排在所有规则源之前**，优先级最高
- 填裸域名即可，生成时自动加 `+.` 做后缀匹配，子域名一起拦
- 含 `/` 的按 CIDR 处理，进 IP 表（如 `1.2.3.0/24`）
- 写错会直接抛错并指出是哪一条，不会静默跳过
- 三端都产出：FlClash 的 `Extra_Reject` provider、Loon 的 `Extra_Reject.rule`、OpenClash 的 `Extra_Reject_domain.mrs`

当前放了 5 条：

| 域名 | 为什么 |
|---|---|
| `sentry-cdn.com` | 错误监控。原来被 `Proxy_Rule` 命中走了代理，白白绕一圈还浪费流量 |
| `updates.cdn-apple.com`、`updates-http.cdn-apple.com`、`updates.apple.com`、`swscan.apple.com` | Apple 系统更新下载侧。配合 `apple_update` 那张表把自动升级彻底堵死 |

> OpenClash 那套模块（`Custom_Clash_AdBlock.conf`）**故意没引用 `Extra_Reject`**——里面有 Apple 更新域名，路由器上一拦就是全家设备都升不了级，误伤面比单机大。想在 OpenClash 也生效，在模块 `[YAML]` 段自己加一个 provider 和一条规则即可。

## 转换规则

上游是多种格式混在一起的，生成器按行内容自动判断，不依赖文件后缀：

| 上游写法 | FlClash（mihomo） | Loon `.rule` |
|---|---|---|
| `.example.com`（前导点） | `+.example.com` → `domain` | `DOMAIN-SUFFIX,example.com` |
| 裸域名 `example.com` | `+.example.com` → `domain` | `DOMAIN-SUFFIX,example.com` |
| `DOMAIN,x` / `DOMAIN-SUFFIX,x` | `x` → `domain` | `DOMAIN-SUFFIX,x` |
| `IP-CIDR,x` / `IP-CIDR6,x` | 取 CIDR → `ipcidr` | `IP-CIDR(6),x,no-resolve` |
| `DOMAIN-KEYWORD,x` | 原样 → `classical` | `DOMAIN-KEYWORD,x` |
| `USER-AGENT` / `URL-REGEX` | **丢弃**（mihomo 不支持） | **保留** |
| `IP-ASN` / `AND` / `OR` / `PROCESS-NAME` 等 | 丢弃 | 丢弃 |

细节：
- **域名一律输出成 `+.example.com`**。mihomo 的 `domain` provider 里，裸域名只做**精确匹配**——写 `doubleclick.net` 拦不住 `ad.doubleclick.net`。加 `+.` 才是后缀匹配，同时覆盖根域和所有子域。实测同一张 30 万条的表，不加前缀时 adblock-tester 只有 56 分。
- 只取规则行的第一个字段，所以 `DOMAIN-SUFFIX,x,reject`（带 policy 的 Surge 写法）能正确解析。
- 注释行（`#`、`#!name=`、`;`、`//`、`!`）全部跳过。
- 不符合域名/CIDR 格式的行会计入「非法丢弃」并打印出来。

## 跨表去重

mihomo 按 `rules` 顺序匹配，先命中先生效。同一个域名在后面的表里再出现一次，行为完全不变，只是多占一份内存。

所以生成器做了一次全局去重：**按组顺序保留首次出现的那条**。当前移除 **205045 条**重复项——`adrules` 的 17 万条里绝大多数与 `Reject_Rule` 完全重复，`Advertising.list` 与 `Advertising_Domain.list` 之间也有交集。

这一步把总规则数从 68.7 万压到 48.2 万，内存占用约减少三成。**行为没有任何变化**。

去重是跨组做的，所以 `Direct_Rule` 里有些域名会被排在前面的 `Reject_Rule` 抢先 `REJECT`。这是**故意的**——同一个域名既是广告又出现在国内直连表里时，应该拦截。

## 更新

### 日常：加/删规则源（最常见）

直接改 `upstreams.txt` 就行，本地都不用装环境：

1. GitHub 网页上点开 `upstreams.txt` → 铅笔图标 → 加一行 / 删一行 → Commit
2. 等 Actions 跑完（仓库首页能看到 bot 的 `chore: rebuild dist` 提交）
3. FlClash 里重启 VPN / 重新拉取覆写脚本；Loon 里重新加载配置

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
├── mihomo/                 → 21 个 rule-provider yaml
├── loon/                   → 10 个 .rule（Loon RULE-SET 直接引用）
└── openclash/              → 17 个 .mrs（OpenClash 广告拦截层，二进制）
_upstream/                  上游规则缓存 + mrs 转换清单（不入库）
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

**`apple_update` 是故意设成 REJECT 的。** 它会拦掉 `mesu.apple.com` 和 `gdmf.apple.com`（OTA 更新元数据），手机上「设置 → 通用 → 软件更新」会提示无法检查更新——就是要这个效果。要恢复更新，把它改成 `DIRECT` 并挪到直连那组。

> **别加 `ocsp.apple.com`**。那是证书吊销检查，拦了会导致 App 闪退、装不上、企业签失效。

## 说明

- 仓库 **Public**，只有域名和 IP 规则，**没有订阅链接、节点、密码**
- `dist/` 全部由 CI 生成，不要手改
- 内网/组网（节点小宝、Tailscale）放行规则在 `guardRules` 里，改动前先看 `tunExcludeExtra`
