<!--
  AnchorGrid.vue - 3×3 锚点网格选择器 + 下拉框
  参考 ps-layer-tool 设计
-->
<template>
  <div class="anchor-row">
    <div class="anchor-grid-selector">
      <button
        v-for="a in anchors"
        :key="a.value"
        :class="['anchor-grid-cell', { 'is-active': modelValue === a.value }]"
        :title="a.label"
        :aria-label="a.label"
        :aria-pressed="modelValue === a.value"
        @click="$emit('update:modelValue', a.value)"
      />
    </div>
    <select :value="modelValue" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option v-for="a in anchors" :key="a.value" :value="a.value">{{ a.label }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import type { AnchorType } from "../types";

defineProps<{
  modelValue: AnchorType;
}>();

defineEmits<{
  (e: "update:modelValue", value: AnchorType): void;
}>();

const anchors: { value: AnchorType; label: string }[] = [
  { value: "top-left", label: "左上" },
  { value: "top-center", label: "上中" },
  { value: "top-right", label: "右上" },
  { value: "middle-left", label: "左中" },
  { value: "middle-center", label: "中心" },
  { value: "middle-right", label: "右中" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom-center", label: "下中" },
  { value: "bottom-right", label: "右下" },
];
</script>

<style scoped>
.anchor-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
}

.anchor-row > * + * {
  margin-left: 6px;
}

.anchor-grid-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-gap: 2px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-input);
  flex-shrink: 0;
  width: 58px;
}

.anchor-grid-cell {
  width: 14px;
  height: 14px;
  border: 1px solid var(--border-strong);
  background: #2a2f37;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  padding: 0;
}

.anchor-grid-cell:hover {
  border-color: var(--text-muted);
}

.anchor-grid-cell.is-active {
  border-color: var(--primary);
  background: var(--primary);
}
</style>
