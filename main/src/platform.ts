export function isWaylandMode() {
  return process.platform === "linux";
}

export function assertLinuxOnly() {
  if (process.platform === "linux") return;

  throw new Error(
    `Exiled Exchange 2 Linux fork only supports Linux/KDE Plasma Wayland. Current platform: ${process.platform}`,
  );
}
