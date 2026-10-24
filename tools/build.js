#!/usr/bin/env node
/**
 * 规则集地址中心 · 生成器
 *
 * 输入：sources.json（唯一手工维护的文件）
 * 输出：
 *   dist/flclash-override.js   FlClash / mihomo 覆写脚本
 *   dist/loon/<name>.list      Loon 规则集文件
 *   dist/loon/loon.conf        Loon 配置模板
 *
 * 用法：node tools/build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const CDN = 'https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main';

const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.json'), 'utf8'));
const policyMap = src.policyMap || { flclash: {}, loon: {} };

// ── 读 mihomo yaml 的 payload（轻量解析，不引第三方库）──
function readPayload(file) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) throw new Error('文件不存在: ' + file);
  const txt = fs.readFileSync(abs, 'utf8');
  const items = [];
  const re = /^\s*-\s*'([^']*)'\s*$/gm;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const v = m[1].trim();
    if (v) items.push(v);
  }
  return items;
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function pick(target) {
  return src.rulesets.filter(r => (r.targets || []).indexOf(target) !== -1);
}

// ══════════════════════════════════════════════════════
// 1. FlClash 覆写脚本
// ══════════════════════════════════════════════════════
function buildFlClash() {
  const list = pick('flclash');
  const pv = [];
  for (const r of list) {
    const p = policyMap.flclash[r.policy] || r.policy;
    pv.push(
      '    ' + r.name + ': {\n' +
      '      type: "http",\n' +
      '      behavior: ' + JSON.stringify(r.behavior) + ',\n' +
      '      format: "yaml",\n' +
      '      url: URL_BASE + ' + JSON.stringify(path.basename(r.file)) + ',\n' +
      '      interval: UPDATE_INTERVAL,\n' +
      '      path: "./providers/" + ' + JSON.stringify(path.basename(r.file)) + '\n' +
      '    }'
    );
  }

  const ruleLines = [];
  for (const g of src.guardRules || []) ruleLines.push('  ' + JSON.stringify(g) + ',');
  for (const r of list) {
    const p = policyMap.flclash[r.policy] || r.policy;
    let line = 'RULE-SET,' + r.name + ',' + p;
    if (r.behavior === 'ipcidr') line += ',no-resolve';
    ruleLines.push('  ' + JSON.stringify(line) + ',');
  }
  for (const t of src.tailRules || []) ruleLines.push('  ' + JSON.stringify(t) + ',');
  ruleLines.push('  "MATCH," + PROXY_GROUP');

  const js = `// ============================================================================
// FlClash 覆写脚本 · 自动生成，请勿手改
// 源文件：sources.json  |  生成器：tools/build.js
// 改规则集请改 sources.json 并 push，CI 会重新生成此文件
// ============================================================================

var URL_BASE = ${JSON.stringify(CDN + '/ruleset/')};
var UPDATE_INTERVAL = 86400;
var PROXY_GROUP = "节点选择";

var FAKE_IP_FILTER_EXTRA = ${JSON.stringify(src.fakeIpFilterExtra || [], null, 2)};
var TUN_EXCLUDE_EXTRA = ${JSON.stringify(src.tunExcludeExtra || [], null, 2)};

var PROVIDERS = {
${pv.join(',\n')}
};

var RULES = [
${ruleLines.join('\n')}
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
  return { count: list.length, rules: ruleLines.length };
}

// ══════════════════════════════════════════════════════
// 2. Loon 规则集 + 配置
// ══════════════════════════════════════════════════════
function toLoonLines(items, behavior) {
  const out = [];
  for (const v of items) {
    if (behavior === 'domain') {
      const d = v.replace(/^\./, '');
      if (!d || d.indexOf(' ') !== -1) continue;
      out.push('DOMAIN-SUFFIX,' + d);
    } else if (behavior === 'ipcidr') {
      out.push('IP-CIDR,' + v + ',no-resolve');
    } else {
      out.push(v);
    }
  }
  return out;
}

function buildLoon() {
  const list = pick('loon');
  const dir = path.join(DIST, 'loon');
  ensureDir(dir);

  const stats = [];
  for (const r of list) {
    const items = readPayload(r.file);
    const lines = toLoonLines(items, r.behavior);
    const name = r.name + '.list';
    fs.writeFileSync(path.join(dir, name), lines.join('\n') + '\n', 'utf8');
    stats.push({ name, count: lines.length });
  }

  // 配置模板
  const guard = (src.guardRules || [])
    .filter(g => g.indexOf('GEOIP,LAN') !== 0 && g.indexOf('GEOIP,private') !== 0);

  const conf = [];
  conf.push('[General]');
  conf.push('internet-test-url = http://www.gstatic.com/generate_204');
  conf.push('proxy-test-url = http://www.gstatic.com/generate_204');
  conf.push('test-timeout = 5');
  conf.push('geoip = true');
  conf.push('');
  conf.push('[Proxy Group]');
  conf.push('节点选择 = select,PROXY,DIRECT');
  conf.push('');
  conf.push('[Rule]');
  for (const g of guard) conf.push(g);
  for (const r of list) {
    const p = policyMap.loon[r.policy] || r.policy;
    conf.push('RULE-SET,' + CDN + '/dist/loon/' + r.name + '.list,' + p);
  }
  conf.push('GEOIP,CN,DIRECT');
  conf.push('FINAL,节点选择');
  conf.push('');

  fs.writeFileSync(path.join(dir, 'loon.conf'), conf.join('\n'), 'utf8');
  return stats;
}

// ══════════════════════════════════════════════════════
ensureDir(DIST);
const f = buildFlClash();
const l = buildLoon();

console.log('=== FlClash ===');
console.log('  provider: ' + f.count + '  规则: ' + f.rules);
console.log('=== Loon ===');
let total = 0;
for (const s of l) total += s.count;
for (const s of l) console.log('  ' + s.name.padEnd(26) + s.count + ' 条');
console.log('  合计 ' + total + ' 条');
console.log('\n生成完毕 → dist/');
