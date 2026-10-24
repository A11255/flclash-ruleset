# flclash-ruleset

FlClash（mihomo 内核）用的自定义规则集，配合覆写脚本实现「订阅更新后规则依然生效」。

## 文件说明

```
ruleset/                    22 个 rule-provider 文件
├── Reject_Rule.yaml        domain  · 广告/垃圾域名，约 30.5 万条
├── Reject_Rule_IP.yaml     ipcidr  · 490 条
├── Reject_Rule_KW.yaml     classical · 278 条 DOMAIN-KEYWORD
├── AdBlock_IP.yaml         ipcidr  · 57 条
├── Direct_Rule.yaml        domain  · 国内直连，约 11 万条
├── Direct_Rule_IP.yaml     ipcidr  · 1.25 万条
├── Direct_Rule_KW.yaml     classical · 13 条
├── Apple_Push.yaml         domain  · 3 条
├── Apple_Push_IP.yaml      ipcidr  · 9 条
├── apple_update.yaml       domain  · 9 条
├── Google_FCM.yaml         domain  · 15 条
├── Google_FCM_IP.yaml      ipcidr  · 26 条
├── Proxy_Rule.yaml         domain  · 走代理，约 3.5 万条
├── Proxy_Rule_IP.yaml      ipcidr  · 1029 条
├── Proxy_Rule_KW.yaml      classical · 55 条
├── AdBlock.yaml            domain  · 7155 条（full 模式）
├── Adblock4limbo.yaml      domain  · 491 条（full 模式）
├── Adblock4limbo_KW.yaml   classical · 34 条（full 模式）
├── adrules.yaml            domain  · 21 万条（full 模式）
├── rejectAd.yaml           domain  · 2465 条（full 模式）
├── rejectAd_IP.yaml        ipcidr  · 29 条（full 模式）
└── rejectAd_KW.yaml        classical · 98 条（full 模式）

flclash-override.js         FlClash 覆写脚本
```

**behavior 必须和文件内容匹配**，填错会加载失败：

| behavior | payload 内容 |
|---|---|
| `domain` | 纯域名 |
| `ipcidr` | IP 段 |
| `classical` | 完整规则语法（`_KW` 文件内含 `DOMAIN-KEYWORD,xxx`） |

## 访问地址

jsDelivr（推荐，国内可直连）：

```
https://cdn.jsdelivr.net/gh/<用户名>/flclash-ruleset@main/ruleset/<文件名>
```

raw 备用（国内可能超时）：

```
https://raw.githubusercontent.com/<用户名>/flclash-ruleset/main/ruleset/<文件名>
```

jsDelivr 首次访问会回源 GitHub 并缓存，仓库更新后可能需要等缓存过期，或用
`https://purge.jsdelivr.net/gh/<用户名>/flclash-ruleset@main/ruleset/<文件名>` 手动刷新。

## 更新规则集

本地替换 `ruleset/` 下的文件后：

```bash
git add -A
git commit -m "update ruleset"
git push
```

FlClash 会按覆写脚本里的 `interval`（默认 86400 秒）自动重新拉取。

## 注意

- 本仓库必须**公开**，jsDelivr 才能读取。
- 仓库里只有域名/IP 规则，**不含任何订阅链接、节点、密码**。
