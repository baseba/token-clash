#!/bin/bash
set -euo pipefail

ORIGIN="${1:?Uso: curl -fsSL <Token Clash>/poketokenbar/install.sh | bash -s <Token Clash>}"
ORIGIN="${ORIGIN%/}"
REPO="https://github.com/chattymin/PokeTokenBar.git"
TAG="v2.5.7"
COMMIT="c35225dcd6fc8fa2ed66040162b827b1886819bd"

say() { printf '\n==> %s\n' "$1"; }
fail() { printf '\n✗ %s\n' "$1" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || fail "PokeTokenBar es una app de macOS: corre esto en tu Mac."
xcrun --find swift >/dev/null 2>&1 || fail "Faltan las herramientas de compilación de Apple. Corre: xcode-select --install, y vuelve a intentarlo."
command -v git >/dev/null || fail "Falta git. Corre: xcode-select --install, y vuelve a intentarlo."
if command -v brew >/dev/null && brew list --cask poke-token-bar >/dev/null 2>&1; then
  fail "Tienes PokeTokenBar instalado con Homebrew, y brew upgrade lo volvería a la versión oficial. Corre: brew uninstall --cask poke-token-bar (tu Pokédex no se borra), y vuelve a intentarlo."
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

UPDATE="Actualiza las herramientas de Apple en Ajustes del Sistema → General → Actualización de software (Command Line Tools for Xcode), o con softwareupdate --list y sudo softwareupdate -i \"<el nombre que aparezca>\". Si después sigue fallando, reinstálalas: sudo rm -rf /Library/Developer/CommandLineTools y luego xcode-select --install."
MACOS_MAJOR="$(sw_vers -productVersion | cut -d. -f1)"
[[ "$MACOS_MAJOR" -ge 14 ]] || fail "PokeTokenBar necesita macOS 14 Sonoma o más nuevo; tienes $(sw_vers -productVersion)."
SWIFT_MAJOR="$(xcrun swift --version 2>/dev/null | sed -n 's/.*Swift version \([0-9]*\).*/\1/p' | head -1)"
[[ "${SWIFT_MAJOR:-0}" -ge 6 ]] || fail "PokeTokenBar necesita Swift 6 o más (Command Line Tools for Xcode 16), y tienes Swift ${SWIFT_MAJOR:-?}. $UPDATE"
probe_failed() {
  grep -m 3 'error:' "$WORK/probe.log" >&2 || true
  fail "Tus herramientas de compilación de Apple quedaron a medio actualizar: el compilador de Swift y el SDK de macOS no calzan, y así no compila ninguna app. $UPDATE"
}
mkdir -p "$WORK/probe/Sources/Probe"
printf '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Probe", platforms: [.macOS(.v14)], targets: [.executableTarget(name: "Probe")])\n' > "$WORK/probe/Package.swift"
printf 'import Foundation\nimport Observation\n@Observable final class Probe { var date = Date() }\nprint(Probe().date)\n' > "$WORK/probe/Sources/Probe/main.swift"
say "Revisando las herramientas de Apple"
xcrun swiftc -typecheck "$WORK/probe/Sources/Probe/main.swift" >"$WORK/probe.log" 2>&1 || probe_failed
xcrun swift package --package-path "$WORK/probe" dump-package >"$WORK/probe.log" 2>&1 || probe_failed
printf 'import SwiftUI\nstruct Probe: View { @State private var n = 0; var body: some View { Button("\\(n)") { n += 1 } } }\n' > "$WORK/probe/ui.swift"
PROBE_TARGET="$(uname -m)-apple-macos14"
if ! xcrun swiftc -target "$PROBE_TARGET" -typecheck "$WORK/probe/ui.swift" >"$WORK/probe.log" 2>&1; then
  SDK_PICK=""
  while IFS= read -r sdk; do
    if xcrun swiftc -sdk "$sdk" -target "$PROBE_TARGET" -typecheck "$WORK/probe/ui.swift" </dev/null >/dev/null 2>&1; then
      SDK_PICK="$sdk"
      break
    fi
  done < <(printf '%s\n' "$(xcode-select -p)"/SDKs/MacOSX[0-9]*.*.sdk | sort -rV)
  [[ -n "$SDK_PICK" ]] || fail "Tu SDK de macOS usa macros de SwiftUI que las Command Line Tools no traen, y no encontré otro SDK que compile. Instala Xcode desde la App Store y vuelve a intentarlo."
  export SDKROOT="$SDK_PICK"
  say "Compilando con $(basename "$SDK_PICK") (el SDK por defecto no trae los macros de SwiftUI)"
fi

say "Bajando PokeTokenBar $TAG"
git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$TAG" "$REPO" "$WORK/PokeTokenBar"
[[ "$(git -C "$WORK/PokeTokenBar" rev-parse HEAD)" == "$COMMIT" ]] || fail "El tag $TAG no apunta al commit esperado; no instalo nada."

say "Aplicando el parche de Token Clash (6.ª a 9.ª generación)"
curl -fsSL "$ORIGIN/poketokenbar/gen6-9.patch" -o "$WORK/gen6-9.patch"
git -C "$WORK/PokeTokenBar" -c user.name="Token Clash" -c user.email="token-clash@localhost" am --quiet "$WORK/gen6-9.patch"

say "Compilando e instalando en /Applications (unos minutos)"
(cd "$WORK/PokeTokenBar" && PTB_NATIVE_ARCH_ONLY=1 ./scripts/build-app.sh)

open "/Applications/PokeTokenBar.app"
say "Listo. Tu Pokédex sigue donde estaba, ahora con Kalos, Alola, Galar y Paldea."
