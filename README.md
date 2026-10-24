# flclash-ruleset · 规则中心

一处维护，三端下发。规则源是 [Code-Dramatist/Rule_Actions](https://github.com/Code-Dramatist/Rule_Actions)（Loon 格式），CI 自动转成 mihomo 格式给 FlClash 用，Loon 端直接引用上游。

```
sources.json
    │
    ├─ CI 拉取上游 .rule ─→ 分类 ─→ dist/mihomo/*.yaml  ─→ FlClash
    │                        ├─ 域名    → behavior: domain
    │                        ├─ IP 段   → behavior: ipcidr
    │                        └─ 关键词  → behavior: classical
    │
    └─ Loon 端直接用上游原始 .rule（本来就是 Loon 格式，不需要转）
```

## 地址

**FlClash（Windows / Android）** — 覆写 → 模式「脚本」→ 远程下载：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@0ddab17/dist/flclash-override.js
```

> ⚠️ **`@main` 和固定 SHA 的区别只在更新延迟。** jsDelivr 对 `@main` 有最长 12 小时缓存，`purge` 接口实测不可靠（返回 200 但内容不变）。
> 不着急就用 `@main`，改完等半天自动生效；要立刻拿到最新版就用固定 SHA（每次更新我会给新的 SHA）。

**Loon（iOS）** — 配置从 URL 导入：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/loon/loon.conf
```

Loon 端引用的是上游原始 `.rule` 的 jsDelivr 镜像，规则内容永远跟着上游走，不依赖我这边的 CI 中转（`loon.conf` 格式稳定，`@main` 缓存无所谓）。

## 转换规则

上游 `.rule` 是三种格式混在一起，CI 按类型拆分：

| 上游格式 | 数量（Reject / Direct / Proxy） | mihomo 产物 | behavior |
|---|---|---|---|
| `.domain` 或裸域名 | 304969 / 110748 / 35430 | `<名>_Domain.yaml` | `domain` |
| `IP-CIDR` / `IP-CIDR6` | 490 / 12557 / 1029 | `<名>_IP.yaml` | `ipcidr` |
| `DOMAIN-KEYWORD,x` | 278 / 13 / 55 | `<名>_KW.yaml` | `classical` |
| `USER-AGENT` / `URL-REGEX` / `IP-ASN` | 143 / 66 / 15 | **丢弃** | mihomo 不支持 |

前导点会被去掉（`.0.avmarket.rs` → `0.avmarket.rs`）。mihomo 的 `domain` provider 本身就是后缀匹配，语义和 Loon 的 `.` 前缀一致。

## 更新

```powershell
cd D:\ProgramData\WorkBuddy\2026-10-24-10-31-21\flclash-ruleset
node tools/build.js --fetch     # 可选：本地先跑一遍看效果
git add -A
git commit -m "update"
git push
```

push 后 CI 自动拉上游、重新生成 `dist/` 并提交。三端下次拉取就是新的。

本地不加 `--fetch` 时用 `_upstream/` 缓存（该目录已 gitignore，不入库）。

## 目录

```
sources.json                ★ 唯一真源
tools/build.js              生成器（零依赖，Node 18+）
.github/workflows/build.yml CI
dist/
├── flclash-override.js     → FlClash 覆写脚本
├── mihomo/                 → 9 个 rule-provider yaml
└── loon/loon.conf          → Loon 配置
_upstream/                  上游 .rule 缓存（不入库）
```

仓库只有上面这些。旧的 `ruleset/` 22 个手工 yaml、`dist/loon/*.list` 已于 2026-10-24 删除——全部由 `dist/mihomo/` 和上游直连替代。

## 说明

- 仓库 **Public**，只有域名和 IP 规则，**没有订阅链接、节点、密码**
- `dist/` 全部由 CI 生成，不要手改
- `sources.json` 里 `upstream` 的数组顺序 = 规则优先级（先 Reject 拦截，再 Direct 直连，最后 Proxy）
