import child_process from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const inputHelperPath = path.join(
  root,
  'node_modules/uiohook-napi/libuiohook/src/x11/input_helper.c'
)

const original = `    XkbDescPtr desc = XkbGetKeyboard(helper_disp, XkbGBN_AllComponentsMask, XkbUseCoreKbd);
    if (desc != NULL && desc->names != NULL) {
        const char *layout_name = XGetAtomName(helper_disp, desc->names->keycodes);
        logger(LOG_LEVEL_DEBUG, "%s [%u]: Found keycode atom '%s' (%i)!\\n",
                __FUNCTION__, __LINE__, layout_name, (unsigned int) desc->names->keycodes);

        const char *prefix_xfree86 = "xfree86_";
        #ifdef USE_EVDEV
        const char *prefix_evdev = "evdev_";
        if (strncmp(layout_name, prefix_evdev, strlen(prefix_evdev)) == 0) {
            is_evdev = true;
        } else
        #endif
        if (strncmp(layout_name, prefix_xfree86, strlen(prefix_xfree86)) != 0) {
            logger(LOG_LEVEL_ERROR, "%s [%u]: Unknown keycode name '%s', please file a bug report!\\n",
                    __FUNCTION__, __LINE__, layout_name);
        } else if (layout_name == NULL) {
            logger(LOG_LEVEL_ERROR, "%s [%u]: X atom name failure for desc->names->keycodes!\\n",
                    __FUNCTION__, __LINE__);
        }

        XkbFreeClientMap(desc, XkbGBN_AllComponentsMask, True);
    } else {
        logger(LOG_LEVEL_ERROR, "%s [%u]: XkbGetKeyboard failed to locate a valid keyboard!\\n",
                __FUNCTION__, __LINE__);
    }`

const patched = `    // Scalpel patch: XkbGetKeyboard with XkbGBN_AllComponentsMask also pulls
    // keyboard geometry, which modern X.Org and XWayland can refuse. We only
    // need the keycodes atom name, so fetch just the key names.
    XkbDescPtr desc = XkbAllocKeyboard();
    if (desc != NULL) {
        XkbGetNames(helper_disp, XkbKeycodesNameMask, desc);
        if (desc->names != NULL && desc->names->keycodes != None) {
            const char *layout_name = XGetAtomName(helper_disp, desc->names->keycodes);
            logger(LOG_LEVEL_DEBUG, "%s [%u]: Found keycode atom '%s' (%i)!\\n",
                    __FUNCTION__, __LINE__, layout_name, (unsigned int) desc->names->keycodes);

            const char *prefix_xfree86 = "xfree86_";
            #ifdef USE_EVDEV
            const char *prefix_evdev = "evdev";
            if (strncmp(layout_name, prefix_evdev, strlen(prefix_evdev)) == 0) {
                is_evdev = true;
            } else
            #endif
            if (strncmp(layout_name, prefix_xfree86, strlen(prefix_xfree86)) != 0) {
                logger(LOG_LEVEL_ERROR, "%s [%u]: Unknown keycode name '%s', please file a bug report!\\n",
                        __FUNCTION__, __LINE__, layout_name);
            } else if (layout_name == NULL) {
                logger(LOG_LEVEL_ERROR, "%s [%u]: X atom name failure for desc->names->keycodes!\\n",
                        __FUNCTION__, __LINE__);
            }

            XkbFreeNames(desc, XkbKeycodesNameMask, True);
        } else {
            logger(LOG_LEVEL_ERROR, "%s [%u]: XkbGetNames failed to locate a valid keyboard!\\n",
                    __FUNCTION__, __LINE__);
        }

        XkbFreeKeyboard(desc, 0, True);
    } else {
        logger(LOG_LEVEL_ERROR, "%s [%u]: XkbAllocKeyboard failed to allocate keyboard!\\n",
                __FUNCTION__, __LINE__);
    }`

if (process.platform !== 'linux') {
  console.info('uiohook Linux patch skipped on non-Linux platform.')
  process.exit(0)
}

let source = fs.readFileSync(inputHelperPath, 'utf8')
if (!source.includes('Scalpel patch: XkbGetKeyboard')) {
  if (!source.includes(original)) {
    throw new Error('Could not find the expected uiohook XKB block to patch.')
  }

  source = source.replace(original, patched)
  fs.writeFileSync(inputHelperPath, source)
  console.info('Applied uiohook Linux XKB patch.')
} else {
  console.info('uiohook Linux XKB patch already applied.')
}

fs.rmSync(path.join(root, 'node_modules/uiohook-napi/prebuilds'), {
  recursive: true,
  force: true
})

const flag = '-Wno-error=incompatible-pointer-types'
const env = {
  ...process.env,
  CFLAGS: process.env.CFLAGS ? `${process.env.CFLAGS} ${flag}` : flag,
  CXXFLAGS: process.env.CXXFLAGS ? `${process.env.CXXFLAGS} ${flag}` : flag
}

const result = child_process.spawnSync(
  'electron-rebuild',
  ['-f', '-o', 'uiohook-napi'],
  {
    stdio: 'inherit',
    shell: true,
    env
  }
)

process.exit(result.status ?? 1)
