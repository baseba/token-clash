#!/usr/bin/env bash
# Continuous deploy, pull-based: run by token-clash-deploy.timer on the server. When origin/main has a
# new commit whose CI passed, it fast-forwards the checkout, rebuilds the image and restarts the
# service, rolling back to the previous image if the new one doesn't come up healthy.
#
# Nothing reaches into the server: it only fetches from GitHub. Changes to how the server runs things
# (quadlet units, this script, its timer) are never applied automatically; it stops and logs instead.
#
# Installed as ~/.local/bin/token-clash-deploy (copied, not linked, so a merged PR can't change it).
# Logs: journalctl --user -u token-clash-deploy
set -euo pipefail

REPO_DIR=${REPO_DIR:-$HOME/code/token-clash}
GITHUB_REPO=${GITHUB_REPO:-baseba/token-clash}
BRANCH=${BRANCH:-main}
REQUIRED_CHECKS=${REQUIRED_CHECKS:-"test container"}
STATE_DIR=${STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/token-clash-deploy}
# Paths that change the host side (systemd/quadlet units, this script): deployed by hand only.
MANUAL_PATHS=(deploy/deploy.sh 'deploy/*.container' 'deploy/*.network' 'deploy/*.service' 'deploy/*.timer')

log() { echo "$*"; }
mkdir -p "$STATE_DIR"
cd "$REPO_DIR"

if [[ $(git branch --show-current) != "$BRANCH" ]]; then
  echo "$REPO_DIR no está en la rama $BRANCH. No despliego."
  exit 1
fi
git fetch --quiet origin "$BRANCH"
cur=$(git rev-parse HEAD)
new=$(git rev-parse "origin/$BRANCH")
[[ $cur == "$new" ]] && exit 0
if [[ $(cat "$STATE_DIR/failed" 2>/dev/null) == "$new" ]]; then
  exit 0 # already failed once; waits for the next commit
fi
short=${new:0:7}

if ! git merge-base --is-ancestor "$cur" "$new"; then
  log "$short: HEAD ${cur:0:7} no es ancestro de origin/$BRANCH (¿commits locales?). Arréglalo a mano."
  exit 1
fi
if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
  log "$short: hay cambios sin commitear en $REPO_DIR. No despliego."
  exit 1
fi

# CI must have passed on exactly this commit.
for check in $REQUIRED_CHECKS; do
  runs=${runs:-$(curl -fsS -H 'Accept: application/vnd.github+json' \
    "https://api.github.com/repos/$GITHUB_REPO/commits/$new/check-runs?per_page=100")}
  conclusion=$(jq -r --arg n "$check" '[.check_runs[] | select(.name == $n)] | first | .conclusion // "pending"' <<<"$runs")
  case $conclusion in
    success) ;;
    pending | null) log "$short: CI '$check' todavía no termina; reintento en la próxima vuelta."; exit 0 ;;
    *) log "$short: CI '$check' terminó en '$conclusion'. No despliego."; echo "$new" >"$STATE_DIR/failed"; exit 1 ;;
  esac
done

manual=$(git diff --name-only "$cur" "$new" -- "${MANUAL_PATHS[@]}")
if [[ -n $manual ]]; then
  log "$short: cambian archivos del host, despliega a mano (ver README, Deploy):"
  log "$manual"
  echo "$new" >"$STATE_DIR/failed"
  exit 1
fi

# Restarting cuts live battles: wait until nobody is fighting. An old image without the endpoint, or a
# container that's down, answers nothing and doesn't block the deploy.
battles=$(podman exec token-clash wget -qO- http://127.0.0.1:8080/healthz/battles 2>/dev/null || true)
if [[ $battles =~ ^[0-9]+$ && $battles -gt 0 ]]; then
  log "$short: hay $battles pelea(s) en curso; reintento en la próxima vuelta."
  exit 0
fi

log "$short: desplegando ${cur:0:7} → $short"
git merge --ff-only --quiet "$new"

rollback_git() { git reset --quiet --keep "$cur"; echo "$new" >"$STATE_DIR/failed"; }

if ! podman build --quiet --format docker -t token-clash:next -f deploy/Containerfile . >/dev/null; then
  log "$short: falló el build; sigue corriendo ${cur:0:7}."
  rollback_git
  exit 1
fi
old_previous=$(podman image inspect --format '{{.Id}}' token-clash:previous 2>/dev/null || true)
podman tag token-clash:latest token-clash:previous
podman tag token-clash:next token-clash:latest
podman rmi --ignore token-clash:next >/dev/null

# The unit has Notify=healthy: restart only succeeds once the healthcheck passes.
if ! systemctl --user restart token-clash; then
  log "$short: no levantó sano; vuelvo a la imagen anterior (${cur:0:7})."
  podman tag token-clash:previous token-clash:latest
  systemctl --user restart token-clash || log "¡La imagen anterior tampoco levantó! Revisa: systemctl --user status token-clash"
  rollback_git
  exit 1
fi

# The Jev proxy runs from the same image: move it to the new one too. It's optional (Skynet falls back
# to the very hard AI without it), so a failure here is logged, not rolled back.
systemctl --user try-restart token-clash-jev || log "$short: el proxy de Jev no levantó; Skynet juega como Muy difícil. Revisa: systemctl --user status token-clash-jev"

rm -f "$STATE_DIR/failed"
# The image that was "previous" before this deploy is now untagged: drop it (fails harmlessly if in use).
[[ -n $old_previous ]] && podman rmi "$old_previous" >/dev/null 2>&1 || true
log "$short: desplegado."
