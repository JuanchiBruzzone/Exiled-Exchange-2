#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$ROOT_DIR/native"
DESKTOP_FILE="$HOME/.local/share/applications/exiled-exchange-native.desktop"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This fork is Linux-only and must be built on Linux." >&2
  exit 1
fi

if [[ "${XDG_CURRENT_DESKTOP:-}" != *KDE* ]]; then
  echo "Warning: this native host targets KDE Plasma; current desktop is '${XDG_CURRENT_DESKTOP:-unknown}'." >&2
fi

if [[ "${XDG_SESSION_TYPE:-}" != "wayland" ]]; then
  echo "Warning: this native host targets Wayland; current session is '${XDG_SESSION_TYPE:-unknown}'." >&2
fi

command -v qmake6 >/dev/null || { echo "qmake6 is required." >&2; exit 1; }
command -v make >/dev/null || { echo "make is required." >&2; exit 1; }
command -v g++ >/dev/null || { echo "g++ is required." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required to build the Vue renderer." >&2; exit 1; }
command -v ydotool >/dev/null || {
  echo "Warning: ydotool is required at runtime for PoE2 Wayland input injection." >&2
}
[[ -e /usr/include/LayerShellQt/Window ]] || {
  echo "Warning: LayerShellQt development headers were not found in /usr/include/LayerShellQt." >&2
}

(
  cd "$ROOT_DIR/renderer"
  npm ci
  npm run make-index-files
  npm run build
)

qmake6 "$BUILD_DIR/exiled-exchange-native.pro" -o "$BUILD_DIR/Makefile"
make -C "$BUILD_DIR" -j"$(nproc)"

mkdir -p "$(dirname -- "$DESKTOP_FILE")"
cat >"$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Exiled Exchange Native
Comment=Native KDE Plasma Wayland host for Exiled Exchange 2
Exec=$BUILD_DIR/exiled-exchange-native
Icon=applications-games
Terminal=false
Categories=Game;Utility;
StartupNotify=false
X-KDE-Wayland-Interfaces=org_kde_plasma_window_management
EOF

command -v update-desktop-database >/dev/null && {
  update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
}

echo
echo "Built native KDE host:"
echo "  $BUILD_DIR/exiled-exchange-native"
echo "Installed desktop entry:"
echo "  $DESKTOP_FILE"
echo
echo "Run it with:"
echo "  $BUILD_DIR/exiled-exchange-native"
