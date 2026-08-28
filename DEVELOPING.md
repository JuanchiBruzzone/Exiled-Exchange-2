# Developing This Fork

This fork has two primary parts:

1. `renderer/`: upstream Exiled Exchange 2 Vue UI, parser, trade search, and settings.
2. `native/`: Linux/KDE Wayland Qt host that replaces the Electron `main/` process for this fork.

Keep non-native code the same as upstream unless the native host requires a small integration point. The goal is upstream behavior with a native Linux Wayland host, not a separate product.

## Native Development Flow

From the repository root:

```shell
./testUpdate.sh
./native/exiled-exchange-native
```

`testUpdate.sh`:

- builds the renderer with Vite
- builds the Qt host with `qmake6` and `make`
- installs a local desktop entry for the native executable

## Manual Build

```shell
cd renderer
npm ci
npm run make-index-files
npm run build

cd ../native
qmake6 exiled-exchange-native.pro -o Makefile
make -j"$(nproc)"
```

Run:

```shell
./native/exiled-exchange-native
```

## Runtime Requirements

- KDE Plasma Wayland session
- Path of Exile 2 in windowed or windowed fullscreen mode
- Qt 6 and Qt WebEngine
- KDE Frameworks: `KGlobalAccel`, `KWindowSystem`, `KCoreAddons`
- LayerShellQt
- `ydotool` with `ydotoold` running
- `wl-clipboard`

## Upstream Sync

Use upstream Exiled Exchange 2 as the source of truth for renderer and trade behavior:

```shell
git remote add upstream https://github.com/Kvan7/Exiled-Exchange-2.git
git fetch upstream
```

When upstream changes overlap with the native fork, prefer upstream for `renderer/`, `ipc/`, parser, data, specs, and trade behavior. Keep native-specific changes in `native/` and fork-specific docs/build scripts.

Before finishing an upstream sync, these comparisons should be clean:

```shell
diff -qr /tmp/exiled-upstream/renderer/src renderer/src
diff -qr /tmp/exiled-upstream/renderer/specs renderer/specs
diff -q /tmp/exiled-upstream/ipc/types.ts ipc/types.ts
```

The upstream Electron `main/` tree is intentionally absent in this fork. Do not reintroduce it unless this repository starts shipping the cross-platform Electron host again.

## Formatting

```shell
cd renderer
npm run format
```

## Release Notes

This repository currently builds a native Linux host binary locally. Packaging work should document its target clearly as Linux/KDE Plasma Wayland for Path of Exile 2.
