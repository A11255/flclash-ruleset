#!/usr/bin/env node
/**
 * 规则中心 · 生成器（FlClash 单端）
 *
 * 流程：
 *   1. 读 upstreams.txt（一行一个规则源地址）拉取规则文件
 *      （Loon .rule / Surge .list / kelee .lsr 三种格式都能吃）
 *   2. 自动分类成 domain / ipcidr / classical 三组，并按优先级跨规则集去重
 *   3. 生成 mihomo rule-provider yaml  →  dist/mihomo/*.yaml
 *   4. 生成 FlClash 覆写脚本           →  dist/flclash-override.js
 *
 * 用法：
 *   node tools/build.js           有本地缓存就用缓存
 *   node tools/build.js --fetch   强制重新下载
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '_upstream');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.json'), 'utf8'));
const CDN = src.cdnBase;
const FORCE = process.argv.includes('--fetch');
const DROP = new Set((src.dropRuleTypes || []).map(x => x.toUpperCase()));

// ══════════════════════════════════════════════
// upstreams.txt —— 唯一手工维护的规则源清单
//
// 一行一条：  [策略] 地址 [选项...]
// 这样加/减一个规则源只需要改一行文本，不用碰 JSON，也不用管 provider 命名。
// ══════════════════════════════════════════════
const UPSTREAM_TXT = path.join(ROOT, 'upstreams.txt');
const POLICY_ALIAS = { R: 'REJECT', D: 'DIRECT', P: 'PROXY', BLOCK: 'REJECT' };

function sanitizeName(s) {
  return s.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'Source';
}

// 策略省略时按地址/名字里的关键词猜。猜不出就报错，不瞎默认。
function guessPolicy(url, name) {
  const h = (url + ' ' + name).toLowerCase();
  if (/(reject|adblock|adrules|adguard|rejectad|ads?\b|ban)/.test(h)) return 'REJECT';
  if (/(direct|cloudflarecn|china|domestic|intranet)/.test(h)) return 'DIRECT';
  if (/(proxy|gfw|oversea|foreign)/.test(h)) return 'PROXY';
  return null;
}

function parseUpstreams(text, file) {
  const out = [];
  const used = new Set();

  text.split(/\r?\n/).forEach((raw, idx) => {
    const no = idx + 1;
    // 支持行尾注释：第一个「空白 + #」之后全部丢掉
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!line) return;

    let url = null, policy = null, name = null, group = null;

    for (const tok of line.split(/\s+/)) {
      if (/^https?:\/\//i.test(tok)) { url = tok; continue; }
      if (/^name=.+/i.test(tok)) { name = tok.slice(5); continue; }
      if (/^group=.+/i.test(tok)) { group = tok.slice(6); continue; }
      const up = tok.toUpperCase();
      if (POLICY_ALIAS[up] || up === 'REJECT' || up === 'DIRECT' || up === 'PROXY') {
        policy = POLICY_ALIAS[up] || up;
        continue;
      }
      throw new Error(file + ' 第 ' + no + ' 行无法识别：「' + tok + '」\n' +
        '  允许的写法：REJECT/DIRECT/PROXY（或 R/D/P）、http(s) 地址、name=名字、group=组名');
    }

    if (!url) {
      throw new Error(file + ' 第 ' + no + ' 行没找到 http(s) 地址：「' + line + '」');
    }

    // 名字：显式 name= 优先，否则取 URL 最后一段去扩展名
    let base = name;
    if (!base) {
      const seg = decodeURIComponent(url.split('?')[0].split('#')[0].split('/').pop() || '');
      base = seg.replace(/\.[A-Za-z0-9]+$/, '');
    }
    base = sanitizeName(base);
    let nm = base, n = 2;
    while (used.has(nm)) nm = base + '_' + (n++);
    used.add(nm);

    if (!policy) policy = guessPolicy(url, nm);
    if (!policy) {
      throw new Error(file + ' 第 ' + no + ' 行推断不出策略，请显式写 REJECT / DIRECT / PROXY：\n  ' + url);
    }

    const e = { name: nm, url, policy };
    if (group) e.group = sanitizeName(group);
    out.push(e);
  });

  if (!out.length) throw new Error(file + ' 里一条规则源都没有');
  return out;
}

if (fs.existsSync(UPSTREAM_TXT)) {
  src.upstream = parseUpstreams(fs.readFileSync(UPSTREAM_TXT, 'utf8'), 'upstreams.txt');
}
if (!Array.isArray(src.upstream)) src.upstream = [];

function ensure(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

async function loadRemote(u) {
  const cache = path.join(CACHE, u.name + '.rule');
  if (!FORCE && fs.existsSync(cache)) {
    return fs.readFileSync(cache, 'utf8');
  }
  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 没有 fetch，请先准备 _upstream 缓存或升级 Node 到 18+');
  }
  // 原地址失败时自动走 jsDelivr 镜像重试一次（GitHub raw 在 CI 上偶尔 5xx）
  const tries = [u.url];
  const alt = toCdn(u.url);
  if (alt !== u.url) tries.push(alt);

  let lastErr = null;
  for (const url of tries) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': 'flclash-ruleset-builder' }
      });
      if (!res.ok) {
        lastErr = new Error('HTTP ' + res.status + '  ' + url);
        continue;
      }
      const txt = await res.text();
      ensure(CACHE);
      fs.writeFileSync(cache, txt, 'utf8');
      return txt;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error('下载失败【' + u.name + '】\n  地址: ' + u.url +
    '\n  原因: ' + (lastErr && lastErr.message) +
    '\n  解法: 换个地址；或者这源只有你的设备能访问，就在 upstreams.txt 该行末尾加 flclash:off');
}

// 合法域名：字母数字开头，允许 . - _ *（* 是泛域名通配）
const DOMAIN_RE = /^[a-z0-9*][a-z0-9.\-_*]*$/;
// 合法 CIDR：v4 或 v6
const CIDR_RE = /^[0-9a-fA-F:.]+\/\d{1,3}$/;
// Loon 认、mihomo 不认的规则类型。上游表里这类规则不少（ChinaMax 有 65 条 USER-AGENT）。
const LOON_ONLY = new Set(['USER-AGENT', 'URL-REGEX', 'IP-ASN', 'PROTOCOL']);

/**
 * 把规则文件拆成 domain / ip / keyword 三类。
 * 支持三种上游格式：
 *   - Code-Dramatist .rule ：前导点域名 `.0.avmarket.rs` + 裸域名 + 规则行
 *   - Surge/Loon .list     ：`DOMAIN,x` / `DOMAIN-SUFFIX,x` / `IP-CIDR,x` / `DOMAIN-KEYWORD,x`
 *   - kelee .lsr           ：同上，可能带第三个字段（如 `,reject`）
 */
