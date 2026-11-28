#!/usr/bin/env bash
# Relay carriage control behind real NATs (Review 21 V21-04 / Assignment 23 N23-03, HC-09).
#
#   sudo bash tools/hapa/relay-nat-witness.sh <out dir> [stage]
#     stage 1 (default): two peers, one live relay — the control
#     stage 2: three peers, an unreachable preferred relay then the live one (fallback + concurrency)
#
# Changed topology (not the previous packet-drop fixture): each peer sits in a private subnet behind its
# own NAT router namespace that masquerades with randomized ports and admits no unsolicited inbound
# traffic. Both peers are therefore genuinely firewalled and randomized, a combination for which
# HyperDHT itself refuses holepunching and Hyperswarm falls back to a configured relay — no forced
# relaying. The relay (started with --public, so its own DHT node is OPEN) and a DHT testnet sit on
# routable segments. Success = the stage's exact peer set (stage 1: Peer-a, Peer-b; stage 2: Peer-a..c)
# each authenticates every other expected peer over a stream arriving from the live relay's endpoint, and
# the relay reports matched pairings. Passing evidence: run 46101799012 (Response 23).
set -euo pipefail
OUT=${1:?out dir}; STAGE=${2:-1}; mkdir -p "$OUT"
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
NODE=$(command -v node)
NS="hvr hvd"; PEERS="a b"; [ "$STAGE" = 2 ] && PEERS="a b c"
cleanup() {
  kill $(jobs -p) 2>/dev/null || true; sleep 1   # stop processes inside the namespaces first
  for n in hvr hvd hvna hvnb hvnc hvpa hvpb hvpc; do ip netns pids $n 2>/dev/null | xargs -r kill -9 2>/dev/null || true; ip netns del $n 2>/dev/null || true; ip link del v$n 2>/dev/null || true; done
}
cleanup; trap cleanup EXIT   # also clears leftovers from an earlier stage
sysctl -qw net.ipv4.ip_forward=1
iptables -P FORWARD ACCEPT
link() { # host <-> namespace public link: link <ns> <index>
  ip link add v$1 type veth peer name p$1; ip link set p$1 netns $1
  ip addr add 10.77.$2.1/24 dev v$1; ip link set v$1 up
  ip netns exec $1 ip addr add 10.77.$2.2/24 dev p$1; ip netns exec $1 ip link set p$1 up; ip netns exec $1 ip link set lo up
  ip netns exec $1 ip route add default via 10.77.$2.1
}
ip netns add hvr; link hvr 1          # relay        10.77.1.2
ip netns add hvd; link hvd 5          # DHT testnet  10.77.5.2
i=2
for p in $PEERS; do                    # NAT router hvn$p (public 10.77.$i.2) + peer hvp$p (192.168.$i.2)
  ip netns add hvn$p; link hvn$p $i
  ip netns add hvp$p
  ip link add i$p type veth peer name o$p
  ip link set i$p netns hvn$p; ip link set o$p netns hvp$p
  ip netns exec hvn$p ip addr add 192.168.$i.1/24 dev i$p; ip netns exec hvn$p ip link set i$p up
  ip netns exec hvp$p ip addr add 192.168.$i.2/24 dev o$p; ip netns exec hvp$p ip link set o$p up; ip netns exec hvp$p ip link set lo up
  ip netns exec hvp$p ip route add default via 192.168.$i.1
  ip netns exec hvn$p sysctl -qw net.ipv4.ip_forward=1
  ip netns exec hvn$p iptables -t nat -A POSTROUTING -s 192.168.$i.0/24 -o phvn$p -j MASQUERADE --random-fully
  ip netns exec hvn$p iptables -A FORWARD -i phvn$p -o i$p -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  ip netns exec hvn$p iptables -A FORWARD -i phvn$p -o i$p -j DROP
  i=$((i+1))
done
# controls: a peer reaches the relay and the DHT (outbound through its NAT); nothing reaches a peer unsolicited
ip netns exec hvpa ping -c1 -W2 10.77.1.2 >/dev/null && ip netns exec hvpa ping -c1 -W2 10.77.5.2 >/dev/null
if ip netns exec hvpb ping -c1 -W1 192.168.2.2 >/dev/null 2>&1; then echo '{"ok":false,"error":"a private peer address is reachable"}' > "$OUT/control.json"; exit 1; fi
echo '{"peersBehindRandomizedNat":true,"unsolicitedInboundDropped":true,"peerToRelay":true}' > "$OUT/control.json"
(cd "$ROOT" && ip netns exec hvd "$NODE" -e "require('hyperdht/testnet')(3, { host: '10.77.5.2' }).then((t) => { console.log(JSON.stringify(t.bootstrap)); setInterval(() => {}, 1e6); })" > "$OUT/testnet.json" 2>"$OUT/testnet.err") &
for _ in $(seq 1 50); do [ -s "$OUT/testnet.json" ] && break; sleep 0.2; done
BOOT=$(python3 -c "import json;b=json.load(open('$OUT/testnet.json'))[0];print(f\"{b['host']}:{b['port']}\")")
ip netns exec hvr "$NODE" "$ROOT/tools/hapa/relay-serve.mjs" --testnet "$BOOT" --port 49740 --public --stats "$OUT/relay-stats.json" > "$OUT/relay.json" 2>"$OUT/relay.err" &
for _ in $(seq 1 100); do [ -s "$OUT/relay.json" ] && break; sleep 0.2; done
KEY=$(python3 -c "import json;print(json.load(open('$OUT/relay.json'))['relay']['publicKey'])")
MODE=single; [ "$STAGE" = 2 ] && MODE=fallback
N=$(echo $PEERS | wc -w); EXPECT=$((N-1))
for p in $PEERS; do
  ip netns exec hvp$p env WITNESS_FORCE=0 "$NODE" "$ROOT/tools/hapa/relay-witness-peer.mjs" "Peer-$p" "$BOOT" "$KEY" "10.77.1.2:49740" "$OUT/peer-$p.json" $EXPECT $MODE > /dev/null 2>"$OUT/peer-$p.err" &
done
wait $(jobs -p | tail -$N) || true
# exact expected report set per stage (Review 22 V22-03 / N24-03): missing, duplicated, misidentified or
# failing reports fail the stage — see tools/hapa/relay-witness-aggregate.mjs
"$NODE" "$ROOT/tools/hapa/relay-witness-aggregate.mjs" "$OUT" "$STAGE"
