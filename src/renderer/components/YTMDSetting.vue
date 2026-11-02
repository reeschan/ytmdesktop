<script setup lang="ts" generic="T extends 'checkbox' | 'file' | 'range' | 'select' | 'text' | 'custom'">
import { computed, ref } from "vue";

type ModelValue = {
  checkbox: boolean;
  file: string;
  range: number;
  custom: never;
  select: number;
  text: string;
};

const props = defineProps<{
  type: T;
  modelValue?: ModelValue[T];
  name: string;
  description?: string;
  restartRequired?: boolean;
  indented?: boolean;
  bindSetting?: string; // This is for the file picker so that it can properly set a data attribute that binds the setting correctly. TODO: Rewrite to not have this
  max?: number | string;
  min?: number | string;
  step?: number | string;
  disabled?: boolean;
  disabledMessage?: string;
  flexColumn?: boolean;
  beta?: boolean;
  optionsMap?: { [key: number]: string }; // This is for the select menu
  optionsOrder?: number[]; // This is for the select menu, defaults to the key order of optionsMap
  accept?: string; // This is for the file picker, defaults to ".css"
}>();
const emit = defineEmits(["update:modelValue", "file-change", "change", "clear"]);

const value = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit("update:modelValue", value);
  }
});

const hasDescription = computed(() => {
  return props.description && props.description.trim() !== "";
});

const fileInput = ref(null);

const selectOpen = ref(false);
const selectedOption = computed(() => {
  return props.optionsMap[props.modelValue as number];
});
const orderedOptionKeys = computed(() => {
  if (!props.optionsMap) return [] as number[];
  return props.optionsOrder ?? Object.keys(props.optionsMap).map(key => Number.parseInt(key));
});

// This function should be using ModelValue[T] but because it's bound to @click it doesn't interpret it as correct
function select(optionKey: number) {
  value.value = optionKey as ModelValue[T];
  selectOpen.value = false;
  emit("change");
}
</script>

<template>
  <div
    class="tw:border-ytmd-border"
    :class="{ 'ytmd-setting': true, 'indented': props.indented, 'flex-column': props.flexColumn }"
  >
    <p v-if="!disabled && !hasDescription">
      {{ name }} <span
        v-if="restartRequired"
        class="reload-required material-symbols-outlined"
      >autorenew</span>
      <span
        v-if="beta"
        class="beta-tag tw:bg-ytmd-accent"
        title="This is a beta feature and may not work correctly yet."
      >BETA</span>
    </p>
    <div
      v-else-if="!disabled && hasDescription"
      class="name-description"
    >
      <p class="name">
        {{ name }} <span
          v-if="restartRequired"
          class="reload-required material-symbols-outlined"
        >autorenew</span>
        <span
          v-if="beta"
          class="beta-tag tw:bg-ytmd-accent"
          title="This is a beta feature and may not work correctly yet."
        >BETA</span>
      </p>
      <p class="description tw:text-ytmd-text-muted">
        {{ description }}
      </p>
    </div>
    <div
      v-if="disabled"
      class="disabled-name-message"
    >
      <p class="name">
        <span class="disabled-tag tw:bg-ytmd-surface">DISABLED</span> {{ name }} <span
          v-if="restartRequired"
          class="reload-required material-symbols-outlined"
        >autorenew</span>
        <span
          v-if="beta"
          class="beta-tag tw:bg-ytmd-accent"
          title="This is a beta feature and may not work correctly yet."
        >BETA</span>
      </p>
      <p class="message tw:text-ytmd-text-muted">
        {{ disabledMessage }}
      </p>
    </div>

    <input
      v-if="type !== 'file' && type !== 'range' && type !== 'select' && type !== 'text' && type !== 'custom'"
      v-model="value"
      class="tw:bg-ytmd-surface tw:checked:bg-ytmd-accent tw:disabled:bg-ytmd-surface"
      :disabled="disabled"
      :type="props.type"
      @change="$emit('change', $event)"
    >
    <input
      v-if="type == 'text'"
      v-model="value"
      class="text-input tw:bg-ytmd-surface tw:text-ytmd-text tw:border-ytmd-border"
      :disabled="disabled"
      :aria-label="name"
      type="text"
      @input="$emit('change', $event)"
    >
    <div
      v-if="type == 'range'"
      class="range-selector"
    >
      <span class="range-value">{{ value }}</span>
      <input
        v-model="value"
        class="tw:bg-ytmd-surface"
        :disabled="disabled"
        :type="props.type"
        :max="props.max"
        :min="props.min"
        :step="props.step"
        @change="$emit('change', $event)"
      >
    </div>
    <div
      v-if="type == 'file'"
      class="file-picker tw:bg-ytmd-surface"
    >
      <input
        ref="fileInput"
        :disabled="disabled"
        type="file"
        :accept="props.accept ?? '.css'"
        :data-setting="bindSetting"
        @change="$emit('file-change', $event)"
      >
      <div class="file-input-button">
        <button
          class="choose tw:bg-ytmd-accent"
          @click="fileInput.click()"
        >
          <span class="material-symbols-outlined">file_open</span>
        </button>
        <input
          :disabled="disabled"
          type="text"
          readonly
          class="path tw:bg-transparent"
          placeholder="No file chosen"
          :value="value"
        >
        <button
          v-if="value"
          class="remove tw:bg-transparent"
          @click="$emit('clear')"
        >
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    </div>
    <div
      v-if="type == 'select'"
      class="tw:bg-ytmd-surface"
      :class="{ select: true, open: selectOpen }"
    >
      <div
        class="selected"
        @click="selectOpen = !selectOpen"
      >
        <p class="text">
          {{ selectedOption }}
        </p>
        <span
          v-if="!selectOpen"
          class="material-symbols-outlined"
        >arrow_drop_down</span>
        <span
          v-if="selectOpen"
          class="material-symbols-outlined"
        >arrow_drop_up</span>
      </div>
      <div class="options tw:bg-ytmd-surface">
        <div
          v-for="optionKey of orderedOptionKeys"
          :key="optionKey"
          class="option tw:hover:bg-ytmd-text/10"
          @click="select(optionKey)"
        >
          {{ props.optionsMap[optionKey] }}
        </div>
      </div>
    </div>

    <slot />
  </div>
