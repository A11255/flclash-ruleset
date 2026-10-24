// ============================================================================
// FlClash 覆写脚本 · 自动生成，请勿手改
// 源文件：sources.json  |  生成器：tools/build.js
// 改规则集请改 sources.json 并 push，CI 会重新生成此文件
// ============================================================================

var URL_BASE = "https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/ruleset/";
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
    Reject_Rule: {
      type: "http",
      behavior: "domain",
      format: "yaml",
      url: URL_BASE + "Reject_Rule.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Reject_Rule.yaml"
    },
    Reject_Rule_IP: {
      type: "http",
      behavior: "ipcidr",
      format: "yaml",
      url: URL_BASE + "Reject_Rule_IP.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Reject_Rule_IP.yaml"
    },
    Reject_Rule_KW: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: URL_BASE + "Reject_Rule_KW.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Reject_Rule_KW.yaml"
    },
    AdBlock_IP: {
      type: "http",
      behavior: "ipcidr",
      format: "yaml",
      url: URL_BASE + "AdBlock_IP.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "AdBlock_IP.yaml"
    },
    Adblock4limbo_KW: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: URL_BASE + "Adblock4limbo_KW.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Adblock4limbo_KW.yaml"
    },
    rejectAd_KW: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: URL_BASE + "rejectAd_KW.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "rejectAd_KW.yaml"
    },
    rejectAd_IP: {
      type: "http",
      behavior: "ipcidr",
      format: "yaml",
      url: URL_BASE + "rejectAd_IP.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "rejectAd_IP.yaml"
    },
    Apple_Push: {
      type: "http",
      behavior: "domain",
      format: "yaml",
      url: URL_BASE + "Apple_Push.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Apple_Push.yaml"
    },
    Apple_Push_IP: {
      type: "http",
      behavior: "ipcidr",
      format: "yaml",
      url: URL_BASE + "Apple_Push_IP.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Apple_Push_IP.yaml"
    },
    apple_update: {
      type: "http",
      behavior: "domain",
      format: "yaml",
      url: URL_BASE + "apple_update.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "apple_update.yaml"
    },
    Google_FCM: {
      type: "http",
      behavior: "domain",
      format: "yaml",
      url: URL_BASE + "Google_FCM.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Google_FCM.yaml"
    },
    Google_FCM_IP: {
      type: "http",
      behavior: "ipcidr",
      format: "yaml",
      url: URL_BASE + "Google_FCM_IP.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Google_FCM_IP.yaml"
    },
    Direct_Rule: {
      type: "http",
      behavior: "domain",
      format: "yaml",
      url: URL_BASE + "Direct_Rule.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Direct_Rule.yaml"
    },
    Direct_Rule_IP: {
      type: "http",
      behavior: "ipcidr",
      format: "yaml",
      url: URL_BASE + "Direct_Rule_IP.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Direct_Rule_IP.yaml"
    },
    Direct_Rule_KW: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: URL_BASE + "Direct_Rule_KW.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Direct_Rule_KW.yaml"
    },
    Proxy_Rule: {
      type: "http",
      behavior: "domain",
      format: "yaml",
      url: URL_BASE + "Proxy_Rule.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Proxy_Rule.yaml"
    },
    Proxy_Rule_IP: {
      type: "http",
      behavior: "ipcidr",
      format: "yaml",
      url: URL_BASE + "Proxy_Rule_IP.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Proxy_Rule_IP.yaml"
    },
    Proxy_Rule_KW: {
      type: "http",
      behavior: "classical",
      format: "yaml",
      url: URL_BASE + "Proxy_Rule_KW.yaml",
      interval: UPDATE_INTERVAL,
      path: "./providers/" + "Proxy_Rule_KW.yaml"
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
  "RULE-SET,Reject_Rule,REJECT",
  "RULE-SET,Reject_Rule_IP,REJECT,no-resolve",
  "RULE-SET,Reject_Rule_KW,REJECT",
  "RULE-SET,AdBlock_IP,REJECT,no-resolve",
  "RULE-SET,Adblock4limbo_KW,REJECT",
  "RULE-SET,rejectAd_KW,REJECT",
  "RULE-SET,rejectAd_IP,REJECT,no-resolve",
  "RULE-SET,Apple_Push,DIRECT",
  "RULE-SET,Apple_Push_IP,DIRECT,no-resolve",
  "RULE-SET,apple_update,DIRECT",
  "RULE-SET,Google_FCM,DIRECT",
  "RULE-SET,Google_FCM_IP,DIRECT,no-resolve",
  "RULE-SET,Direct_Rule,DIRECT",
  "RULE-SET,Direct_Rule_IP,DIRECT,no-resolve",
  "RULE-SET,Direct_Rule_KW,DIRECT",
  "RULE-SET,Proxy_Rule,节点选择",
  "RULE-SET,Proxy_Rule_IP,节点选择,no-resolve",
  "RULE-SET,Proxy_Rule_KW,节点选择",
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
