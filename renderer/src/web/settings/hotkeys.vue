<template>
  <div class="max-w-md p-2">
    <div class="mb-2 bg-gray-700 rounded px-2 py-1 leading-none">
      <i class="fas fa-info-circle"></i> {{ t("settings.clear_hotkey") }}
    </div>
    <div
      v-if="linuxFixedHotkeys"
      class="mb-2 bg-gray-700 rounded px-2 py-1 leading-none text-gray-300"
    >
      Linux Wayland hotkeys are fixed: Ctrl+D, Ctrl+Alt+P, F5, F9.
    </div>
    <div class="flex flex-col gap-4 mb-8">
      <HotkeysGeneric :hotkeys="hotkeys" />
    </div>
    <div class="mb-8 flex">
      <label class="flex-1">{{ t("settings.stash_scroll") }}</label>
      <div class="flex gap-x-4">
        <ui-radio v-model="stashScroll" :value="true" class="font-poe"
          >Ctrl + MouseWheel</ui-radio
        >
        <ui-radio v-model="stashScroll" :value="false">{{
          t("Disabled")
        }}</ui-radio>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: "settings.hotkeys",
};
</script>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  configProp,
  configModelValue,
  _configModelValue,
  findWidget,
} from "./utils";
import { PriceCheckWidget, DelveGridWidget } from "@/web/overlay/interfaces";
import { ItemCheckWidget } from "../item-check/widget.js";

import UiRadio from "@/web/ui/UiRadio.vue";
import HotkeysGeneric, { HotkeySchema } from "../settings/HotkeysGeneric.vue";

const props = defineProps(configProp());
const linuxFixedHotkeys =
  navigator.userAgent.includes("Electron") &&
  navigator.platform.toLowerCase().includes("linux");

const hotkeys = computed<HotkeySchema[]>(() => {
  const priceCheckWidget = findWidget<PriceCheckWidget>(
    "price-check",
    props.config,
  )!;
  const itemCheckWidget = findWidget<ItemCheckWidget>(
    "item-check",
    props.config,
  )!;
  const delveGridWidget = findWidget<DelveGridWidget>(
    "delve-grid",
    props.config,
  )!;
  return [
    {
      translationKey: "price_check.name",
      items: [
        {
          translationKey: "price_check.hotkey",
          disabled: linuxFixedHotkeys,
          config: {
            modKey: _configModelValue(priceCheckWidget, "hotkeyHold"),
            nonModKey: _configModelValue(priceCheckWidget, "hotkey"),
          },
        },
        {
          translationKey: "price_check.hotkey_locked",
          config: _configModelValue(priceCheckWidget, "hotkeyLocked"),
          disabled: linuxFixedHotkeys,
        },
      ],
    },
    {
      translationKey: "settings.overlay",
      config: _configModelValue(props.config, "overlayKey"),
      required: true,
      disabled: linuxFixedHotkeys,
    },
    {
      translationKey: "map_check.name",
      config: _configModelValue(itemCheckWidget, "hotkey"),
    },
    {
      translationKey: "item.info",
      config: _configModelValue(itemCheckWidget, "hotkey"),
    },
    {
      translationKey: "settings.delve_grid",
      config: _configModelValue(delveGridWidget, "toggleKey"),
    },
  ];
});

const stashScroll = configModelValue(() => props.config, "stashScroll");

const { t } = useI18n();
</script>
