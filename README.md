# ![Perfect Jewelers Orb](./renderer/public/images/jeweler.png) Exiled Exchange 2 Native Linux

[![Upstream](https://img.shields.io/badge/upstream-Kvan7%2FExiled--Exchange--2-blue?style=plastic)](https://github.com/Kvan7/Exiled-Exchange-2)
[![Translation status](https://translate.codeberg.org/widget/exiled-exchange-2/svg-badge.svg)](https://translate.codeberg.org/engage/exiled-exchange-2/)

Native Linux/Wayland fork of [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) for Path of Exile 2.

This fork keeps the upstream app behavior intact and adds a native Qt/KDE host for Linux Wayland. The renderer, parser, trade logic, data, specs, and shared IPC types are kept aligned with upstream; native Linux behavior lives in `native/`.

Use upstream if you need the normal cross-platform Electron app. This fork intentionally does not keep the Electron `main/` tree because the native Qt/KDE host replaces that runtime.

## Target Environment

- Game: Path of Exile 2
- OS/session: Linux, KDE Plasma, Wayland
- Overlay shell: KDE LayerShellQt
- Global shortcuts: KDE `KGlobalAccel`
- Input injection: `ydotool` with `ydotoold` running
- UI runtime: Qt WebEngine serving the built Vue renderer locally

Windowed or windowed fullscreen PoE2 is the expected setup.

## Runtime Setup

Install the native runtime/build dependencies from your distro packages:

- Qt 6 base/tools and Qt WebEngine
- KDE Frameworks: `KGlobalAccel`, `KWindowSystem`, `KCoreAddons`
- `LayerShellQt`
- `ydotool`
- `npm`, `make`, and a C++20 compiler for local builds

Make sure `ydotoold` is running for your user/session before using hotkeys that copy item text or type chat commands.

## Build And Run

```shell
./testUpdate.sh
./native/exiled-exchange-native
```

`testUpdate.sh` builds the Vue renderer, builds the native Qt host, and installs a local desktop entry for `exiled-exchange-native`.

Default native hotkeys:

- `Ctrl+D`: price check the hovered item
- `Ctrl+Alt+P`: toggle the overlay
- `F5`: send `/hideout`
- `F9`: send `/exit`

Config is saved by the native host under Qt's app config location for `exiled-exchange-native`.

## Keeping Upstream Behavior

The intent is to keep non-native app behavior the same as upstream. Parser, trade-site, renderer, data, specs, and shared IPC changes should come from upstream directly. Native-specific platform behavior should stay isolated under `native/` and in the small fork docs/build scripts.

Suggested remote:

```shell
git remote add upstream https://github.com/Kvan7/Exiled-Exchange-2.git
git fetch upstream
```

Then compare and port intentionally. The expected fork-specific areas are:

- `native/`
- `README.md`, `DEVELOPING.md`, and native Linux docs
- `testUpdate.sh`

Everything else should be treated as upstream-owned unless there is a specific reason to diverge. The upstream Electron `main/` tree is intentionally omitted from this fork.

## Thanks

This fork exists because of the work in [Kvan7/Exiled-Exchange-2](https://github.com/Kvan7/Exiled-Exchange-2). Thank you to the upstream maintainers and contributors for making the PoE2 trade overlay and renderer possible.

Additional thanks to:

- [awakened-poe-trade](https://github.com/SnosMe/awakened-poe-trade)
- [RePoE](https://github.com/brather1ng/RePoE)
- [poeprices.info](https://www.poeprices.info/)
- [poe.ninja](https://poe.ninja/)
