"use strict";

import { app } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startServer, eventPipe, server } from "./server";
import { Logger } from "./RemoteLogger";
import { GameWindow } from "./windowing/GameWindow";
import { OverlayWindow } from "./windowing/OverlayWindow";
import { GameConfig } from "./host-files/GameConfig";
import { Shortcuts } from "./shortcuts/Shortcuts";
import { AppUpdater } from "./AppUpdater";
import { AppTray } from "./AppTray";
import { GameLogWatcher } from "./host-files/GameLogWatcher";
import { HttpProxy } from "./proxy";
import { installExtension, VUEJS_DEVTOOLS } from "electron-devtools-installer";
import { FileWriter } from "./host-files/FileWriter";
import { assertLinuxOnly } from "./platform";

assertLinuxOnly();

const startupLogPath = path.join(os.tmpdir(), "exiled-exchange-2-startup.log");
function startupLog(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.appendFileSync(startupLogPath, line);
  } catch {
    // Startup logging must never prevent the app from launching.
  }
}

startupLog(`main loaded pid=${process.pid}`);

process.addListener("uncaughtException", (err) => {
  startupLog(`uncaughtException ${err.message}\n${err.stack ?? ""}`);
});
process.addListener("unhandledRejection", (reason) => {
  startupLog(`unhandledRejection ${(reason as Error)?.stack ?? String(reason)}`);
});

app.setName("Exiled Exchange 2");
const linuxApp = app as typeof app & {
  setDesktopName?: (desktopName: string) => void;
};
// KDE's GlobalShortcuts portal reliably prompts for Electron under Chromium's
// desktop identity. A custom AppImage desktop id registers but does not prompt
// consistently when launched directly.
const portalDesktopFile =
  process.env.EXILED_PORTAL_DESKTOP_FILE || "com.google.Chrome.desktop";
startupLog(`setDesktopName ${portalDesktopFile}`);
linuxApp.setDesktopName?.(portalDesktopFile);

app.commandLine.appendSwitch("ozone-platform", "wayland");
app.commandLine.appendSwitch(
  "enable-features",
  "WaylandWindowDecorations,GlobalShortcutsPortal",
);

const hasSingleInstanceLock = app.requestSingleInstanceLock();
startupLog(`single-instance-lock ${hasSingleInstanceLock}`);
if (!hasSingleInstanceLock) {
  app.exit();
}

app.disableHardwareAcceleration();
let tray: AppTray;

(async () => {
  app.on("render-process-gone", (_event, webContents, details) => {
    startupLog(
      `render-process-gone id=${webContents.id} reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });
  app.on("child-process-gone", (_event, details) => {
    startupLog(
      `child-process-gone type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`,
    );
  });
  app.on("second-instance", () => {
    startupLog("second-instance");
  });
  app.on("window-all-closed", () => {
    startupLog("window-all-closed");
  });
  app.on("before-quit", () => {
    startupLog("before-quit");
  });
  app.on("will-quit", () => {
    startupLog("will-quit");
  });
  app.on("ready", async () => {
    startupLog("app ready");
    tray = new AppTray(eventPipe);
    const logger = new Logger(eventPipe);
    const gameConfig = new GameConfig(eventPipe, logger);
    const poeWindow = new GameWindow();
    const appUpdater = new AppUpdater(eventPipe);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _httpProxy = new HttpProxy(server, logger);
    const fileWriter = new FileWriter(eventPipe, logger);
    const gameLogWatcher = new GameLogWatcher(eventPipe, logger, fileWriter);

    if (process.env.VITE_DEV_SERVER_URL) {
      try {
        await installExtension(VUEJS_DEVTOOLS);
        logger.write("info Vue Devtools installed");
      } catch (error) {
        logger.write(`error installing Vue Devtools: ${error}`);
        console.log(`error installing Vue Devtools: ${error}`);
      }
    }
    process.addListener("uncaughtException", (err) => {
      logger.write(`error [uncaughtException] ${err.message}, ${err.stack}`);
      startupLog(`ready uncaughtException ${err.message}\n${err.stack ?? ""}`);
    });
    process.addListener("unhandledRejection", (reason) => {
      logger.write(`error [unhandledRejection] ${(reason as Error).stack}`);
      startupLog(
        `ready unhandledRejection ${(reason as Error)?.stack ?? String(reason)}`,
      );
    });

    setTimeout(
      async () => {
        const overlay = new OverlayWindow(eventPipe, logger, poeWindow);
        const shortcuts = await Shortcuts.create(
          logger,
          overlay,
          poeWindow,
          gameConfig,
          eventPipe,
        );
        eventPipe.onEventAnyClient(
          "CLIENT->MAIN::update-host-config",
          (cfg) => {
            overlay.updateOpts(cfg.overlayKey, cfg.windowTitle);
            shortcuts.updateActions(
              cfg.shortcuts,
              cfg.stashScroll,
              cfg.logKeys,
              cfg.restoreClipboard,
              cfg.language,
            );
            gameLogWatcher.restart(cfg.clientLog ?? "", cfg.readClientLog);
            gameConfig.readConfig(cfg.gameConfig ?? "");
            appUpdater.checkAtStartup();
            tray.overlayKey = cfg.overlayKey;
            fileWriter.restart(cfg.libraryAlpha, cfg.libraryOutputPath);
          },
        );
        const port = await startServer(appUpdater, logger);
        startupLog(`server started ${port}`);
        // TODO: move up (currently crashes)
        logger.write(`info ${os.type()} ${os.release} / v${app.getVersion()}`);
        overlay.loadAppPage(port);
        tray.serverPort = port;
      },
      // Wayland surfaces can briefly map black/opaque if created immediately.
      1000,
    );
  });
})();
