// 把 ACL4SSR 的 .ini 模板转成 mihomo 静态配置
//
// 为什么要这个：ACL4SSR 只提供 .ini 模板，要用必须配 subconverter 后端。
// 但 mihomo 原生支持 proxy-providers —— 订阅地址填在 provider 里，节点和规则
// 就合起来了，不需要任何转换服务。所以直接把 .ini 翻成一份 YAML 就行。
//
// .ini 语法（反引号分隔）：
//   custom_proxy_group=组名`类型`成员1`成员2...
//   ruleset=组名,规则集URL
//
// 成员写法：
//   []                 所有节点
//   []组名             所有节点 + 引用另一个组
//   .*                 所有节点（正则形式）
//   (港|HK|...)        节点名正则 → 转成 mihomo 的 filter
//   DIRECT / REJECT    关键字
//
// 用法：node tools/build-acl4ssr.js <ini 文件> <输出 yaml> [模板名]
const fs = require('fs');
const path = require('path');

const IN = process.argv[2];
const OUT = process.argv[3];
if (!IN || !OUT) {
  console.error('用法: node tools/build-acl4ssr.js <ini> <out.yaml>');
  process.exit(1);
}

// ACL4SSR 的规则集走 raw.githubusercontent，国内拉不动，统一换 jsDelivr
const RAW = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/';
const CDN = 'https://cdn.jsdelivr.net/gh/ACL4SSR/ACL4SSR@master/';
const toCdn = (u) => u.startsWith(RAW) ? CDN + u.slice(RAW.length) : u;

const text = fs.readFileSync(IN, 'utf8');

// ── 解析 ──────────────────────────────────────────────
const groups = [];
const rulesets = [];
const groupNames = new Set();

for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith(';') || line.startsWith('#')) continue;

  if (line.startsWith('custom_proxy_group=')) {
    const parts = line.slice('custom_proxy_group='.length).split('`');
    const name = parts[0].trim();
    const type = (parts[1] || 'select').trim();
    let args = parts.slice(2).map(s => s.trim()).filter(Boolean);

    // url-test / fallback 的尾巴是探测 URL 和参数：...`http://xxx`300,,50
    let testUrl = null, interval = null, tolerance = null;
    if (type === 'url-test' || type === 'fallback' || type === 'load-balance') {
      const urlIdx = args.findIndex(a => /^https?:\/\//.test(a));
      if (urlIdx >= 0) {
        testUrl = args[urlIdx];
        const param = args[urlIdx + 1];
        if (param) {
          const seg = param.split(',');
          if (seg[0]) interval = parseInt(seg[0], 10) || null;
          if (seg[1]) tolerance = parseInt(seg[1], 10) || null;
        }
        args = args.slice(0, urlIdx);
      }
    }

    const proxies = [];   // 引用的组名 / DIRECT / REJECT
    let useProvider = false;
    let filter = null;

    for (const a of args) {
      if (a === '[]' || a === '.*') { useProvider = true; continue; }
      if (a.startsWith('[]')) {
        // []组名 → 所有节点 + 引用该组
        useProvider = true;
        const ref = a.slice(2).trim();
        if (ref) proxies.push(ref);
        continue;
      }
      if (a === 'DIRECT' || a === 'REJECT') { proxies.push(a); continue; }
      if (/[()|]/.test(a) && !groupNames.has(a)) {
        // 正则：节点名过滤
        filter = a;
        useProvider = true;
        continue;
      }
      proxies.push(a);
    }

    groups.push({ name, type, proxies, useProvider, filter, testUrl, interval, tolerance });
    groupNames.add(name);
    continue;
  }

  if (line.startsWith('ruleset=')) {
    const body = line.slice('ruleset='.length);

    // 内联规则：ruleset=策略,[]GEOIP,CN  或  ruleset=策略,[]FINAL
    // 这类没有远程文件，直接落到 rules 里
    const inline = body.match(/^(.*?),\[\](.+)$/);
    if (inline) {
      const policy = inline[1].trim();
      let rule = inline[2].trim();
      if (/^FINAL$/i.test(rule)) rule = 'MATCH';
      rulesets.push({ policy, inline: rule });
      continue;
    }

    const idx = body.lastIndexOf(',');
    if (idx < 0) continue;
    const policy = body.slice(0, idx).trim();
    const url = body.slice(idx + 1).trim();
    if (!url) continue;
    rulesets.push({ policy, url: toCdn(url) });
    continue;
  }
}

