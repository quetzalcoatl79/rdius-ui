#!/bin/bash
# RADIUS load generator for Radius UI demo / POC
# Sends realistic auth + accounting traffic to all 5 FreeRADIUS instances

set -e

# ─── Configuration ────────────────────────────────────────────────────────────
SHARED_SECRET="${RADIUS_SECRET:-loadgen-secret}"
INTERVAL="${LOADGEN_INTERVAL:-5}"          # seconds between batches
AUTH_PER_BATCH="${LOADGEN_AUTH_PER_BATCH:-3}"
ACCT_PER_BATCH="${LOADGEN_ACCT_PER_BATCH:-2}"

# FreeRADIUS instances (host:port)
SERVERS=(
  "freeradius-prod1-a:1812"
  "freeradius-prod1-b:1812"
  "freeradius-prod2-a:1812"
  "freeradius-prod2-b:1812"
  "freeradius-test:1812"
)

# Test users (must exist in radius.radcheck with Cleartext-Password)
declare -A USERS=(
  ["jean.dupont"]="password123"
  ["marie.martin"]="secure456"
  ["pierre.durand"]="motdepasse789"
  ["sophie.bernard"]="abcdef123"
  ["luc.petit"]="qwerty456"
)
USERNAMES=("${!USERS[@]}")

# NAS IPs (must match entries in radius.nas — wildcard 172.28.0.0/16 covers loadgen)
NAS_IPS=(
  "10.10.1.10" "10.10.2.10" "10.10.3.10" "10.10.6.10"
  "172.20.1.10" "172.20.2.10" "172.20.3.10" "172.20.4.10"
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

random_username() {
  echo "${USERNAMES[$RANDOM % ${#USERNAMES[@]}]}"
}

random_nas_ip() {
  echo "${NAS_IPS[$RANDOM % ${#NAS_IPS[@]}]}"
}

random_server() {
  echo "${SERVERS[$RANDOM % ${#SERVERS[@]}]}"
}

random_session_id() {
  printf "%08x%08x" $RANDOM$RANDOM $RANDOM$RANDOM
}

random_int() {
  local min=$1
  local max=$2
  echo $((RANDOM % (max - min + 1) + min))
}

# Send Access-Request to a server
send_auth() {
  local server="$1"
  local username="$2"
  local password="$3"
  local nas_ip="$4"
  local fail="$5"  # if "yes", use bad password

  local pwd="$password"
  if [ "$fail" = "yes" ]; then
    pwd="WRONG_PASSWORD_$RANDOM"
  fi

  echo "User-Name=$username,User-Password=$pwd,NAS-IP-Address=$nas_ip,NAS-Port=$RANDOM" \
    | radclient -t 2 -r 1 "$server" auth "$SHARED_SECRET" 2>&1 \
    | grep -q "Received Access-Accept" && echo "  [OK]" || echo "  [REJECT]"
}

# Convert auth server (host:1812) to accounting (host:1813)
acct_server() {
  local srv="$1"
  echo "${srv%:*}:1813"
}

# Send Accounting-Start
send_acct_start() {
  local server="$1"
  local username="$2"
  local nas_ip="$3"
  local session_id="$4"
  local acct_srv
  acct_srv="$(acct_server "$server")"

  cat <<EOF | radclient -t 2 -r 1 "$acct_srv" acct "$SHARED_SECRET" >/dev/null 2>&1 || true
User-Name = "$username"
NAS-IP-Address = $nas_ip
NAS-Port = $RANDOM
Acct-Status-Type = Start
Acct-Session-Id = "$session_id"
Framed-IP-Address = 192.168.$((RANDOM % 254 + 1)).$((RANDOM % 254 + 1))
EOF
}

# Send Accounting-Stop with stats
send_acct_stop() {
  local server="$1"
  local username="$2"
  local nas_ip="$3"
  local session_id="$4"
  local duration="$5"
  local in_octets="$6"
  local out_octets="$7"
  local acct_srv
  acct_srv="$(acct_server "$server")"

  cat <<EOF | radclient -t 2 -r 1 "$acct_srv" acct "$SHARED_SECRET" >/dev/null 2>&1 || true
User-Name = "$username"
NAS-IP-Address = $nas_ip
NAS-Port = $RANDOM
Acct-Status-Type = Stop
Acct-Session-Id = "$session_id"
Acct-Session-Time = $duration
Acct-Input-Octets = $in_octets
Acct-Output-Octets = $out_octets
Acct-Terminate-Cause = User-Request
EOF
}

# ─── Main loop ────────────────────────────────────────────────────────────────

echo "[loadgen] starting RADIUS load generator"
echo "[loadgen] interval=${INTERVAL}s | auth/batch=${AUTH_PER_BATCH} | acct/batch=${ACCT_PER_BATCH}"
echo "[loadgen] targeting ${#SERVERS[@]} FreeRADIUS instances"
echo "[loadgen] waiting 10s for FreeRADIUS to be ready..."
sleep 10

# Track active sessions for later stop
declare -a ACTIVE_SESSIONS=()

while true; do
  ts=$(date '+%H:%M:%S')

  # ── AUTH batch ──────────────────────────────────────────────
  for i in $(seq 1 $AUTH_PER_BATCH); do
    user=$(random_username)
    pwd="${USERS[$user]}"
    nas=$(random_nas_ip)
    server=$(random_server)

    # 15% chance of failure (realistic mix)
    fail="no"
    if [ $((RANDOM % 100)) -lt 15 ]; then fail="yes"; fi

    printf "[%s] AUTH  %-20s -> %-25s (NAS=%s)" "$ts" "$user" "$server" "$nas"
    send_auth "$server" "$user" "$pwd" "$nas" "$fail"

    # If success, start an accounting session
    if [ "$fail" = "no" ]; then
      session_id=$(random_session_id)
      send_acct_start "$server" "$user" "$nas" "$session_id"
      ACTIVE_SESSIONS+=("$server|$user|$nas|$session_id|$(date +%s)")
    fi
  done

  # ── ACCT STOP batch (close some old sessions) ───────────────
  for i in $(seq 1 $ACCT_PER_BATCH); do
    if [ ${#ACTIVE_SESSIONS[@]} -gt 0 ]; then
      idx=$((RANDOM % ${#ACTIVE_SESSIONS[@]}))
      session="${ACTIVE_SESSIONS[$idx]}"
      IFS='|' read -r srv usr nas sid started <<< "$session"
      now=$(date +%s)
      duration=$((now - started + RANDOM % 1800))
      in_octets=$(random_int 100000 50000000)
      out_octets=$(random_int 50000 30000000)

      printf "[%s] STOP  %-20s session=%s duration=%ss\n" "$ts" "$usr" "${sid:0:8}" "$duration"
      send_acct_stop "$srv" "$usr" "$nas" "$sid" "$duration" "$in_octets" "$out_octets"

      # Remove from active list
      ACTIVE_SESSIONS=("${ACTIVE_SESSIONS[@]:0:$idx}" "${ACTIVE_SESSIONS[@]:$((idx + 1))}")
    fi
  done

  sleep "$INTERVAL"
done
