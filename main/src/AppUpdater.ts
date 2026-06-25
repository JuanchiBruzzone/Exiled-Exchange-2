import type { ServerEvents } from "./server";
import type { UpdateInfo } from "../../ipc/types";

export class AppUpdater {
  private _checkedAtStartup = false;
  private _info: UpdateInfo = { state: "initial" };

  public readonly noAutoUpdatesReason: Extract<
    UpdateInfo,
    { state: "update-available" }
  >["noDownloadReason"] = "not-supported";

  get info() {
    return this._info;
  }

  set info(info: UpdateInfo) {
    this._info = info;
    this.server.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::updater-state",
      payload: info,
    });
  }

  constructor(private server: ServerEvents) {
    this.server.onEventAnyClient("CLIENT->MAIN::user-action", ({ action }) => {
      if (action === "check-for-update") {
        this.check();
      }
    });
  }

  checkAtStartup() {
    if (!this._checkedAtStartup) {
      this._checkedAtStartup = true;
      this.check();
    }
  }

  private check = () => {
    // This fork is maintained through git/rebuilds. Runtime auto-update would
    // pull upstream AppImages and overwrite the Linux-only Wayland changes.
    this.info = { state: "update-not-available", checkedAt: Date.now() };
  };
}