console.log('解析: ' + groups.length + ' 个策略组, ' + rulesets.length + ' 条规则集');

// ── 生成 YAML ─────────────────────────────────────────
const q = (s) => '"' + String(s).replace(/"/g, '\\"') + '"';
const lines = [];

const HEADER = [
  '# ACL4SSR 静态配置（proxy-providers 版）',
  '#',
  '# 由 tools/build-acl4ssr.js 从 ACL4SSR_Online_Full.ini 生成，不要手改。',
  '# 模板来源: https://github.com/ACL4SSR/ACL4SSR',
  '#',
  '# 与官方 .ini 的区别：',
  '#   官方需要 subconverter 后端把「订阅 + .ini」合成配置；',
  '#   这里用 mihomo 原生的 proxy-providers，订阅地址直接填在 provider 里，',
  '#   不需要任何转换服务。',
  '#',
  '# 规则集的 URL 已从 raw.githubusercontent.com 换成 jsDelivr，',
  '# 否则国内拉不动。',
  '#',
  '# 用法：把 SUBSCRIPTION_URL 换成你的订阅链接，然后：',
  '#   OpenClash  → 覆写模块填 EN_KEY1',
  '#   FlClash    → 用配套的覆写脚本',
];
lines.push(...HEADER, '');

lines.push('proxy-providers:');
lines.push('  sub:');
lines.push('    type: http');
lines.push('    url: "SUBSCRIPTION_URL"   # ← 换成你的订阅链接');
lines.push('    path: ./providers/sub.yaml');
lines.push('    interval: 3600');
lines.push('    proxy: DIRECT');
lines.push('    health-check:');
lines.push('      enable: true');
lines.push('      url: https://www.gstatic.com/generate_204');
lines.push('      interval: 300');
lines.push('');

lines.push('proxy-groups:');
for (const g of groups) {
  lines.push('  - name: ' + q(g.name));
  lines.push('    type: ' + g.type);
  if (g.proxies.length) {
    lines.push('    proxies:');
    for (const p of g.proxies) lines.push('      - ' + q(p));
  }
  if (g.useProvider) {
    lines.push('    use:');
    lines.push('      - sub');
  }
  if (g.filter) {
    lines.push('    filter: ' + q(g.filter));
  }
  if (g.type === 'url-test' || g.type === 'fallback' || g.type === 'load-balance') {
    lines.push('    url: ' + q(g.testUrl || 'http://www.gstatic.com/generate_204'));
    lines.push('    interval: ' + (g.interval || 300));
    if (g.tolerance) lines.push('    tolerance: ' + g.tolerance);
  }
  lines.push('');
}

lines.push('rule-providers:');
const seen = new Map();
for (const r of rulesets) {
  if (r.inline) continue;   // 内联规则不进 provider
  const base = path.basename(new URL(r.url).pathname).replace(/\.(list|yaml|yml|txt)$/i, '');
  let key = base.replace(/[^A-Za-z0-9_]/g, '_');
  if (seen.has(key)) { seen.set(key, seen.get(key) + 1); key = key + '_' + seen.get(key); }
  else seen.set(key, 1);
  r.key = key;
  lines.push('  ' + key + ':');
  lines.push('    type: http');
  lines.push('    behavior: classical');
  lines.push('    url: ' + q(r.url));
  lines.push('    path: ./rules/' + key + '.list');
  lines.push('    interval: 86400');
}
lines.push('');

lines.push('rules:');
// 按 .ini 里的声明顺序，这个顺序本身就是 ACL4SSR 设计好的优先级
for (const r of rulesets) {
  if (r.inline) {
    // GEOIP,CN → GEOIP,CN,策略   /   MATCH → MATCH,策略
    lines.push('  - ' + q(r.inline + ',' + r.policy));
  } else {
    lines.push('  - ' + q('RULE-SET,' + r.key + ',' + r.policy));
  }
}
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('输出: ' + OUT + '  (' + lines.length + ' 行, ' +
  (Buffer.byteLength(lines.join('\n')) / 1024).toFixed(1) + ' KB)');
