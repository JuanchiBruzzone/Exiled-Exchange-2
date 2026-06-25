import { screen, globalShortcut } from "electron";
import { WidgetAreaTracker } from "../windowing/WidgetAreaTracker";
import { HostClipboard } from "./HostClipboard";
import { OcrWorker } from "../vision/link-main";
import {
  pressWaylandCopyItemText,
  stashSearchWayland,
  typeInChatWayland,
} from "./wayland-input";
import type { ShortcutAction } from "../../../ipc/types";
import type { Logger } from "../RemoteLogger";
import type { OverlayWindow } from "../windowing/OverlayWindow";
import type { GameWindow } from "../windowing/GameWindow";
import type { GameConfig } from "../host-files/GameConfig";
import type { ServerEvents } from "../server";

const DEDUPE_MS = 100;

type FixedShortcut = ShortcutAction & {
  accelerator: string;
};

const FIXED_SHORTCUTS: FixedShortcut[] = [
  {
    shortcut: "Ctrl + D",
    accelerator: "Ctrl+D",
    action: { type: "copy-item", target: "price-check", focusOverlay: false },
  },
  {
    shortcut: "Ctrl + Alt + P",
    accelerator: "Ctrl+Alt+P",
    action: { type: "toggle-overlay" },
  },
  {
    shortcut: "F5",
    accelerator: "F5",
    action: { type: "paste-in-chat", text: "/hideout", send: true },
  },
  {
    shortcut: "F9",
    accelerator: "F9",
    action: { type: "paste-in-chat", text: "/exit", send: true },
  },
];

export class Shortcuts {
  private logKeys = false;
  private isRegistered = false;
  private lastActionAt = 0;
  private areaTracker: WidgetAreaTracker;
  private clipboard: HostClipboard;

  static async create(
    logger: Logger,
    overlay: OverlayWindow,
    _poeWindow: GameWindow,
    gameConfig: GameConfig,
    server: ServerEvents,
  ) {
    const ocrWorker = await OcrWorker.create();
    const shortcuts = new Shortcuts(
      logger,
      overlay,
      gameConfig,
      server,
      ocrWorker,
    );
    return shortcuts;
  }

  private constructor(
    private logger: Logger,
    private overlay: OverlayWindow,
    private gameConfig: GameConfig,
    private server: ServerEvents,
    private ocrWorker: OcrWorker,
  ) {
    this.areaTracker = new WidgetAreaTracker(server, overlay);
    this.clipboard = new HostClipboard(logger);

    this.server.onEventAnyClient("CLIENT->MAIN::user-action", (e) => {
      if (e.action === "stash-search") {
        stashSearchWayland(e.text, this.clipboard, this.overlay);
      }
    });

    this.registerFixedShortcuts();
  }

  updateActions(
    _actions: ShortcutAction[],
    _stashScroll: boolean,
    logKeys: boolean,
    restoreClipboard: boolean,
    language: string,
  ) {
    this.logKeys = logKeys;
    this.clipboard.updateOptions(restoreClipboard);
    this.ocrWorker.updateOptions(language);
    this.registerFixedShortcuts();
  }

  private registerFixedShortcuts() {
    this.unregister();

    for (const entry of FIXED_SHORTCUTS) {
      const isOk = globalShortcut.register(entry.accelerator, () => {
        this.runAction(entry);
      });

      if (!isOk) {
        const message = `error [Shortcuts] Failed to register fixed KDE Wayland shortcut "${entry.shortcut}" (${entry.accelerator}). It is already registered by KDE or rejected by the desktop portal.`;
        this.logger.write(message);
        console.warn(message);
        continue;
      }

      this.logger.write(
        `info [Shortcuts] Registered fixed KDE Wayland shortcut "${entry.shortcut}" (${entry.accelerator}).`,
      );
    }

    this.isRegistered = true;
  }

  private unregister() {
    if (!this.isRegistered) return;

    globalShortcut.unregisterAll();
    this.isRegistered = false;
  }

  private runAction(entry: ShortcutAction) {
    const now = Date.now();
    if (now - this.lastActionAt < DEDUPE_MS) return;
    this.lastActionAt = now;

    if (this.logKeys) {
      this.logger.write(`debug [Shortcuts] Action type: ${entry.action.type}`);
    }

    if (entry.action.type === "toggle-overlay") {
      this.areaTracker.removeListeners();
      this.overlay.toggleActiveState();
    } else if (entry.action.type === "paste-in-chat") {
      this.logger.write(
        `info [Wayland] Running chat command "${entry.action.text}" from "${entry.shortcut}".`,
      );
      typeInChatWayland(
        entry.action.text,
        entry.action.send,
        this.clipboard,
        this.overlay,
        entry.shortcut.split(" + "),
      );
    } else if (entry.action.type === "trigger-event") {
      this.server.sendEventTo("broadcast", {
        name: "MAIN->CLIENT::widget-action",
        payload: { target: entry.action.target },
      });
    } else if (entry.action.type === "stash-search") {
      stashSearchWayland(entry.action.text, this.clipboard, this.overlay);
    } else if (entry.action.type === "copy-item") {
      const { action } = entry;
      const pressPosition = screen.getCursorScreenPoint();

      this.clipboard
        .readItemText()
        .then((clipboard) => {
          this.areaTracker.removeListeners();
          this.server.sendEventTo("last-active", {
            name: "MAIN->CLIENT::item-text",
            payload: {
              target: action.target,
              clipboard,
              position: pressPosition,
              focusOverlay: Boolean(action.focusOverlay),
            },
          });

          this.overlay.showPassiveOverlay();
        })
        .catch(() => {});

      const copy = () => {
        pressWaylandCopyItemText(undefined, this.gameConfig.showModsKey);
      };
      copy();
    } else if (
      entry.action.type === "ocr-text" &&
      entry.action.target === "heist-gems"
    ) {
      this.logger.write(
        "warn [Shortcuts] Heist gem OCR is disabled in the Linux Wayland fork.",
      );
    }
  }
}
