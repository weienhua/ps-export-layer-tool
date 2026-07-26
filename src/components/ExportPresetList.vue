<!--
  ExportPresetList.vue - 导出预设卡片列表
  样式完全参考 ps-layer-tool UnifiedPresetList
-->
<template>
  <div :class="['preset-list-root', { 'no-preview': !previewEnabled }]">
    <!-- 预设卡片列表 -->
    <div class="preset-list">
      <div v-if="presets.length === 0" class="empty-state">暂无预设</div>
      <div
        v-for="preset in presets"
        :key="preset.id"
        :class="['preset-item', { dragging: dragId === preset.id }]"
        :data-id="preset.id"
        draggable="true"
        @click="$emit('apply', preset)"
        @mouseenter="onMouseEnter($event, preset.id)"
        @mouseleave="onMouseLeave(preset.id)"
        @dragstart="onDragStart($event, preset.id)"
        @dragend="onDragEnd"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <div class="preset-main">
          <div class="preset-main-left">
            <span class="preset-name">{{ preset.name }}</span>
          </div>
          <div class="preset-main-right">
            <button class="preset-delete" @click.stop="$emit('delete', preset.id)">×</button>
          </div>
        </div>
        <div class="preset-meta">
          <span class="item-count">{{ preset.items.length }} 项</span>
        </div>
        <div :class="['preset-preview', previewAlign[preset.id] || 'center']">
          <div class="preview-line">前缀: {{ preset.prefix || '(空)' }}</div>
          <div class="preview-line">格式: {{ preset.format === 'jpg' ? 'JPG' : 'PNG' }} | 对齐: {{ anchorLabel(preset.anchor) }} | 边距: {{ preset.paddingW }}×{{ preset.paddingH }}</div>
          <div class="preview-line preview-items">{{ preset.items.map(function(i) { return i.text; }).join('  ') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import type { ExportPreset } from "../types";

defineProps<{
  presets: ExportPreset[];
  previewEnabled: boolean;
}>();

const emit = defineEmits<{
  apply: [preset: ExportPreset];
  delete: [id: string];
  reorder: [fromId: string, toId: string];
}>();

var dragId = ref<string | null>(null);
var previewAlign = reactive<Record<string, string>>({});

function onMouseEnter(e: MouseEvent, id: string) {
  var card = (e.target as HTMLElement).closest(".preset-item") as HTMLElement;
  if (!card) return;
  var cardRect = card.getBoundingClientRect();
  var listEl = card.closest(".preset-list-root") as HTMLElement;
  var panelW = listEl ? listEl.getBoundingClientRect().width : window.innerWidth;
  var previewW = 380;
  var cardCenter = cardRect.left + cardRect.width / 2;
  var previewLeft = cardCenter - previewW / 2;
  if (previewLeft < 0) { previewAlign[id] = "left"; }
  else if (previewLeft + previewW > panelW) { previewAlign[id] = "right"; }
  else { previewAlign[id] = "center"; }
}
function onMouseLeave(id: string) {
  delete previewAlign[id];
}

function onDragStart(e: DragEvent, id: string) {
  dragId.value = id;
  (e.target as HTMLElement).classList.add("dragging");
}
function onDragEnd(e: DragEvent) {
  (e.target as HTMLElement).classList.remove("dragging");
  dragId.value = null;
}
function onDragOver(e: DragEvent) {
  var item = (e.target as HTMLElement).closest(".preset-item") as HTMLElement;
  if (item && item.dataset.id !== dragId.value) {
    item.classList.add("drag-over");
  }
}
function onDragLeave(e: DragEvent) {
  var item = (e.target as HTMLElement).closest(".preset-item") as HTMLElement;
  if (item) item.classList.remove("drag-over");
}
function onDrop(e: DragEvent) {
  var item = (e.target as HTMLElement).closest(".preset-item") as HTMLElement;
  if (!item) return;
  item.classList.remove("drag-over");
  var toId = item.dataset.id;
  if (dragId.value && toId && dragId.value !== toId) {
    emit("reorder", dragId.value, toId);
  }
}

function anchorLabel(a: string): string {
  var map: Record<string, string> = {
    "top-left": "↖", "top-center": "↑", "top-right": "↗",
    "middle-left": "←", "middle-center": "⊙", "middle-right": "→",
    "bottom-left": "↙", "bottom-center": "↓", "bottom-right": "↘",
  };
  return map[a] || a;
}

</script>

<style scoped>
.preset-list {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: -8px;
}

.preset-list > * {
  margin-right: 8px;
  margin-bottom: 8px;
}

.empty-state {
  width: 100%;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 16px 0;
}

.preset-item {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 140px;
  max-width: 200px;
  flex: 1 1 150px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.preset-item > * + * {
  margin-top: 6px;
}

.preset-item:hover {
  background: var(--bg-card-hover);
  border-color: var(--primary);
}

.preset-main {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 20px;
}

.preset-main-left {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.preset-main-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.preset-main-right > * + * {
  margin-left: 6px;
}

.preset-name {
  font-size: 12px;
  color: var(--text-main);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 20px;
}

.preset-delete {
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--error);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.preset-item.dragging { opacity: 0.5; border-color: var(--primary); }
.preset-item.drag-over { border-color: var(--primary); border-style: dashed; }

.preset-item:hover .preset-delete {
  opacity: 1;
}

.preset-meta {
  width: 100%;
  display: flex;
  align-items: center;
}

.item-count {
  font-size: 10px;
  color: var(--text-muted);
}

.preset-preview {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  z-index: 35;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border-strong);
  background: #171a20;
  color: #cfd4dd;
  font-size: 11px;
  font-family: Consolas, Monaco, monospace;
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
  max-height: 200px;
  max-width: 380px;
  min-width: 260px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  pointer-events: none;
}

.preview-line {
  line-height: 1.5;
}

.preview-items {
  color: var(--text-muted);
}

.preset-preview.left { left: 0; right: auto; transform: none; }
.preset-preview.center { left: 50%; right: auto; transform: translateX(-50%); }
.preset-preview.right { left: auto; right: 0; transform: none; }

.preset-item:hover .preset-preview {
  display: block;
}

.preset-list-root.no-preview .preset-item:hover .preset-preview {
  display: none;
}
</style>
