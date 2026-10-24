// ============================================================================
// FlClash 覆写脚本 · 挂载本地 ruleset 规则集
// ----------------------------------------------------------------------------
// 用途：把 clash/ruleset/ 下的 22 个 ruleset 文件接入当前订阅，
//       并且「订阅每次更新后依然自动生效」。
//
// 用法：
//   FlClash → 配置 → 该订阅的 ⋮ / 更多 → 覆写 → 模式选「脚本」
//   → 配置脚本 → 新建 → 粘贴本文件全部内容 → 保存 → 应用
//
// 前提：22 个 yaml 必须存在于 FlClash 工作目录下的 ruleset/ 子目录
//   本机已确认路径：
//   C:\Users\Acer\AppData\Roaming\com.follow\clash\ruleset\
//   （FlClash 0.9.1 Windows 版默认数据目录，mihomo 内核 -d 就指向这里的 clash 层级）
// ============================================================================

// ======================== 用户配置区（只改这里） ========================

// "lite" = 精简模式（推荐）。去掉与 Reject_Rule 高度重叠的 4 套广告表，
//          约 46 万条，省内存。
// "full" = 全量模式。22 个全上，约 67 万条，低端机会卡/OOM。
var MODE = "lite";

// ── provider 来源 ──
// FlClash 会忽略 type:file 的 path，强行改写为自己的缓存路径
// （profiles/providers/<id>/rules/<hash>），没有 url 就是 0 条规则。
// 所以必须用 http，由 FlClash 自己下载并缓存。
var PROVIDER_SOURCE = "http";

// ★★★ 只需要改这一行 ★★★ 把 YOUR_GITHUB_USER 换成你的 GitHub 用户名
// 仓库名固定为 flclash-ruleset，规则集放在 ruleset/ 子目录
var URL_BASE = "https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/ruleset/";

// 备用源（jsDelivr 挂掉时切换用，国内直连 raw 可能超时）
// var URL_BASE = "https://raw.githubusercontent.com/A11255/flclash-ruleset/main/ruleset/";

// 拉取间隔，秒。86400 = 每天一次
var UPDATE_INTERVAL = 86400;

// 仅 file 模式使用（FlClash 下无效，保留兼容 mihomo 原生）
var RS_DIR = "ruleset";

// 走代理的策略组名。换订阅后组名变了会自动回退到第一个 select 组。
var G_PROXY = "节点选择";

var G_DIRECT = "DIRECT";
var G_REJECT = "REJECT";

// ── 内置兜底规则 ──
// 很多机场订阅只给节点、不带任何规则。这种情况下必须自己补，
// 否则：国内流量全落到 MATCH 走代理；内网设备会被 Reject_Rule_IP 里
// 的 10.x/192.168.x 段误杀。
// 只用 mihomo 内置的 GEOIP code（LAN / private / CN），不依赖 geosite 分类，
// 避免分类不存在导致整份配置加载失败。
var BUILTIN_HEAD = [
  "GEOIP,LAN,DIRECT,no-resolve",
  "GEOIP,private,DIRECT,no-resolve",
  "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
  "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
  "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
  "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
  "IP-CIDR,169.254.0.0/16,DIRECT,no-resolve",
  // 节点小宝 / Tailscale 组网段（CGNAT）。100.66.1.0/24 本来已含于
  // 100.64.0.0/10，单独列一条是为了以后改大段时不会误伤。
  "IP-CIDR,100.66.1.0/24,DIRECT,no-resolve",
  "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
  "IP-CIDR6,::1/128,DIRECT,no-resolve",
  "IP-CIDR6,fc00::/7,DIRECT,no-resolve",
  "IP-CIDR6,fe80::/10,DIRECT,no-resolve"
];

// fake-ip 模式下 GEOIP,CN 对「域名访问」无效（拿到的是 198.18.x 假 IP），
// 但对「直连真实 IP」的连接有效（游戏、P2P、IP 直连应用），所以放最后兜底。
// 域名层面的国内直连由 Direct_Rule（11 万条）负责。
var BUILTIN_TAIL = [
  "GEOIP,CN,DIRECT"
];

