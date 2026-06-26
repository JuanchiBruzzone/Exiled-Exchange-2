export const HotkeyCodes = new Set([
  'Backspace',
  'Tab',
  'Enter',
  'Shift',
  'Ctrl',
  'Alt',
  'CapsLock',
  'Escape',
  'Space',
  'PageUp',
  'PageDown',
  'End',
  'Home',
  'ArrowLeft',
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'Insert',
  'Delete',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
  'Numpad0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'NumpadMultiply',
  'NumpadAdd',
  'NumpadSubtract',
  'NumpadDecimal',
  'NumpadDivide',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
  'F13',
  'F14',
  'F15',
  'F16',
  'F17',
  'F18',
  'F19',
  'F20',
  'F21',
  'F22',
  'F23',
  'F24',
  'Semicolon',
  'Equal',
  'Comma',
  'Minus',
  'Period',
  'Slash',
  'Backquote',
  'BracketLeft',
  'Backslash',
  'BracketRight',
  'Quote'
])

export function hotkeyToString (keys: string[], ctrl = false, shift = false, alt = false): string {
  if (keys.includes('Ctrl')) ctrl = true
  if (keys.includes('Shift')) shift = true
  if (keys.includes('Alt')) alt = true
  keys = keys.filter(key => !isModKey(key))

  let mod = ''
  if (ctrl && shift && alt) mod = 'Ctrl + Shift + Alt'
  else if (shift && alt) mod = 'Shift + Alt'
  else if (ctrl && shift) mod = 'Ctrl + Shift'
  else if (ctrl && alt) mod = 'Ctrl + Alt'
  else if (alt) mod = 'Alt'
  else if (ctrl) mod = 'Ctrl'
  else if (shift) mod = 'Shift'

  return (mod && keys.length)
    ? `${mod} + ${keys.join(' + ')}`
    : (keys.join(' + ') || mod)
}

function isModKey (key: string) {
  return (
    key === 'Ctrl' ||
    key === 'Shift' ||
    key === 'Alt'
  )
}
