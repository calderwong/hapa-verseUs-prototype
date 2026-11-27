#!/usr/bin/env bash
# Native second-relay carriage witness on Linux network namespaces (Review 20 / N22-03, HC-09).
#
#   sudo bash tools/hapa/relay-netns-witness.sh <out dir>
#
# Topology: the host routes between five namespaces — the blind relay (10.77.1.2), three peers
# (10.77.2.2, .3.2, .4.2) and a HyperDHT testnet (10.77.5.2). The host firewall DROPS every packet
# forwarded between peer subnets, so no direct or holepunched peer-to-peer path exists; peers reach only
# the host (DHT) and the relay. Each peer's policy lists an unreachable relay first and the live relay
# second. Success = every peer authenticates every other peer over a stream observed arriving from the
# live relay's endpoint, and the relay process reports matched pairings. Controlled fixture: it
# qualifies relay fallback/carriage wiring, not a public relay or any particular home NAT.
set -euo pipefail
OUT=${1:?out dir}; mkdir -p "$OUT"
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
NODE=$(command -v node)
cleanup() { for n in hvr hva hvb hvc hvd; do ip netns del $n 2>/dev/null || true; done; iptables -F HVWITNESS 2>/dev/null || true; iptables -D FORWARD -j HVWITNESS 2>/dev/null || true; iptables -X HVWITNESS 2>/dev/null || true; kill $(jobs -p) 2>/dev/null || true; }
trap cleanup EXIT
sysctl -qw net.ipv4.ip_forward=1
i=1
for n in hvr hva hvb hvc hvd; do
  ip netns add $n
  ip link add v$n type veth peer name p$n
  ip link set p$n netns $n
  ip addr add 10.77.$i.1/24 dev v$n; ip link set v$n up
  ip netns exec $n ip addr add 10.77.$i.2/24 dev p$n
  ip netns exec $n ip link set p$n up; ip netns exec $n ip link set lo up
  ip netns exec $n ip route add default via 10.77.$i.1
  i=$((i+1))
done
# drop everything forwarded between any two peer subnets (2,3,4); relay subnet 1 stays reachable
iptables -N HVWITNESS; iptables -I FORWARD -j HVWITNESS
for a in 2 3 4; do for b in 2 3 4; do [ $a != $b ] && iptables -A HVWITNESS -s 10.77.$a.0/24 -d 10.77.$b.0/24 -j DROP; done; done
iptables -P FORWARD ACCEPT
# control: a peer cannot reach another peer, but can reach the relay namespace
if ip netns exec hva ping -c1 -W1 10.77.3.2 >/dev/null 2>&1; then echo '{"ok":false,"error":"peer-to-peer path is open"}' > "$OUT/control.json"; exit 1; fi
ip netns exec hva ping -c1 -W2 10.77.1.2 >/dev/null
echo '{"peerToPeerBlocked":true,"peerToRelay":true}' > "$OUT/control.json"
# DHT testnet in its own namespace (10.77.5.2): a single address, so its replies come from the address
# peers asked (dht-rpc discards replies from another source address)
(cd "$ROOT" && ip netns exec hvd "$NODE" -e "require('hyperdht/testnet')(3, { host: '10.77.5.2' }).then((t) => { console.log(JSON.stringify(t.bootstrap)); setInterval(() => {}, 1e6); })" > "$OUT/testnet.json" 2>"$OUT/testnet.err") &
for _ in $(seq 1 50); do [ -s "$OUT/testnet.json" ] && break; sleep 0.2; done
BOOT=$(python3 -c "import json;b=json.load(open('$OUT/testnet.json'))[0];print(f\"{b['host']}:{b['port']}\")")
# diagnostics: can a plain DHT node inside a peer namespace bootstrap from the host testnet?
iptables -S > "$OUT/iptables.txt" 2>&1 || true
(cd "$ROOT" && ip netns exec hva "$NODE" -e "const DHT = require('hyperdht'); const d = new DHT({ bootstrap: ['$BOOT'] }); const t = setTimeout(() => { console.log(JSON.stringify({ timeout: true, nodes: d.toArray().length, host: d.host })); process.exit(0); }, 20000); d.fullyBootstrapped().then(() => { clearTimeout(t); console.log(JSON.stringify({ host: d.host, port: d.port, nodes: d.toArray().length, firewalled: d.firewalled })); process.exit(0); })" > "$OUT/diag-dht-in-ns.json" 2>&1) || true
# the live relay in its namespace, on a fixed port so its endpoint can be published
ip netns exec hvr "$NODE" "$ROOT/tools/hapa/relay-serve.mjs" --testnet "$BOOT" --port 49740 --stats "$OUT/relay-stats.json" > "$OUT/relay.json" 2>"$OUT/relay.err" &
for _ in $(seq 1 100); do [ -s "$OUT/relay.json" ] && break; sleep 0.2; done
KEY=$(python3 -c "import json;print(json.load(open('$OUT/relay.json'))['relay']['publicKey'])")
# three peers, concurrently: first with only the live relay, then with an unreachable relay first
for mode in single fallback; do
  for p in a b c; do
    ip netns exec hv$p "$NODE" "$ROOT/tools/hapa/relay-witness-peer.mjs" "Peer-$p" "$BOOT" "$KEY" "10.77.1.2:49740" "$OUT/peer-$p-$mode.json" 2 $mode > /dev/null 2>"$OUT/peer-$p-$mode.err" &
  done
  wait $(jobs -p | tail -3) || true
  cp "$OUT/relay-stats.json" "$OUT/relay-stats-after-$mode.json" 2>/dev/null || true
done
python3 - "$OUT" <<'EOF'
import json, sys, os
out = sys.argv[1]
def load(f): return json.load(open(f)) if os.path.exists(f) else None
res = {}
for mode in ('single', 'fallback'):
    peers = [load(f'{out}/peer-{p}-{mode}.json') for p in 'abc']
    peers = [p for p in peers if p]
    res[mode] = {'ok': len(peers) == 3 and all(p['ok'] for p in peers), 'relayStatsAfter': load(f'{out}/relay-stats-after-{mode}.json'),
                 'peers': [{'name': p['name'], 'ok': p['ok'], 'seconds': p['seconds'], 'roster': p['roster'], 'relays': p['relays']} for p in peers]}
ok = res['single']['ok'] and res['fallback']['ok']
summary = {'ok': ok, 'control': json.load(open(f'{out}/control.json')), **res}
json.dump(summary, open(f'{out}/summary.json', 'w'), indent=1)
print(json.dumps(summary, indent=1))
sys.exit(0 if ok else 1)
EOF
