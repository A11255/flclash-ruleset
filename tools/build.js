#!/usr/bin/env node
/**
 * 规则中心 · 生成器
 *
 * 流程：
 *   1. 从 sources.json.upstream 拉取 Loon 格式的 .rule 文件
 *   2. 自动分类成 domain / ipcidr / classical 三组
 *   3. 生成 mihomo rule-provider yaml  →  dist/mihomo/
 *   4. 生成 FlClash 覆写脚本           →  dist/flclash-override.js
 *   5. 生成 Loon 配置（直接引用上游原始链接）→  dist/loon/loon.conf
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
  const res = await fetch(u.url);
  if (!res.ok) throw new Error(u.name + ' -> HTTP ' + res.status);
  const txt = await res.text();
  ensure(CACHE);
  fs.writeFileSync(cache, txt, 'utf8');
  return txt;
}

/** 把 .rule 拆成 domain / ip / keyword 三类 */
function classify(text) {
  const domain = new Set();
  const ip = new Set();
  const kw = new Set();
  const dropped = {};

  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#') || l.startsWith(';') || l.startsWith('//')) continue;

    const i = l.indexOf(',');
    if (i === -1) {
      const d = l.replace(/^\./, '').toLowerCase();
      if (d && d.indexOf(' ') === -1) domain.add(d);
      continue;
    }

    const type = l.slice(0, i).trim().toUpperCase();
    const rest = l.slice(i + 1).trim();

    if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') {
      const d = rest.replace(/^\./, '').toLowerCase();
      if (d) domain.add(d);
    } else if (type === 'IP-CIDR' || type === 'IP-CIDR6') {
      const c = rest.split(',')[0].trim();
      if (c) ip.add(c);
    } else if (type === 'DOMAIN-KEYWORD') {
      if (rest) kw.add('DOMAIN-KEYWORD,' + rest);
    } else {
      dropped[type] = (dropped[type] || 0) + 1;
    }
  }
  return { domain, ip, kw, dropped };
}

function yamlPayload(arr) {
  return 'payload:\n' + arr.map(x => "  - '" + String(x).replace(/'/g, "''") + "'").join('\n') + '\n';
}

function pm(target, policy) {
  const m = (src.policyMap || {})[target] || {};
  return m[policy] || policy;
}

/**
 * raw.githubusercontent.com → jsDelivr 镜像
 * iOS 上 Loon 直连 raw 经常超时，jsDelivr 国内可直连。
 * 注意 jsDelivr 单文件上限 20 MB，当前最大的 .rule 约 6 MB，安全。
 */
function toCdn(url) {
  const m = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!m) return url;
  return 'https://cdn.jsdelivr.net/gh/' + m[1] + '/' + m[2] + '@' + m[3] + '/' + m[4];
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

  for (const s of sets) {
    const p = pm('flclash', s.u.policy);
    if (s.k.kw.size) {
      rules.push(JSON.stringify('RULE-SET,' + s.u.name + '_KW,' + p));
      pv.push(provEntry(s.u.name + '_KW', 'classical', s.u.name + '_KW.yaml'));
    }
    if (s.k.domain.size) {
      rules.push(JSON.stringify('RULE-SET,' + s.u.name + ',' + p));
      pv.push(provEntry(s.u.name, 'domain', s.u.name + '_Domain.yaml'));
    }
  }

  for (const s of sets) {
    if (!s.k.ip.size) continue;
    const p = pm('flclash', s.u.policy);
    rules.push(JSON.stringify('RULE-SET,' + s.u.name + '_IP,' + p + ',no-resolve'));
    pv.push(provEntry(s.u.name + '_IP', 'ipcidr', s.u.name + '_IP.yaml'));
  }

  for (const t of src.tailRules || []) rules.push(JSON.stringify(t));
  rules.push('"MATCH," + PROXY_GROUP');

  const js = `// ============================================================================
// FlClash 覆写脚本 · 自动生成，请勿手改
// 源：sources.json → tools/build.js → 从 Code-Dramatist/Rule_Actions 转换
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
// Loon 配置（直接引用上游原始 .rule，不转换）
// ══════════════════════════════════════════════
function buildLoon(sets) {
  const guard = (src.guardRules || []).filter(g =>
    g.indexOf('GEOIP,LAN') !== 0 && g.indexOf('GEOIP,private') !== 0);

  const c = [];
  c.push('[General]');
  c.push('internet-test-url = http://www.gstatic.com/generate_204');
  c.push('proxy-test-url = http://www.gstatic.com/generate_204');
  c.push('test-timeout = 5');
  c.push('geoip = true');
  c.push('');
  c.push('[Proxy Group]');
  c.push('节点选择 = select,PROXY,DIRECT');
  c.push('');
  c.push('[Rule]');
  c.push('# 上游规则走 jsDelivr 镜像，避免 iOS 直连 raw.githubusercontent.com 超时');
  for (const g of guard) c.push(g);
  for (const s of sets) {
    c.push('RULE-SET,' + toCdn(s.u.url) + ',' + pm('loon', s.u.policy));
  }
  for (const t of src.tailRules || []) c.push(t);
  c.push('FINAL,节点选择');
  c.push('');

  const dir = path.join(DIST, 'loon');
  ensure(dir);
  fs.writeFileSync(path.join(dir, 'loon.conf'), c.join('\n'), 'utf8');
  return sets.length;
}

// ══════════════════════════════════════════════
(async () => {
  ensure(DIST);
  const mihomoDir = path.join(DIST, 'mihomo');
  ensure(mihomoDir);

  const sets = [];
  console.log('=== 拉取并转换上游规则 ===');
  for (const u of src.upstream) {
    const text = await loadRemote(u);
    const k = classify(text);
    const out = [];

    if (k.domain.size) {
      fs.writeFileSync(
        path.join(mihomoDir, u.name + '_Domain.yaml'),
        yamlPayload(Array.from(k.domain).sort()), 'utf8');
      out.push('domain ' + k.domain.size);
    }
    if (k.ip.size) {
      fs.writeFileSync(
        path.join(mihomoDir, u.name + '_IP.yaml'),
        yamlPayload(Array.from(k.ip).sort()), 'utf8');
      out.push('ipcidr ' + k.ip.size);
    }
    if (k.kw.size) {
      fs.writeFileSync(
        path.join(mihomoDir, u.name + '_KW.yaml'),
        yamlPayload(Array.from(k.kw).sort()), 'utf8');
      out.push('kw ' + k.kw.size);
    }

    const dk = Object.keys(k.dropped);
    const ds = dk.length ? '  跳过: ' + dk.map(x => x + '×' + k.dropped[x]).join(', ') : '';
    console.log('  ' + (u.name + ' (' + u.policy + ')').padEnd(24) + out.join('  |  ') + ds);

    sets.push({ u, k });
  }

  console.log('');
  console.log('=== 生成产物 ===');
  const f = buildFlClash(sets);
  const l = buildLoon(sets);
  console.log('  dist/flclash-override.js    provider ' + f.providers + ' / 规则 ' + f.rules);
  console.log('  dist/loon/loon.conf         引用 ' + l + ' 个上游 .rule');
  console.log('');
  console.log('完成 → dist/');
})();
