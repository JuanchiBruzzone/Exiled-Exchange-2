import child_process from "node:child_process";
import { mergeTwoHotkeys } from "../../../ipc/KeyToCode";
import type { HostClipboard } from "./HostClipboard";

const PLACEHOLDER_LAST = "@last";
const AUTO_CLEAR = ["#", "%", "@", "$", "&", "/"];

const KeyCode: Partial<Record<string, number>> = {
  Ctrl: 29,
  Alt: 56,
  Shift: 42,
  C: 46,
  V: 47,
  A: 30,
  F: 33,
  Enter: 28,
  Home: 102,
  Delete: 111,
  ArrowUp: 103,
  ArrowRight: 106,
  ArrowLeft: 105,
  Escape: 1,
};

export function pressWaylandCopyItemText(
  _pressedModKeys: string[] = [],
  showModsKey: string,
) {
  const copyShortcut =
    process.env.EXILED_WAYLAND_COPY_ADVANCED === "true"
      ? mergeTwoHotkeys("Ctrl + C", showModsKey)
      : "Ctrl + C";
  let keys = copyShortcut.split(" + ");
  keys = keys.filter((key) => key !== "C");
  runYdotoolKey([...keys, "C"]);
}

export function typeInChatWayland(
  text: string,
  send: boolean,
  clipboard: HostClipboard,
) {
  clipboard.restoreShortly((clipboard) => {
    const sequence: string[][] = [];

    if (text.startsWith(PLACEHOLDER_LAST)) {
      text = text.slice(`${PLACEHOLDER_LAST} `.length);
      clipboard.writeText(text);
      sequence.push(["Ctrl", "Enter"]);
    } else if (text.endsWith(PLACEHOLDER_LAST)) {
      text = text.slice(0, -PLACEHOLDER_LAST.length);
      clipboard.writeText(text);
      sequence.push(["Ctrl", "Enter"], ["Home"], ["Home"], ["Delete"]);
    } else {
      clipboard.writeText(text);
      sequence.push(["Enter"]);
      if (!AUTO_CLEAR.includes(text[0])) {
        sequence.push(["Ctrl", "A"]);
      }
    }

    sequence.push(["Ctrl", "V"]);

    if (send) {
      sequence.push(["Enter"], ["Enter"], ["ArrowUp"], ["ArrowUp"], ["Escape"]);
    }

    runYdotoolSequence(sequence);
  });
}

function runYdotoolKey(keys: string[]) {
  runYdotoolSequence([keys]);
}

function runYdotoolSequence(sequence: string[][]) {
  const events = sequence.flatMap((keys) => toYdotoolKeyEvents(keys));
  if (!events.length) return;

  const child = child_process.spawn(
    "ydotool",
    ["key", "--key-delay", process.env.EXILED_WAYLAND_KEY_DELAY || "35", ...events],
    {
      stdio: "ignore",
    },
  );

  child.on("error", (error) => {
    console.warn(
      `[Wayland] ydotool failed: ${error.message}. Install ydotool and start ydotoold for Wayland input injection.`,
    );
  });
  child.on("close", (code, signal) => {
    if (code === 0) return;

    console.warn(
      `[Wayland] ydotool exited with code=${code} signal=${signal}. Check that ydotoold is running and your user can access its socket.`,
    );
  });
}

function toYdotoolKeyEvents(keys: string[]) {
  const codes = keys
    .map((key) => KeyCode[key])
    .filter((code): code is number => code != null);

  return [
    ...codes.map((code) => `${code}:1`),
    ...codes
      .slice()
      .reverse()
      .map((code) => `${code}:0`),
  ];
}