// fake-ip 模式下，地址栏输入内网主机名会拿到假 IP 导致连不上，
// 这里补上常见的内网域名后缀，强制走真实 DNS 解析。
var FAKE_IP_FILTER_EXTRA = [
  "+.lan",
  "+.local",
  "+.localdomain",
  "+.home.arpa",
  "+.msftconnecttest.com",
  "+.msftncsi.com",
  "localhost.ptlogin2.qq.com"
];

// ── TUN 路由排除 ──
// 这一步比规则层的 DIRECT 更关键。FlClash 的 TUN 默认只排除 10/8、172.16/12、
// 192.168/16 这些标准私网，不包含 100.64.0.0/10（CGNAT）。
// 后果：节点小宝 / Tailscale 的 100.66.x.x 流量会先被 TUN 抓走，即使规则写了
// DIRECT，也是从物理网卡往外发——而那个地址只有组网虚拟网卡能到，必然失败。
// 必须在 TUN 路由层就排除，让这些流量根本不进 TUN。
var TUN_EXCLUDE_EXTRA = [
  "100.64.0.0/10"
];

// ======================== provider 表 ========================
// behavior 必须与文件内容匹配，错了会加载失败：
//   domain    → payload 是纯域名          (AdBlock / Reject_Rule / Proxy_Rule ...)
//   ipcidr    → payload 是 CIDR           (所有 _IP 结尾)
//   classical → payload 带完整规则语法     (所有 _KW 结尾，内含 DOMAIN-KEYWORD,xxx)

function pvd(file, behavior) {
  if (PROVIDER_SOURCE === "http") {
    return {
      type: "http",
      behavior: behavior,
      format: "yaml",
      url: URL_BASE + file,
      interval: UPDATE_INTERVAL,
      path: "./providers/" + file
    };
  }
  return {
    type: "file",
    behavior: behavior,
    format: "yaml",
    path: RS_DIR + "/" + file
  };
}

function buildProviders() {
  var p = {};

  // ---- 广告 / 垃圾域名 → REJECT ----
  p["Reject_Rule"] = pvd("Reject_Rule.yaml", "domain");
  p["Reject_Rule_IP"] = pvd("Reject_Rule_IP.yaml", "ipcidr");
  p["Reject_Rule_KW"] = pvd("Reject_Rule_KW.yaml", "classical");
  p["AdBlock_IP"] = pvd("AdBlock_IP.yaml", "ipcidr");

  // ---- 国内直连 ----
  p["Direct_Rule"] = pvd("Direct_Rule.yaml", "domain");
  p["Direct_Rule_IP"] = pvd("Direct_Rule_IP.yaml", "ipcidr");
  p["Direct_Rule_KW"] = pvd("Direct_Rule_KW.yaml", "classical");

  // ---- 系统推送 / OTA（必须走直连，走代理会丢推送） ----
  p["Apple_Push"] = pvd("Apple_Push.yaml", "domain");
  p["Apple_Push_IP"] = pvd("Apple_Push_IP.yaml", "ipcidr");
  p["apple_update"] = pvd("apple_update.yaml", "domain");
  p["Google_FCM"] = pvd("Google_FCM.yaml", "domain");
  p["Google_FCM_IP"] = pvd("Google_FCM_IP.yaml", "ipcidr");

  // ---- 需要走代理 ----
  p["Proxy_Rule"] = pvd("Proxy_Rule.yaml", "domain");
  p["Proxy_Rule_IP"] = pvd("Proxy_Rule_IP.yaml", "ipcidr");
  p["Proxy_Rule_KW"] = pvd("Proxy_Rule_KW.yaml", "classical");

  if (MODE === "full") {
    p["adrules"] = pvd("adrules.yaml", "domain");
    p["AdBlock"] = pvd("AdBlock.yaml", "domain");
    p["Adblock4limbo"] = pvd("Adblock4limbo.yaml", "domain");
    p["Adblock4limbo_KW"] = pvd("Adblock4limbo_KW.yaml", "classical");
    p["rejectAd"] = pvd("rejectAd.yaml", "domain");
    p["rejectAd_IP"] = pvd("rejectAd_IP.yaml", "ipcidr");
    p["rejectAd_KW"] = pvd("rejectAd_KW.yaml", "classical");
  }

  return p;
}

