import child_process from "node:child_process";
import { mergeTwoHotkeys } from "../../../ipc/KeyToCode";
import type { HostClipboard } from "./HostClipboard";
import type { OverlayWindow } from "../windowing/OverlayWindow";

const PLACEHOLDER_LAST = "@last";
const AUTO_CLEAR = ["#", "%", "@", "$", "&", "/"];
const RESTORE_BUFFER = 120;

const KeyCode: Partial<Record<string, number>> = {
  Ctrl: 29,
  Alt: 56,
  Shift: 42,
  C: 46,
  D: 32,
  V: 47,
  A: 30,
  E: 18,
  F: 33,
  H: 35,
  I: 23,
  O: 24,
  T: 20,
  U: 22,
  X: 45,
  F5: 63,
  F9: 67,
  Slash: 53,
  Enter: 28,
  Home: 102,
  Delete: 111,
  ArrowUp: 103,
  ArrowRight: 106,
  ArrowLeft: 105,
  Escape: 1,
};

export function pressWaylandCopyItemText(
  _pressedKeys: string[] = [],
  showModsKey: string,
) {
  const copyShortcut =
    process.env.EXILED_WAYLAND_COPY_ADVANCED === "true"
      ? mergeTwoHotkeys("Ctrl + C", showModsKey)
      : "Ctrl + C";
  let keys = copyShortcut.split(" + ");
  keys = keys.filter((key) => key !== "C");
  runYdotoolSequence([[...keys, "C"]]);
}

export function typeInChatWayland(
  text: string,
  send: boolean,
  clipboard: HostClipboard,
  overlay: OverlayWindow,
  pressedKeys: string[] = [],
) {
  if (!text.includes(PLACEHOLDER_LAST)) {
    typePlainChatWayland(text, send, overlay, pressedKeys);
    return;
  }

  const sequence: string[][] = getReleaseSequence(pressedKeys);

  if (text.startsWith(PLACEHOLDER_LAST)) {
    text = text.slice(`${PLACEHOLDER_LAST} `.length);
    sequence.push(["Ctrl", "Enter"]);
  } else if (text.endsWith(PLACEHOLDER_LAST)) {
    text = text.slice(0, -PLACEHOLDER_LAST.length);
    sequence.push(["Ctrl", "Enter"], ["Home"], ["Home"], ["Delete"]);
  } else {
    sequence.push(["Enter"]);
    if (!AUTO_CLEAR.includes(text[0])) {
      sequence.push(["Ctrl", "A"]);
    }
  }

  sequence.push(["Ctrl", "V"]);

  if (send) {
    sequence.push(["Enter"], ["Enter"], ["ArrowUp"], ["ArrowUp"], ["Escape"]);
  }

  runClipboardSequenceWayland(text, sequence, clipboard, overlay);
}

function typePlainChatWayland(
  text: string,
  send: boolean,
  overlay: OverlayWindow,
  pressedKeys: string[],
) {
  const focusDelay = getWaylandFocusDelay();
  const releaseDelay = getWaylandTriggerReleaseDelay();

  overlay.assertGameActive();
  runYdotoolSequence(getReleaseSequence(pressedKeys), focusDelay);
  runYdotoolSequence([["Enter"]], focusDelay + releaseDelay);
  const commandKeys = getPlainCommandKeys(text);
  const commandDelay = focusDelay + releaseDelay + getYdotoolKeyDelay() * 2;
  if (commandKeys) {
    runYdotoolSequence(commandKeys, commandDelay);
  } else {
    runYdotoolType(text, commandDelay);
  }

  if (send) {
    runYdotoolSequence(
      [["Enter"], ["Enter"], ["ArrowUp"], ["ArrowUp"], ["Escape"]],
      commandDelay + getCommandDelay(text, commandKeys),
    );
  }
}

function getPlainCommandKeys(text: string) {
  switch (text) {
    case "/hideout":
      return [["Slash"], ["H"], ["I"], ["D"], ["E"], ["O"], ["U"], ["T"]];
    case "/exit":
      return [["Slash"], ["E"], ["X"], ["I"], ["T"]];
    default:
      return null;
  }
}

