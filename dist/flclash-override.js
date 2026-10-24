// ============================================================================
// FlClash 覆写脚本 · 自动生成，请勿手改
// 源：sources.json → tools/build.js → 从 Code-Dramatist/Rule_Actions 转换
// 改规则请改 sources.json 并 push，CI 会重新生成
// ============================================================================

var URL_BASE = "https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/mihomo/";
var UPDATE_INTERVAL = 86400;
var PROXY_GROUP = "节点选择";

var FAKE_IP_FILTER_EXTRA = [
  "+.lan",
  "+.local",
  "+.localdomain",
  "+.home.arpa",
  "+.msftconnecttest.com",
  "+.msftncsi.com",
  "localhost.ptlogin2.qq.com"
];
var TUN_EXCLUDE_EXTRA = [
  "100.64.0.0/10"
];

var PROVIDERS = {
  Reject_Rule_KW: {
    type: "http",
    behavior: "classical",
    format: "yaml",
    url: URL_BASE + "Reject_Rule_KW.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Reject_Rule_KW.yaml"
  },
  Reject_Rule: {
    type: "http",
    behavior: "domain",
    format: "yaml",
    url: URL_BASE + "Reject_Rule_Domain.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Reject_Rule_Domain.yaml"
  },
  Direct_Rule_KW: {
    type: "http",
    behavior: "classical",
    format: "yaml",
    url: URL_BASE + "Direct_Rule_KW.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Direct_Rule_KW.yaml"
  },
  Direct_Rule: {
    type: "http",
    behavior: "domain",
    format: "yaml",
    url: URL_BASE + "Direct_Rule_Domain.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Direct_Rule_Domain.yaml"
  },
  Proxy_Rule_KW: {
    type: "http",
    behavior: "classical",
    format: "yaml",
    url: URL_BASE + "Proxy_Rule_KW.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Proxy_Rule_KW.yaml"
  },
  Proxy_Rule: {
    type: "http",
    behavior: "domain",
    format: "yaml",
    url: URL_BASE + "Proxy_Rule_Domain.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Proxy_Rule_Domain.yaml"
  },
  Reject_Rule_IP: {
    type: "http",
    behavior: "ipcidr",
    format: "yaml",
    url: URL_BASE + "Reject_Rule_IP.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Reject_Rule_IP.yaml"
  },
  Direct_Rule_IP: {
    type: "http",
    behavior: "ipcidr",
    format: "yaml",
    url: URL_BASE + "Direct_Rule_IP.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Direct_Rule_IP.yaml"
  },
  Proxy_Rule_IP: {
    type: "http",
    behavior: "ipcidr",
    format: "yaml",
    url: URL_BASE + "Proxy_Rule_IP.yaml",
    interval: UPDATE_INTERVAL,
    path: "./providers/" + "Proxy_Rule_IP.yaml"
  }
};

var RULES = [
"GEOIP,LAN,DIRECT,no-resolve",
"GEOIP,private,DIRECT,no-resolve",
"IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
"IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
"IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
"IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
"IP-CIDR,169.254.0.0/16,DIRECT,no-resolve",
"IP-CIDR,100.66.1.0/24,DIRECT,no-resolve",
"IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
"IP-CIDR6,::1/128,DIRECT,no-resolve",
"IP-CIDR6,fc00::/7,DIRECT,no-resolve",
"IP-CIDR6,fe80::/10,DIRECT,no-resolve",
"RULE-SET,Reject_Rule_KW,REJECT",
"RULE-SET,Reject_Rule,REJECT",
"RULE-SET,Direct_Rule_KW,DIRECT",
"RULE-SET,Direct_Rule,DIRECT",
"RULE-SET,Proxy_Rule_KW,节点选择",
"RULE-SET,Proxy_Rule,节点选择",
"RULE-SET,Reject_Rule_IP,REJECT,no-resolve",
"RULE-SET,Direct_Rule_IP,DIRECT,no-resolve",
"RULE-SET,Proxy_Rule_IP,节点选择,no-resolve",
"GEOIP,CN,DIRECT",
"MATCH," + PROXY_GROUP
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
