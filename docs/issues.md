---
title: Common issues
---

1. Confirm you are in a KDE Plasma Wayland session.

    Check `echo $XDG_CURRENT_DESKTOP` and `echo $XDG_SESSION_TYPE`. This fork expects KDE and `wayland`.

2. Confirm `ydotoold` is running.

    Chat commands, copy actions, and stash search need `ydotool` input injection on Wayland.

3. Confirm the native KDE/Qt dependencies are installed.

    The native host uses KDE `KGlobalAccel`, LayerShellQt, and Qt WebEngine.

4. Confirm PoE2 is not using exclusive fullscreen.

    Use Windowed or Windowed Fullscreen.

5. Check the logs in Settings -> Debug.

6. Delete `~/.config/exiled-exchange-native` if configuration migration is broken.

    Back up `apt-data` first if you need your configuration.

7. Restart Exiled Exchange 2 Linux and PoE2.

---

## PoE2

- [Query is too complex](/complex-query)
- [Unexpected token ..... is not valid JSON](/invalid-json)

## Linux / KDE Plasma Wayland

- Tray icon visibility depends on your Plasma system tray settings.
- If the overlay does not behave like an overlay, verify you are on KDE Plasma Wayland and LayerShellQt is installed.
- If hotkeys fire but no game input appears, verify `ydotoold` is running and accessible by your user.
