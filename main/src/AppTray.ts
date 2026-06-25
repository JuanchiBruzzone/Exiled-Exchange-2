import path from "path";
import { app, Tray, Menu, shell, nativeImage, dialog } from "electron";
import type { ServerEvents } from "./server";

export class AppTray {
  public overlayKey = "Ctrl + Alt + P";
  private tray: Tray;
  serverPort = 0;

  constructor(server: ServerEvents) {
    const trayImage = nativeImage.createFromPath(
      path.join(__dirname, process.env.STATIC!, "icon.png"),
    );

    this.tray = new Tray(trayImage);
    this.tray.setToolTip(`Exiled Exchange 2 v${app.getVersion()}`);
    this.rebuildMenu();

    server.onEventAnyClient("CLIENT->MAIN::user-action", ({ action }) => {
      if (action === "quit") {
        app.quit();
      }
    });
  }

  rebuildMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Settings/League",
        click: () => {
          dialog.showMessageBox({
            title: "Settings",
            message: `Open Path of Exile 2 and press "${this.overlayKey}". Click on the button with cog icon there.`,
          });
        },
      },
      {
        label: "Open in Browser",
        click: () => {
          shell.openExternal(`http://localhost:${this.serverPort}`);
        },
      },
      { type: "separator" },
      {
        label: "Open config folder",
        click: () => {
          shell.openPath(path.join(app.getPath("userData"), "apt-data"));
        },
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }
}