// ======================== 规则顺序 ========================
// mihomo 是「首条匹配优先」，顺序错了会全盘失效。
// 原则：REJECT 广告最前 → 推送/OTA 让路 → 国内直连 → 代理 → IP 段兜底。

function buildRuleSets(proxyTarget) {
  var r = [];

  // 1. 广告拦截：KW（小表、开销低）先查，再查 30 万条大表
  r.push("RULE-SET,Reject_Rule_KW," + G_REJECT);
  r.push("RULE-SET,Reject_Rule," + G_REJECT);
  if (MODE === "full") {
    r.push("RULE-SET,rejectAd_KW," + G_REJECT);
    r.push("RULE-SET,rejectAd," + G_REJECT);
    r.push("RULE-SET,Adblock4limbo_KW," + G_REJECT);
    r.push("RULE-SET,Adblock4limbo," + G_REJECT);
    r.push("RULE-SET,AdBlock," + G_REJECT);
    r.push("RULE-SET,adrules," + G_REJECT);
  }

  // 2. 推送 / OTA 必须直连，否则 iMessage、FCM 推送延迟或丢失
  r.push("RULE-SET,Apple_Push," + G_DIRECT);
  r.push("RULE-SET,apple_update," + G_DIRECT);
  r.push("RULE-SET,Google_FCM," + G_DIRECT);

  // 3. 国内直连（放在代理之前，防止国内站点被 Proxy_Rule 抓走）
  r.push("RULE-SET,Direct_Rule," + G_DIRECT);
  r.push("RULE-SET,Direct_Rule_KW," + G_DIRECT);

  // 4. 需要走代理的域名
  r.push("RULE-SET,Proxy_Rule," + proxyTarget);
  r.push("RULE-SET,Proxy_Rule_KW," + proxyTarget);

  // 5. IP 段规则统一放最后 + no-resolve，避免每条连接都先做 DNS 解析
  r.push("RULE-SET,Reject_Rule_IP," + G_REJECT + ",no-resolve");
  r.push("RULE-SET,AdBlock_IP," + G_REJECT + ",no-resolve");
  if (MODE === "full") {
    r.push("RULE-SET,rejectAd_IP," + G_REJECT + ",no-resolve");
  }
  r.push("RULE-SET,Apple_Push_IP," + G_DIRECT + ",no-resolve");
  r.push("RULE-SET,Google_FCM_IP," + G_DIRECT + ",no-resolve");
  r.push("RULE-SET,Direct_Rule_IP," + G_DIRECT + ",no-resolve");
  r.push("RULE-SET,Proxy_Rule_IP," + proxyTarget + ",no-resolve");

  return r;
}

// ======================== 工具函数 ========================

// 必须永远排在最前、不允许被任何规则集覆盖的规则：
//   UDP 443/3478 阻断、853 阻断、回环地址、内网/私有地址
// （内网必须优先，否则 ruleset 里的 10.x/192.168.x 广告 IP 段会误杀局域网）
function isGuardRule(rule) {
  var u = rule.toUpperCase().replace(/\s+/g, "");
  return u.indexOf("AND,") === 0
    || u.indexOf("DST-PORT,") === 0
    || u.indexOf("IP-CIDR,127.") === 0
    || u.indexOf("IP-CIDR,0.0.0.0") === 0
    || u.indexOf("IP-CIDR6,::1/") === 0
    || u.indexOf("IP-CIDR6,::/128") === 0
    || u.indexOf("GEOSITE,PRIVATE") === 0
    || u.indexOf("GEOIP,LAN") === 0
    || u.indexOf("GEOIP,PRIVATE") === 0;
}

