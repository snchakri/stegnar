#!/usr/bin/env bash
# ebpf_redirect.sh — Setup iptables for mitmproxy transparent mode.
# 
# In a full eBPF implementation, XDP is used to redirect packets at the NIC driver level.
# However, within docker-compose/veth pairs, iptables REDIRECT is the most reliable way 
# to route traffic into the mitmproxy transparent listener.
#
# This script configures the iptables PREROUTING rules required for transparent MITM.

set -e

PROXY_PORT=8080

echo "[*] Setting up iptables for transparent proxying on port $PROXY_PORT"

# Enable IP forwarding
sysctl -w net.ipv4.ip_forward=1

# Flush existing nat rules
iptables -t nat -F

# Redirect HTTP and HTTPS traffic to the proxy port
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port $PROXY_PORT
iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port $PROXY_PORT

echo "[*] iptables configured successfully. Traffic on 80/443 is now routed to mitmproxy."
