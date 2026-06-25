# ![Perfect Jewelers Orb](./renderer/public/images/jeweler.png) Exiled Exchange 2 Native Linux

[![Upstream](https://img.shields.io/badge/upstream-Kvan7%2FExiled--Exchange--2-blue?style=plastic)](https://github.com/Kvan7/Exiled-Exchange-2)
[![Translation status](https://translate.codeberg.org/widget/exiled-exchange-2/svg-badge.svg)](https://translate.codeberg.org/engage/exiled-exchange-2/)

Native Linux/Wayland fork of [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) for Path of Exile 2.

This fork keeps the renderer and price-checking behavior aligned with upstream Exiled Exchange 2, while replacing the Electron host path with a native Qt/KDE host for Linux Wayland. Use upstream if you need the normal cross-platform Electron app.

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

The intent is to keep non-native app behavior as close to upstream as possible. When upstream fixes parser, trade-site, or renderer behavior, port those changes directly and keep native-specific changes isolated under `native/` or clearly marked Linux host integration code.

Suggested remote:

```shell
git remote add upstream https://github.com/Kvan7/Exiled-Exchange-2.git
git fetch upstream
```

Then compare and port intentionally, especially for files under `renderer/src/web/price-check`.

## Thanks

This fork exists because of the work in [Kvan7/Exiled-Exchange-2](https://github.com/Kvan7/Exiled-Exchange-2). Thank you to the upstream maintainers and contributors for making the PoE2 trade overlay and renderer possible.

Additional thanks to:

- [awakened-poe-trade](https://github.com/SnosMe/awakened-poe-trade)
- [RePoE](https://github.com/brather1ng/RePoE)
- [poeprices.info](https://www.poeprices.info/)
- [poe.ninja](https://poe.ninja/)