export function stashSearchWayland(
  text: string,
  clipboard: HostClipboard,
  overlay: OverlayWindow,
) {
  runClipboardSequenceWayland(
    text,
    [["Ctrl", "F"], ["Ctrl", "V"], ["Enter"]],
    clipboard,
    overlay,
  );
}

function runYdotoolKey(keys: string[]) {
  runYdotoolSequence([keys]);
}

function runClipboardSequenceWayland(
  text: string,
  sequence: string[][],
  clipboard: HostClipboard,
  overlay: OverlayWindow,
) {
  const focusDelay = getWaylandFocusDelay();
  const releaseSequence = sequence.filter((keys) =>
    keys.some((key) => key.endsWith(":up")),
  );
  const inputSequence = sequence.filter(
    (keys) => !keys.some((key) => key.endsWith(":up")),
  );
  const restoreAfter =
    focusDelay +
    getWaylandTriggerReleaseDelay() +
    getYdotoolSequenceDuration(inputSequence) +
    RESTORE_BUFFER;

  clipboard.restoreShortly((clipboard) => {
    overlay.assertGameActive();
    clipboard.writeText(text);
    runYdotoolSequence(releaseSequence, focusDelay);
    runYdotoolSequence(
      inputSequence,
      focusDelay + getWaylandTriggerReleaseDelay(),
    );
  }, restoreAfter);
}

function getReleaseSequence(pressedKeys: string[]) {
  return pressedKeys
    .filter((key) => !isWaylandModifier(key))
    .map((key) => [`${key}:up`]);
}

function runYdotoolSequence(sequence: string[][], delay = 0) {
  const events = sequence.flatMap((keys) => toYdotoolKeyEvents(keys));
  if (!events.length) return;

  setTimeout(() => {
    spawnYdotool(events);
  }, delay);
}

function spawnYdotool(events: string[]) {
  const child = child_process.spawn(
    "ydotool",
    ["key", "--key-delay", String(getYdotoolKeyDelay()), ...events],
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

function runYdotoolType(text: string, delay = 0) {
  setTimeout(() => {
    const child = child_process.spawn(
      "ydotool",
      ["type", "--key-delay", String(getYdotoolKeyDelay()), text],
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
  }, delay);
}

function getTypeDelay(text: string) {
  return text.length * getYdotoolKeyDelay() * 2;
}

function getCommandDelay(text: string, commandKeys: string[][] | null) {
  return commandKeys
    ? getYdotoolSequenceDuration(commandKeys)
    : getTypeDelay(text);
}

function getYdotoolSequenceDuration(sequence: string[][]) {
  const eventCount = sequence.flatMap((keys) =>
    toYdotoolKeyEvents(keys),
  ).length;
  return eventCount * getYdotoolKeyDelay();
}

function getYdotoolKeyDelay() {
  return Number(process.env.EXILED_WAYLAND_KEY_DELAY || "35");
}

function getWaylandFocusDelay() {
  return Number(process.env.EXILED_WAYLAND_FOCUS_DELAY || "100");
}

function getWaylandTriggerReleaseDelay() {
  return Number(process.env.EXILED_WAYLAND_TRIGGER_RELEASE_DELAY || "80");
}

function toYdotoolKeyEvents(keys: string[]) {
  const events: Array<{ code: number; direction?: string }> = [];

  for (const key of keys) {
    const [name, direction] = key.split(":");
    const code = KeyCode[name];
    if (code != null) {
      events.push({ code, direction });
    }
  }

  if (events.some((event) => event.direction)) {
    return events.map(({ code, direction }) => {
      return `${code}:${direction === "up" ? "0" : "1"}`;
    });
  }

  return [
    ...events.map(({ code }) => `${code}:1`),
    ...events
      .slice()
      .reverse()
      .map(({ code }) => `${code}:0`),
  ];
}

function isWaylandModifier(key: string) {
  return key === "Ctrl" || key === "Alt" || key === "Shift";
}
