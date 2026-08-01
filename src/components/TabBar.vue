<!--
  TabBar.vue - Tab 导航栏组件
  参考 ps-layer-tool 设计风格
-->
<template>
  <div class="tab-bar card">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :class="['tab-btn', { active: modelValue === tab.id }]"
      @click="$emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const tabs = [
  { id: "layers", label: "统一导出" },
  { id: "batch", label: "文字导出" },
  { id: "free", label: "自由导出" },
];
</script>

<style scoped>
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  padding: 3px;
  margin-bottom: 0;
}

.tab-bar > * + * {
  margin-left: 3px;
}

.tab-btn {
  flex: 1;
  min-width: 44px;
  min-height: 30px;
  padding: 4px 6px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--text-secondary);
  background: var(--bg-input);
}

.tab-btn.active {
  background: var(--primary);
  color: #fff;
}
</style>
