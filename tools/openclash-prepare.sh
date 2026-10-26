#!/bin/sh
# =============================================================================
# OpenClash 规则缓存预热 / 启动排障脚本
#
# 背景：module.conf 里的 rule-provider 是 type: http。内核启动时如果本地没有
#       缓存文件，会同步去 CDN 拉取；路由器 DNS 一旦抽风，拉取就卡住，
#       表现就是 OpenClash「卡在第五步：添加计划任务,启动进程守护程序」。
#       本脚本把 15 个规则文件提前落到内核的缓存目录，启动时直接读本地文件。
#
# 用法（在路由器 SSH 里）：
#   sh openclash-prepare.sh            # 只预热缓存
#   sh openclash-prepare.sh restart    # 预热 + 干净重启 OpenClash
#   sh openclash-prepare.sh diag       # 只打印诊断信息
# =============================================================================

set -u

BASE_MAIN="https://cdn.jsdelivr.net/gh/A11255/flclash-ruleset@main/dist/mihomo"
BASE_MIRROR1="https://gh-proxy.com/https://raw.githubusercontent.com/A11255/flclash-ruleset/main/dist/mihomo"
BASE_MIRROR2="https://raw.githubusercontent.com/A11255/flclash-ruleset/main/dist/mihomo"

DEST="/etc/openclash/rule_provider"
LOGF="/tmp/openclash.log"

# 文件名 + 最小合法字节数（明显偏小即视为下载失败）
FILES="
Reject_Rule_KW.yaml 2000
Reject_Rule_Domain.mrs 1000000
Reject_Rule_IP.mrs 500
AdBlock_Domain.mrs 3000
AdBlock_IP.mrs 60
adrules_Domain.mrs 50000
rejectAd_KW.yaml 200
rejectAd_Domain.mrs 2000
rejectAd_IP.mrs 60
Adblock4limbo_Domain.mrs 200
apple_update_Domain.mrs 60
Google_FCM_Domain.mrs 60
Google_FCM_IP.mrs 60
Apple_Push_Domain.mrs 60
Apple_Push_IP.mrs 60
"

say()  { echo "[prepare] $*"; }
fail() { echo "[prepare][FAIL] $*"; }

fetch() {
    # $1=url  $2=dest
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --connect-timeout 10 --max-time 90 -o "$2" "$1"
    else
        wget -q -T 90 -O "$2" "$1"
    fi
}

size_of() { [ -f "$1" ] && wc -c < "$1" | tr -d ' ' || echo 0; }

do_diag() {
    say "===== 诊断 ====="
    say "内核进程: $(pidof clash 2>/dev/null || echo 未运行)"
    say "OpenClash 状态: $(/etc/init.d/openclash status 2>/dev/null | head -3 | tr '\n' ' ')"
    say "缓存目录 $DEST:"
    [ -d "$DEST" ] && ls -l "$DEST" 2>/dev/null | head -25 || say "  (不存在)"
    say "磁盘:"
    df -h /overlay /tmp 2>/dev/null | sed 's/^/[prepare]   /'
    if [ -f "$LOGF" ]; then
        say "内核日志最后 25 行:"
        tail -n 25 "$LOGF" 2>/dev/null | sed 's/^/[prepare]   /'
    fi
}

do_preheat() {
    mkdir -p "$DEST" || { fail "无法创建 $DEST"; exit 1; }

    ok=0; bad=0
    echo "$FILES" | while read -r name min; do
        [ -n "$name" ] || continue
        dst="$DEST/$name"
        cur=$(size_of "$dst")
        if [ "$cur" -ge "$min" ]; then
            say "已有 $name ($cur B)，跳过"
            ok=$((ok + 1))
            continue
        fi

        got=0
        for base in "$BASE_MAIN" "$BASE_MIRROR1" "$BASE_MIRROR2"; do
            say "拉取 $name <- ${base%%/*}..."
            rm -f "$dst"
            if fetch "$base/$name" "$dst"; then
                n=$(size_of "$dst")
                if [ "$n" -ge "$min" ]; then
                    say "  OK $n B"
                    got=1
                    break
                fi
                say "  内容偏小 ($n B)，换源"
            else
                say "  失败，换源"
            fi
        done
        if [ "$got" -eq 0 ]; then
            rm -f "$dst"
            fail "$name 三个源都没拉下来"
            bad=$((bad + 1))
        fi
    done

    say "缓存目录现有文件："
    ls -l "$DEST" 2>/dev/null | sed 's/^/[prepare]   /'
    say "预热完成。现在启动 OpenClash 不会再因联网拉规则而卡住。"
}

do_restart() {
    say "干净重启：stop -> 强杀残留内核 -> start"
    /etc/init.d/openclash stop  >/dev/null 2>&1
    sleep 3
    pids=$(pidof clash 2>/dev/null || true)
    [ -n "$pids" ] && { say "强杀残留内核 $pids"; kill -9 $pids 2>/dev/null; sleep 2; }
    /etc/init.d/openclash start >/dev/null 2>&1
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
        if pidof clash >/dev/null 2>&1; then
            say "内核已启动：$(pidof clash)"
            break
        fi
        sleep 2
    done
    pidof clash >/dev/null 2>&1 || fail "20 秒内内核仍未起来，跑一下 diag 看内核日志"
    do_diag
}

case "${1:-preheat}" in
    diag)    do_diag ;;
    restart) do_preheat; do_restart ;;
    preheat) do_preheat ;;
    *)       echo "用法: sh $0 [preheat|restart|diag]" ;;
esac
