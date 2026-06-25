---
title: Download
---

<script setup>
import { useData } from 'vitepress'

const { theme } = useData()
</script>

This fork targets KDE Plasma Wayland with Path of Exile 2 running in a Wayland desktop session.

| Build target | Automatic updates | Startup time |
| ------------ | ----------------- | ------------ |
| Native Qt/KDE host built from source | No | Native host startup |

Latest version is <span class="bg-gray-100 border rounded px-1">{{ theme.appVersion }}</span>

---

### Requirements

- Desktop session
  - Supported: KDE Plasma Wayland
  - Required helpers/libraries: `ydotool`/`ydotoold`, Qt WebEngine, KDE `KGlobalAccel`, LayerShellQt
- PoE2 display mode
  - Supported: Windowed Fullscreen, Windowed
  - Unsupported: Exclusive Fullscreen
- PoE2 language
  - Supported: English
  - Not supported in this fork: Russian, Portuguese, Thai, French, German, Spanish, Korean

Cloud gaming services are not compatible when they do not forward clipboard data.

---

### Moving from POE1/Awakened PoE Trade on Linux

1. Run Exiled Exchange 2 Native once so it creates its data directory.
2. Quit Exiled Exchange 2 Native.
3. Copy `apt-data` from your old Awakened PoE Trade data directory into Exiled Exchange 2's data directory.
4. Edit `config.json` and set `"windowTitle": "Path of Exile 2"`.
5. Start Exiled Exchange 2 Native and PoE2.

Typical Exiled Exchange 2 data location on Linux is under `~/.config/exiled-exchange-2/apt-data`.
