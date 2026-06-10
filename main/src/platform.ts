export const electronPlatform = process.env.EXILED_ELECTRON_PLATFORM;

export function isWaylandMode() {
  return process.platform === "linux" && electronPlatform === "wayland";
}

export function isX11Mode() {
  return process.platform === "linux" && electronPlatform === "x11";
}
