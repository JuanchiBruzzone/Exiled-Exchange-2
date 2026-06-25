# Native Qt/KDE Host

This directory contains the Linux Wayland host for Exiled Exchange 2.

The native host replaces the Electron `main/` runtime responsibilities while keeping the Vue renderer and upstream price-check UI:

- serves `renderer/dist` over a local HTTP/WebSocket server
- hosts the Vue UI in `QWebEngineView`
- shows the overlay through KDE LayerShellQt
- registers global shortcuts through KDE `KGlobalAccel`
- injects PoE2 copy/chat key sequences through `ydotool`
- proxies allowed trade/API requests for the renderer
- persists renderer config through the native `/config` endpoint

## Supported Setup

- Linux
- KDE Plasma Wayland
- Path of Exile 2
- `ydotoold` running in the user session

## Build

From the repository root:

```bash
./testUpdate.sh
```

Or manually:

```bash
cd renderer
npm ci
npm run make-index-files
npm run build

cd ../native
qmake6 exiled-exchange-native.pro -o Makefile
make -j"$(nproc)"
```

## Run

```bash
./native/exiled-exchange-native
```

Current native shortcuts:

- `Ctrl+D`: copy hovered item text from PoE2 and show the price-check widget
- `Ctrl+Alt+P`: toggle the interactive overlay
- `F5`: type `/hideout`
- `F9`: type `/exit`

Keep renderer behavior aligned with upstream Exiled Exchange 2. Native-only platform behavior should stay isolated in this directory where possible.
