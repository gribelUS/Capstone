#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_TS="$(date +%Y%m%d_%H%M%S)"
RUN_DIR="${ROOT_DIR}/logs/sumo_batch_${RUN_TS}"
BASE_PORT="${BASE_PORT:-8813}"
RULES_PATH="${RULES_PATH:-rules.json}"

DEMANDS=(
  balanced
  morning_rush
  evening_rush
  east_west_heavy
  north_south_heavy
  light_traffic
)

mkdir -p "${RUN_DIR}"

pids=()

cleanup() {
  if ((${#pids[@]} > 0)); then
    kill "${pids[@]}" 2>/dev/null || true
  fi
}

trap cleanup INT TERM

printf 'SUMO batch run directory: %s\n' "${RUN_DIR}"
printf 'Rules file: %s\n' "${RULES_PATH}"

for i in "${!DEMANDS[@]}"; do
  demand="${DEMANDS[$i]}"
  port=$((BASE_PORT + i))
  log_file="${RUN_DIR}/${demand}.log"

  printf 'Starting %s on port %s -> %s\n' "${demand}" "${port}" "${log_file}"

  (
    cd "${ROOT_DIR}"
    exec python controller.py \
      --rules "${RULES_PATH}" \
      --simulate \
      --sim-type sumo \
      --sumo-demand "${demand}" \
      --sumo-port "${port}" \
      >"${log_file}" 2>&1
  ) &

  pids+=("$!")
done

printf 'Started %s SUMO runs. Waiting for completion...\n' "${#DEMANDS[@]}"
wait
printf 'All SUMO runs finished. Logs: %s\n' "${RUN_DIR}"