function classify(text) {
  const domain = new Set();
  const ip = new Set();
  const kw = new Set();
  // LOON_ONLY 这些类型 mihomo 不认，但 Loon 认。单独收集，只写进 Loon 的 .rule 文件。
  const extras = new Set();
  const dropped = {};
  const bad = { domain: 0, ip: 0 };

  const drop = (t) => { dropped[t] = (dropped[t] || 0) + 1; };

  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) continue;
    // 注释行：# 开头（含 #!name= 这类元数据）、; / // / ! 开头
    if (l[0] === '#' || l[0] === ';' || l[0] === '!') continue;
    if (l.startsWith('//')) continue;

    const i = l.indexOf(',');
    if (i === -1) {
      // 裸域名行（可能带前导点）
      const d = l.replace(/^\.+/, '').toLowerCase();
      if (DOMAIN_RE.test(d)) domain.add(d);
      else bad.domain++;
      continue;
    }

    const type = l.slice(0, i).trim().toUpperCase();
    // 只取第一个字段，忽略 policy / no-resolve / reject 等附加参数
    const arg = l.slice(i + 1).split(',')[0].trim();

    if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') {
      const d = arg.replace(/^\.+/, '').toLowerCase();
      if (d && DOMAIN_RE.test(d)) domain.add(d);
      else bad.domain++;
    } else if (type === 'IP-CIDR' || type === 'IP-CIDR6') {
      if (CIDR_RE.test(arg)) ip.add(arg);
      else bad.ip++;
    } else if (type === 'DOMAIN-KEYWORD') {
      if (arg) kw.add('DOMAIN-KEYWORD,' + arg.toLowerCase());
    } else if (LOON_ONLY.has(type)) {
      // 原样收下，只给 Loon 用
      extras.add(l);
      drop(type);
    } else {
      drop(type);
    }
  }
  return { domain, ip, kw, extras, dropped, bad };
}