function isFinalRule(rule) {
  var u = rule.toUpperCase();
  return u.indexOf("MATCH") === 0 || u.indexOf("FINAL") === 0;
}

// 找到实际可用的代理组：优先用户指定名，否则退到第一个 select 组
function resolveProxyGroup(config) {
  var groups = config["proxy-groups"] || [];
  var i;
  for (i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].name === G_PROXY) return G_PROXY;
  }
  for (i = 0; i < groups.length; i++) {
    if (groups[i] && groups[i].type === "select") return groups[i].name;
  }
  return "PROXY";
}

// ======================== 主入口 ========================

function main(config) {
  config = config || {};

  var proxyTarget = resolveProxyGroup(config);
  var providers = buildProviders();

  // 合并已有 provider（订阅自带的不要丢）
  var existing = config["rule-providers"] || {};
  var key;
  for (key in providers) {
    if (providers.hasOwnProperty(key)) existing[key] = providers[key];
  }
  config["rule-providers"] = existing;

  // 补 fake-ip 的内网域名白名单，否则内网主机名会被解析成 198.18.x 假 IP
  if (config.dns && typeof config.dns === "object") {
    var fif = config.dns["fake-ip-filter"] || [];
    var fi;
    for (fi = 0; fi < FAKE_IP_FILTER_EXTRA.length; fi++) {
      if (fif.indexOf(FAKE_IP_FILTER_EXTRA[fi]) === -1) fif.push(FAKE_IP_FILTER_EXTRA[fi]);
    }
    config.dns["fake-ip-filter"] = fif;
  }

  // 从 TUN 路由中排除组网段（节点小宝 / Tailscale），否则流量进 TUN 后出不去
  if (config.tun && typeof config.tun === "object") {
    var rex = config.tun["route-exclude-address"];
    if (!rex || !rex.length) rex = [];
    var ti;
    for (ti = 0; ti < TUN_EXCLUDE_EXTRA.length; ti++) {
      if (rex.indexOf(TUN_EXCLUDE_EXTRA[ti]) === -1) rex.push(TUN_EXCLUDE_EXTRA[ti]);
    }
    config.tun["route-exclude-address"] = rex;
  }

  // 拆分原规则：guard / 普通 / MATCH
  var original = (config.rules || []).slice();
  var guards = [];
  var middles = [];
  var finals = [];
  var i, rule;

  for (i = 0; i < original.length; i++) {
    rule = original[i];
    if (typeof rule !== "string") continue;
    if (isFinalRule(rule)) finals.push(rule);
    else if (isGuardRule(rule)) guards.push(rule);
    else middles.push(rule);
  }

  // 去重 helper
  function dedupe(list) {
    var seen = {};
    var out = [];
    for (var k = 0; k < list.length; k++) {
      var s = String(list[k]).replace(/\s+/g, "");
      if (!seen[s]) { seen[s] = 1; out.push(list[k]); }
    }
    return out;
  }

  var mine = dedupe(buildRuleSets(proxyTarget));
  var finalRule = finals.length > 0 ? finals[0] : ("MATCH," + proxyTarget);

  // 最终拼装：guard → 我的规则集 → 订阅原有规则 → MATCH
  var merged = [];
  merged = merged.concat(dedupe(BUILTIN_HEAD.concat(guards)));
  merged = merged.concat(mine);
  merged = merged.concat(dedupe(middles));
  merged = merged.concat(BUILTIN_TAIL);
  merged.push(finalRule);

  config.rules = merged;

  console.log("FlClash 覆写完成 | 模式=" + MODE
    + " | provider=" + Object.keys(providers).length
    + " | 规则总数=" + merged.length
    + " | 代理组=" + proxyTarget);

  return config;
}
