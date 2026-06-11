import path from "path";
import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import {
  BrowserWindow,
  dialog,
  shell,
  Menu,
  screen,
  Rectangle,
} from "electron";
import {
  OverlayController,
  OVERLAY_WINDOW_OPTS,
} from "electron-overlay-window";
import { isWaylandMode } from "../platform";
import type { ServerEvents } from "../server";
import type { Logger } from "../RemoteLogger";
import type { GameWindow } from "./GameWindow";

export class OverlayWindow {
  public isInteractable = false;
  public wasUsedRecently = true;
  private window?: BrowserWindow;
  private overlayKey: string = "Ctrl + Alt + P";
  private windowTitle: string = "Path of Exile 2";
  private isOverlayKeyUsed = false;
  private passiveHideTimer?: NodeJS.Timeout;

  constructor(
    private server: ServerEvents,
    private logger: Logger,
    private poeWindow: GameWindow,
  ) {
    this.server.onEventAnyClient(
      "OVERLAY->MAIN::focus-game",
      this.assertGameActive,
    );
    this.poeWindow.on("active-change", this.handlePoeWindowActiveChange);
    if (!isWaylandMode()) {
      this.poeWindow.onAttach(this.handleOverlayAttached);
    }

    this.server.onEventAnyClient("CLIENT->MAIN::used-recently", (e) => {
      this.wasUsedRecently = e.isOverlay;
    });

    if (process.argv.includes("--no-overlay")) return;

    const initialBounds = isWaylandMode() ? getWaylandDisplayBounds() : null;

    this.window = new BrowserWindow({
      icon: path.join(__dirname, process.env.STATIC!, "icon.png"),
      ...(isWaylandMode()
        ? {
            ...initialBounds,
            show: false,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            backgroundColor: "#00000000",
          }
        : OVERLAY_WINDOW_OPTS),
      width: 800,
      height: 600,
      webPreferences: {
        allowRunningInsecureContent: false,
        webviewTag: true,
        spellcheck: false,
      },
    });

    this.window.setMenu(
      Menu.buildFromTemplate([
        { role: "editMenu" },
        { role: "reload" },
        { role: "toggleDevTools" },
      ]),
    );

    this.window.webContents.on("before-input-event", this.handleExtraCommands);
    this.window.webContents.on(
      "did-attach-webview",
      (_, webviewWebContents) => {
        webviewWebContents.on("before-input-event", this.handleExtraCommands);
      },
    );

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });

    if (isWaylandMode()) {
      this.window.on("blur", () => {
        if (!this.isInteractable) return;

        this.isInteractable = false;
        this.hideWaylandPassiveOverlay();
        this.poeWindow.isActive = true;
        this.publishFocusChange();
      });
    }
  }

  loadAppPage(port: number) {
    const url =
      process.env.VITE_DEV_SERVER_URL || `http://localhost:${port}/index.html`;

    if (!this.window) {
      shell.openExternal(url);
      return;
    }

    if (process.env.VITE_DEV_SERVER_URL) {
      this.window.loadURL(url);
      this.window.webContents.openDevTools({ mode: "detach", activate: false });
    } else {
      this.window.loadURL(url);
    }

    if (isWaylandMode()) {
      this.window.webContents.once("did-finish-load", () => {
        this.handleOverlayAttached();
        this.prewarmWaylandOverlay();
      });
    }
  }

  assertOverlayActive = () => {
    this.clearPassiveHideTimer();
    if (!this.isInteractable) {
      this.isInteractable = true;
      if (isWaylandMode()) {
        this.showWaylandOverlay({ interactive: true });
      } else {
        OverlayController.activateOverlay();
      }
      this.poeWindow.isActive = false;
      this.publishFocusChange();
    }
  };

  assertGameActive = () => {
    this.clearPassiveHideTimer();
    if (isWaylandMode() && !this.isInteractable) {
      this.hideWaylandPassiveOverlay();
      this.focusWaylandGameWindow();
      return;
    }

    if (this.isInteractable) {
      this.isInteractable = false;
      if (isWaylandMode()) {
        this.window?.hide();
        this.window?.setIgnoreMouseEvents(false);
        this.focusWaylandGameWindow();
      } else {
        OverlayController.focusTarget();
      }
      this.poeWindow.isActive = true;
      this.publishFocusChange();
    }
  };

  showPassiveOverlay = () => {
    if (!isWaylandMode()) {
      this.assertOverlayActive();
      return;
    }

    if (this.isInteractable) return;

    this.showWaylandOverlay({ interactive: false });
    this.poeWindow.isActive = true;
    this.publishFocusChange(true);

    this.clearPassiveHideTimer();
    this.passiveHideTimer = setTimeout(
      () => {
        if (!this.isInteractable) {
          this.hideWaylandPassiveOverlay();
        }
      },
      Number(process.env.EXILED_WAYLAND_PASSIVE_OVERLAY_MS || "4500"),
    );
  };

  toggleActiveState = () => {
    this.isOverlayKeyUsed = true;
    if (this.isInteractable) {
      this.assertGameActive();
    } else {
      this.assertOverlayActive();
    }
  };

  updateOpts(overlayKey: string, windowTitle: string) {
    this.overlayKey = overlayKey;
    const effectiveWindowTitle = process.env.EXILED_WINDOW_TITLE || windowTitle;
    this.windowTitle = effectiveWindowTitle;
    if (isWaylandMode()) {
      return;
    }
    this.poeWindow.attach(this.window, effectiveWindowTitle);
  }

  private handleExtraCommands = (
    event: Electron.Event,
    input: Electron.Input,
  ) => {
    if (input.type !== "keyDown") return;

    let { code, control: ctrlKey, shift: shiftKey, alt: altKey } = input;

    if (code.startsWith("Key")) {
      code = code.slice("Key".length);
    } else if (code.startsWith("Digit")) {
      code = code.slice("Digit".length);
    }

    if (shiftKey && altKey) code = `Shift + Alt + ${code}`;
    else if (ctrlKey && shiftKey) code = `Ctrl + Shift + ${code}`;
    else if (ctrlKey && altKey) code = `Ctrl + Alt + ${code}`;
    else if (altKey) code = `Alt + ${code}`;
    else if (ctrlKey) code = `Ctrl + ${code}`;
    else if (shiftKey) code = `Shift + ${code}`;

    switch (code) {
      case "Escape":
      case "Ctrl + W": {
        event.preventDefault();
        process.nextTick(this.assertGameActive);
        break;
      }
      case this.overlayKey: {
        event.preventDefault();
        process.nextTick(this.toggleActiveState);
        break;
      }
    }
  };

  private showWaylandOverlay({ interactive }: { interactive: boolean }) {
    if (!this.window) return;

    this.applyWaylandBounds();
    this.window.setFocusable(interactive);
    this.window.setIgnoreMouseEvents(!interactive, { forward: true });
    this.window.setAlwaysOnTop(true);
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (interactive) {
      this.window.show();
    } else {
      this.window.showInactive();
    }
    this.window.moveTop();
    if (interactive) this.window.focus();

    // On Wayland, bounds set before the first map can be ignored by the
    // compositor. Reapply once the surface is visible to avoid a tiny first open.
    setTimeout(() => this.raiseWaylandOverlay({ interactive }), 0);
    setTimeout(() => this.raiseWaylandOverlay({ interactive }), 50);
  }

  private prewarmWaylandOverlay() {
    if (!this.window) return;

    this.applyWaylandBounds();
    this.window.setOpacity(0);
    this.window.setFocusable(false);
    this.window.setIgnoreMouseEvents(true, { forward: true });
    this.window.showInactive();
    this.window.moveTop();

    setTimeout(() => {
      if (!this.window || this.isInteractable) return;

      this.applyWaylandBounds();
      this.window.hide();
      this.window.setOpacity(1);
      this.window.setIgnoreMouseEvents(false);
    }, 100);
  }

  private applyWaylandBounds() {
    const bounds = getWaylandDisplayBounds();
    this.window?.setBounds(bounds);
  }

  private raiseWaylandOverlay({ interactive }: { interactive: boolean }) {
    if (!this.window) return;
    if (!interactive && this.isInteractable) return;

    this.applyWaylandBounds();
    this.window.setAlwaysOnTop(true);
    this.window.moveTop();
    if (interactive) this.window.focus();
  }

  private clearPassiveHideTimer() {
    if (this.passiveHideTimer == null) return;

    clearTimeout(this.passiveHideTimer);
    this.passiveHideTimer = undefined;
  }

  private hideWaylandPassiveOverlay() {
    this.window?.hide();
    this.window?.setIgnoreMouseEvents(false);
    this.server.sendEventTo("broadcast", {
      name: "MAIN->OVERLAY::hide-exclusive-widget",
      payload: undefined,
    });
  }

  private focusWaylandGameWindow() {
    if (!String(process.env.XDG_CURRENT_DESKTOP || "").includes("KDE")) return;

    const title = this.windowTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const script = `
const title = "${title}";
const windows = workspace.windowList ? workspace.windowList() : workspace.clientList();
for (const window of windows) {
  const caption = String(window.caption || window.captionNormal || "");
  if (caption.includes(title)) {
    if ("activeWindow" in workspace) {
      workspace.activeWindow = window;
    } else {
      workspace.activeClient = window;
    }
    break;
  }
}
`;
    const scriptPath = path.join(
      os.tmpdir(),
      `exiled-exchange-focus-poe-${process.pid}.js`,
    );

    try {
      fs.writeFileSync(scriptPath, script);
      const load = child_process.spawn("qdbus6", [
        "org.kde.KWin",
        "/Scripting",
        "org.kde.kwin.Scripting.loadScript",
        scriptPath,
        `exiled-exchange-focus-poe-${process.pid}-${Date.now()}`,
      ]);

      let scriptId = "";
      load.stdout.on("data", (data) => {
        scriptId += data.toString();
      });
      load.on("error", (error) => {
        this.logger.write(
          `error [Wayland] Failed to run qdbus6 for KWin focus: ${error.message}`,
        );
      });
      load.on("close", (code) => {
        if (code !== 0) {
          this.logger.write(
            `error [Wayland] KWin focus script failed to load with code ${code}.`,
          );
          return;
        }

        const id = scriptId.trim();
        if (!id) {
          this.logger.write(
            "error [Wayland] KWin focus script loaded without returning a script id.",
          );
          return;
        }

        for (const objectPath of [`/Scripting/Script${id}`, `/${id}`]) {
          const run = child_process.spawn("qdbus6", [
            "org.kde.KWin",
            objectPath,
            "org.kde.kwin.Script.run",
          ]);
          run.on("error", (error) => {
            this.logger.write(
              `error [Wayland] Failed to run KWin focus script at ${objectPath}: ${error.message}`,
            );
          });
        }
      });
    } catch (error) {
      const message = `[Wayland] Failed to prepare KWin focus script: ${error}`;
      this.logger.write(`error ${message}`);
      console.warn(message);
    }
  }

  private handleOverlayAttached = (hasAccess?: boolean) => {
    if (hasAccess === false) {
      this.logger.write(
        "error [Overlay] PoE2 is running with administrator rights",
      );

      dialog.showErrorBox(
        "PoE2 window - No access",
        // ----------------------
        "Path of Exile 2 is running with administrator rights.\n" +
          "\n" +
          "You need to restart Exiled Exchange 2 with administrator rights.",
      );
    } else {
      this.server.sendEventTo("broadcast", {
        name: "MAIN->OVERLAY::overlay-attached",
        payload: undefined,
      });
    }
  };

  private handlePoeWindowActiveChange = (isActive: boolean) => {
    if (isActive && this.isInteractable) {
      this.isInteractable = false;
    }
    this.publishFocusChange(isActive);
    this.isOverlayKeyUsed = false;
  };

  private publishFocusChange = (isActive = this.poeWindow.isActive) => {
    this.server.sendEventTo("broadcast", {
      name: "MAIN->OVERLAY::focus-change",
      payload: {
        game: isActive,
        overlay: this.isInteractable,
        usingHotkey: this.isOverlayKeyUsed,
      },
    });
  };
}

function roundRect(rect: Rectangle) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function getWaylandDisplayBounds() {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  return roundRect(display.bounds);
}