function yamlPayload(arr) {
  return 'payload:\n' + arr.map(x => "  - '" + String(x).replace(/'/g, "''") + "'").join('\n') + '\n';
}

function pm(target, policy) {
  const m = (src.policyMap || {})[target] || {};
  return m[policy] || policy;
}

/**
 * 上游链接 → jsDelivr 镜像（仅 GitHub 链接，其他域名原样返回）
 * 支持两种写法：
 *   raw.githubusercontent.com/<u>/<r>/<b>/<p>
 *   github.com/<u>/<r>/raw/refs/heads/<b>/<p>  /  github.com/<u>/<r>/raw/<b>/<p>
 * 国内直连 raw.githubusercontent.com 不稳定，统一走 jsDelivr。下载失败时也会用它重试。
 */
function toCdn(url) {
  let m = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (m) return 'https://cdn.jsdelivr.net/gh/' + m[1] + '/' + m[2] + '@' + m[3] + '/' + m[4];
  m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/(?:refs\/heads\/)?([^/]+)\/(.+)$/);
  if (m) return 'https://cdn.jsdelivr.net/gh/' + m[1] + '/' + m[2] + '@' + m[3] + '/' + m[4];
  return url;
}

// ══════════════════════════════════════════════
// FlClash 覆写脚本
// ══════════════════════════════════════════════
function buildFlClash(sets) {
  const pv = [];
  const rules = [];

  function provEntry(name, behavior, file) {
    return '  ' + name + ': {\n' +
      '    type: "http",\n' +
      '    behavior: ' + JSON.stringify(behavior) + ',\n' +
      '    format: "yaml",\n' +
      '    url: URL_BASE + ' + JSON.stringify(file) + ',\n' +
      '    interval: UPDATE_INTERVAL,\n' +
      '    path: "./providers/" + ' + JSON.stringify(file) + '\n' +
      '  }';
  }

  for (const g of src.guardRules || []) rules.push(JSON.stringify(g));

  // 关键词表最先匹配（classical 是包含匹配，优先级最高）
  for (const s of sets) {
    if (!s.k || !s.k.kw.size) continue;
    rules.push(JSON.stringify('RULE-SET,' + s.name + '_KW,' + pm('flclash', s.policy)));
    pv.push(provEntry(s.name + '_KW', 'classical', s.name + '_KW.yaml'));
  }
  // 域名表
  for (const s of sets) {
    if (!s.k || !s.k.domain.size) continue;
    rules.push(JSON.stringify('RULE-SET,' + s.name + ',' + pm('flclash', s.policy)));
    pv.push(provEntry(s.name, 'domain', s.name + '_Domain.yaml'));
  }
  // IP 表放最后，全部 no-resolve（避免为纯 IP 规则触发 DNS 解析）
  for (const s of sets) {
    if (!s.k || !s.k.ip.size) continue;
    rules.push(JSON.stringify('RULE-SET,' + s.name + '_IP,' + pm('flclash', s.policy) + ',no-resolve'));
    pv.push(provEntry(s.name + '_IP', 'ipcidr', s.name + '_IP.yaml'));
  }

  for (const t of src.tailRules || []) rules.push(JSON.stringify(t));
  rules.push('"MATCH," + PROXY_GROUP');

  const js = `// ============================================================================
// FlClash 覆写脚本 · 自动生成，请勿手改
// 源：sources.json → tools/build.js
// 改规则请改 sources.json 并 push，CI 会重新生成
// ============================================================================

var URL_BASE = ${JSON.stringify(CDN + '/dist/mihomo/')};
var UPDATE_INTERVAL = 86400;
var PROXY_GROUP = "节点选择";

var FAKE_IP_FILTER_EXTRA = ${JSON.stringify(src.fakeIpFilterExtra || [], null, 2)};
var TUN_EXCLUDE_EXTRA = ${JSON.stringify(src.tunExcludeExtra || [], null, 2)};

var PROVIDERS = {
${pv.join(',\n')}
};

var RULES = [
${rules.join(',\n')}
];

function resolveProxyGroup(config) {
  var g = config["proxy-groups"] || [], i;
  for (i = 0; i < g.length; i++) if (g[i] && g[i].name === PROXY_GROUP) return PROXY_GROUP;
  for (i = 0; i < g.length; i++) if (g[i] && g[i].type === "select") return g[i].name;
  return "PROXY";
}

function main(config) {
  config = config || {};
  var target = resolveProxyGroup(config);

  var all = config["rule-providers"] || {}, k;
  for (k in PROVIDERS) if (PROVIDERS.hasOwnProperty(k)) all[k] = PROVIDERS[k];
  config["rule-providers"] = all;

  if (config.dns && typeof config.dns === "object") {
    var fif = config.dns["fake-ip-filter"] || [], fi;
    for (fi = 0; fi < FAKE_IP_FILTER_EXTRA.length; fi++) {
      if (fif.indexOf(FAKE_IP_FILTER_EXTRA[fi]) === -1) fif.push(FAKE_IP_FILTER_EXTRA[fi]);
    }
    config.dns["fake-ip-filter"] = fif;
  }

  if (config.tun && typeof config.tun === "object") {
    var rex = config.tun["route-exclude-address"] || [], ti;
    for (ti = 0; ti < TUN_EXCLUDE_EXTRA.length; ti++) {
      if (rex.indexOf(TUN_EXCLUDE_EXTRA[ti]) === -1) rex.push(TUN_EXCLUDE_EXTRA[ti]);
    }
    config.tun["route-exclude-address"] = rex;
  }

  var out = [], i;
  for (i = 0; i < RULES.length; i++) {
    var r = RULES[i];
    out.push(r.indexOf("MATCH,") === 0 ? "MATCH," + target : r);
  }
  config.rules = out;

  console.log("FlClash 覆写完成 | provider=" + Object.keys(PROVIDERS).length +
    " | 规则=" + out.length + " | 组=" + target);
  return config;
}
`;
  fs.writeFileSync(path.join(DIST, 'flclash-override.js'), js, 'utf8');
  return { providers: pv.length, rules: rules.length };
}

// ══════════════════════════════════════════════
// Loon 规则文件（RULE-SET 可直接引用）
//
// 每个 group 输出一个 dist/loon/<组名>.rule，格式为 Loon 的规则集语法：
//     TYPE,value[,no-resolve]
// 不带策略列 —— 策略写在 Loon 配置的 RULE-SET 那一行里。
// ══════════════════════════════════════════════
function buildLoonRules(groups) {
  const dir = path.join(DIST, 'loon');
  ensure(dir);
  const keep = new Set();
  const stat = [];

  for (const g of groups) {
    const { k } = g;
    const lines = [];

    // 顺序与 FlClash 端保持一致：关键词 → 域名 → Loon 专用 → IP
    for (const v of Array.from(k.kw).sort()) lines.push(v);
    for (const d of Array.from(k.domain).sort()) lines.push('DOMAIN-SUFFIX,' + d);
    for (const e of Array.from(k.extras).sort()) lines.push(e);
    for (const c of Array.from(k.ip).sort()) {
      lines.push((c.includes(':') ? 'IP-CIDR6,' : 'IP-CIDR,') + c + ',no-resolve');
    }

    // 头部刻意不写生成时间：否则每次 CI 都产生一份纯时间戳的 diff，
    // 仓库日志会被无意义提交灌满，也看不出规则到底有没有变。
    const head = [
      '# NAME: ' + g.name,
      '# POLICY: ' + g.policy + '   （在 Loon 的 [Rule] 段用 RULE-SET 指定，本文件不含策略）',
      '# SOURCES: ' + g.members.join(', '),
      '# TOTAL: ' + lines.length,
      '# 用法: RULE-SET,' + CDN + '/dist/loon/' + g.name + '.rule,' + g.policy,
    ];

    // 内容没变就不落盘，避免 mtime 变动
    const fname = g.name + '.rule';
    const out = path.join(dir, fname);
    keep.add(fname);
    const content = head.join('\n') + '\n\n' + lines.join('\n') + '\n';
    if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== content) {
      fs.writeFileSync(out, content, 'utf8');
    }
    stat.push({ name: g.name, lines: lines.length });
  }

  // 删掉这一轮不再需要的旧文件（组被删掉或改名了）
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.rule') && !keep.has(f)) fs.unlinkSync(path.join(dir, f));
  }
  return stat;
}