</template>

<style scoped>
.ytmd-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ytmd-setting.indented {
  margin-left: 12px;
  padding-left: 12px;
  border-left-width: 1px;
  border-left-style: solid;
}

.ytmd-setting.flex-column {
  flex-direction: column;
  align-items: initial;
  justify-content: initial;
}

.ytmd-setting .beta-tag {
  border-radius: 4px;
  padding: 2px 4px;
}

.ytmd-setting .disabled-tag {
  border-radius: 4px;
  padding: 2px 4px;
}

.name-description .name,
.disabled-name-message .name {
  margin-bottom: unset;
}

.name-description .description,
.disabled-name-message .message {
  margin-top: 4px;
}

.reload-required {
  vertical-align: middle;
}

input[type="checkbox"] {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  min-width: 62px;
  min-height: 32px;
  width: 62px;
  height: 32px;
  display: inline-block;
  position: relative;
  border-radius: 50px;
  overflow: hidden;
  outline: none;
  border: none;
  cursor: pointer;
  transition: background-color ease 0.3s;
}

input[type="checkbox"]:before {
  content: "";
  display: block;
  position: absolute;
  z-index: 2;
  width: 28px;
  height: 28px;
  background: var(--ytmd-color-text);
  left: 2px;
  top: 2px;
  border-radius: 50%;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ytmd-color-background) 20%, transparent);
  transition: all ease 0.3s;
}

input[type="checkbox"]:checked:before {
  left: 32px;
}

input[type="checkbox"]:disabled {
  cursor: not-allowed;
}

input[type="checkbox"]:disabled::before {
  background-color: var(--ytmd-color-text-muted);
}

input[type="file"] {
  display: none;
}

.file-picker {
  border-radius: 4px;
}

.file-input-button {
  width: 216px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.file-input-button button {
  padding: 8px;
  border: none;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.file-input-button button.choose {
  border-radius: 4px 0 0 4px;
}

.file-input-button button.remove {
  border-left: 1px solid color-mix(in srgb, var(--ytmd-color-text) 10%, transparent);
  border-radius: 0 4px 4px 0;
}

.file-input-button button .material-symbols-outlined {
  margin-right: 4px;
  font-size: 18px;
}

.file-input-button input[type="text"] {
  margin: 0;
  padding: 8px;
  width: 100%;
  border: none;
}

.file-input-button input[type="text"]:focus,
.file-input-button input[type="text"]:active {
  outline: none;
}

.file-input-button p {
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-input {
  width: 216px;
  padding: 8px;
  border-radius: 4px;
  border-width: 1px;
  border-style: solid;
  outline: none;
}

.text-input:focus-visible {
  outline: 2px solid var(--ytmd-color-accent);
  outline-offset: 1px;
}

.range-value {
  vertical-align: top;
  margin-right: 8px;
}

input[type="range"] {
  appearance: none;
  height: 15px;
  border-radius: 4px;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--ytmd-color-accent);
  cursor: pointer;
}

.select {
  position: relative;
  width: 216px;
  border-radius: 4px;
}

.select.open {
  border-radius: 4px 4px 0 0;
}

.select .selected {
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.select .selected .text {
  margin: unset;
  padding: unset;
}

.select .options {
  overflow: hidden;
  position: absolute;
  left: 0;
  right: 0;
  z-index: 1;
  border-radius: 0 0 4px 4px;
  width: 100%;
}

.select .options .option {
  user-select: none;
  cursor: pointer;
  padding: 8px;
}

.select:not(.open) .options {
  display: none;
}
</style>
