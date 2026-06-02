#!/bin/bash
set -euo pipefail

mkdir -p /var/log/stegnar
touch /var/log/stegnar/proxy.log

{
	echo "[stegnar-proxy] Configuring iptables for transparent proxying..."
	iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
	iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8080

	echo "[stegnar-proxy] Starting mitmdump in transparent mode..."
	exec mitmdump --mode transparent --showhost -s addon.py --set confdir=/app/.mitmproxy
} 2>&1 | tee -a /var/log/stegnar/proxy.log