// ══════════════════════════════════════════════
(async () => {
  ensure(DIST);
  const mihomoDir = path.join(DIST, 'mihomo');
  ensure(mihomoDir);
  // 清掉上一轮产物，避免改了组名之后留下孤儿 provider 文件（Dist 全是生成物，可随时重造）
  for (const f of fs.readdirSync(mihomoDir)) {
    if (f.endsWith('.yaml')) fs.unlinkSync(path.join(mihomoDir, f));
  }

  const sets = [];
  console.log('=== 拉取并转换上游规则 ===');
  for (const u of src.upstream) {
    const text = await loadRemote(u);
    const k = classify(text);
    sets.push({ u, k });
  }

  // ── 按 group 聚合 ──
  // upstreams.txt 里写了 group=xxx 的源会合并成一个组，最终只产出一个 provider。
  // 用途：blackmatrix7 把一张规则集拆成 Xxx.list（装 IP/关键词/UA）和
  // Xxx_Domain.list（装域名）两份，必须成对拉取再拼回一张完整规则集，
  // 否则只拿到一半规则且内核不报错。
  // 没写 group 的源自成一组，组名 = 源名，行为与改动前完全一致。
  const groupMap = new Map();
  for (const s of sets) {
    const gname = s.u.group || s.u.name;
    if (!groupMap.has(gname)) {
      groupMap.set(gname, {
        name: gname,
        policy: s.u.policy,
        k: { domain: new Set(), ip: new Set(), kw: new Set(), extras: new Set() },
        members: [],
        dropped: {},
        bad: { domain: 0, ip: 0 },
      });
    }
    const g = groupMap.get(gname);
    if (g.policy !== s.u.policy) {
      throw new Error('group=' + gname + ' 里的源策略不一致：' + g.policy + ' vs ' +
        s.u.policy + '（' + s.u.name + '），同组必须同策略');
    }
    g.members.push(s.u.name);
    for (const cls of ['domain', 'ip', 'kw', 'extras']) {
      for (const v of s.k[cls]) g.k[cls].add(v);
    }
    for (const t in s.k.dropped) g.dropped[t] = (g.dropped[t] || 0) + s.k.dropped[t];
    g.bad.domain += s.k.bad.domain;
    g.bad.ip += s.k.bad.ip;
  }
  const groups = Array.from(groupMap.values());

  // ── 跨规则集去重 ──
  // mihomo 按 RULES 顺序匹配，先命中先生效。同一个域名/网段在后面的规则集里
  // 再出现一次不会有任何行为差异，只会多占一份内存。这里按「先出现者保留」去重。
  const seen = { domain: new Set(), ip: new Set(), kw: new Set() };
  let removed = 0;
  for (const g of groups) {
    const rm = { domain: 0, ip: 0, kw: 0 };
    for (const cls of ['kw', 'domain', 'ip']) {
      const kept = new Set();
      for (const v of g.k[cls]) {
        if (seen[cls].has(v)) rm[cls]++;
        else { seen[cls].add(v); kept.add(v); }
      }
      g.k[cls] = kept;
    }
    g.rm = rm;
    removed += rm.domain + rm.ip + rm.kw;
  }

  let totalD = 0, totalI = 0, totalK = 0, totalE = 0;
  for (const g of groups) {
    const { k } = g;
    const out = [];
    if (k.domain.size) {
      fs.writeFileSync(path.join(mihomoDir, g.name + '_Domain.yaml'),
        yamlPayload(Array.from(k.domain).sort()), 'utf8');
      out.push('domain ' + k.domain.size);
      totalD += k.domain.size;
    }
    if (k.ip.size) {
      fs.writeFileSync(path.join(mihomoDir, g.name + '_IP.yaml'),
        yamlPayload(Array.from(k.ip).sort()), 'utf8');
      out.push('ip ' + k.ip.size);
      totalI += k.ip.size;
    }
    if (k.kw.size) {
      fs.writeFileSync(path.join(mihomoDir, g.name + '_KW.yaml'),
        yamlPayload(Array.from(k.kw).sort()), 'utf8');
      out.push('kw ' + k.kw.size);
      totalK += k.kw.size;
    }
    totalE += k.extras.size;

    const dup = Object.keys(g.rm).filter(x => g.rm[x]).map(x => x + '-dup ' + g.rm[x]);
    const dk = Object.keys(g.dropped);
    const ds = dk.length ? '  跳过: ' + dk.map(x => x + '×' + g.dropped[x]).join(', ') : '';
    const bs = (g.bad.domain + g.bad.ip) ? '  非法丢弃: ' + (g.bad.domain + g.bad.ip) : '';
    const ms = g.members.length > 1 ? '  ← ' + g.members.length + ' 个源合并' : '';
    console.log('  ' + (g.name + ' (' + g.policy + ')').padEnd(24) + out.join('  ') +
      (dup.length ? '  [' + dup.join(', ') + ']' : '') + ds + bs + ms);
  }

  console.log('');
  console.log('=== 生成产物 ===');
  const f = buildFlClash(groups);
  console.log('  dist/flclash-override.js   provider ' + f.providers + ' / 规则 ' + f.rules + ' 条');
  console.log('  dist/mihomo/               ' + fs.readdirSync(mihomoDir).length + ' 个 rule-provider yaml');

  const loonStat = buildLoonRules(groups);
  for (const s of loonStat) {
    console.log('  dist/loon/' + (s.name + '.rule').padEnd(24) + s.lines + ' 条（Loon RULE-SET 可直接引用）');
  }

  console.log('');
  console.log('  去重移除 ' + removed + ' 条重复项');
  console.log('  合计 domain=' + totalD + '  ip=' + totalI + '  kw=' + totalK +
    '  Loon专用=' + totalE + '  总计 ' + (totalD + totalI + totalK + totalE));
  console.log('');
  console.log('完成 → dist/');
})();
