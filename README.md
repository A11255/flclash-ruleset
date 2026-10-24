# flclash-ruleset · 规则中心

一处维护，三端自动下发。Windows / Android 的 FlClash 和 iOS 的 Loon 共用同一份规则清单。

## 怎么用

### 唯一需要维护的文件

只有 **`sources.json`** 需要你改。改完 push，GitHub Actions 自动重新生成 `dist/` 下的所有产物，三端从 CDN 重新拉取即可。

```json
{
  "name": "AdBlock",
  "file": "ruleset/AdBlock.yaml",
  "behavior": "domain",
  "policy": "REJECT",
  "targets": ["loon"]
}
```

- `targets` 决定这个规则集进哪一端：`["flclash"]` / `["loon"]` / 两个都写
- `policy` 只能填 `REJECT` / `DIRECT` / `PROXY`，生成时会自动映射成各端的策略名

### 三端地址

**FlClash（Windows / Android）** — 覆写 → 模式「脚本」→ 远程下载：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/flclash-override.js
```

**Loon（iOS）** — 配置从 URL 导入：

```
https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/loon/loon.conf
```

或者只把 `dist/loon/loon.conf` 里的 `[Rule]` 段复制到你现有的配置里，避免覆盖你的 `[General]` 设置。

单个规则集也可以单独引用（`.list` 格式）：

```
RULE-SET,https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/loon/AdBlock.list,REJECT
```

### 更新流程

```powershell
cd D:\ProgramData\WorkBuddy\2026-10-24-10-31-21\flclash-ruleset
# 改 sources.json 或替换 ruleset/ 下的文件
git add -A
git commit -m "update"
git push
```

CI 自动跑 `tools/build.js` → 提交 `dist/` → 三端下次拉取就是新的。

想立刻生效，先刷 CDN 缓存：

```
https://purge.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/flclash-override.js
```

## 目录

```
sources.json                ★ 唯一真源，只改这个
tools/build.js              生成器（无第三方依赖）
.github/workflows/build.yml CI：改 sources.json 就自动生成
ruleset/                    22 个原始规则集（mihomo yaml payload 格式）
dist/
├── flclash-override.js     → FlClash 用
└── loon/
    ├── loon.conf           → Loon 配置模板
    └── *.list              → Loon 规则集（从 yaml 转的）
flclash-override.js         旧版手写脚本，保留兼容，不再更新
```

## 为什么 Loon 端的规则集是精简过的

`Reject_Rule`（30 万条）和 `Direct_Rule`（11 万条）只给 FlClash 用。iOS 内存撑不住，硬转成 `.list` 会是 10 MB 级别的文本，Loon 加载直接崩。

Loon 端的替代方案：

- 广告：`AdBlock`（7155 条）+ 几个 `_KW` 关键词表
- 国内直连：`GEOIP,CN,DIRECT` 兜底，不靠域名表

要改这个取舍，直接改 `sources.json` 里对应条目的 `targets`。

## 说明

- 仓库是 **Public**，里面只有域名和 IP 规则，**没有订阅链接、节点、密码**
- `.list` 文件由 CI 从 yaml 自动转换，不要手改
