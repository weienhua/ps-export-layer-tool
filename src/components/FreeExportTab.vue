<!--
  FreeExportTab.vue - 自由导出 Tab
  选中多个图层 → 每个图层保留原始尺寸，各自导出为独立图片
  单 workDoc 复用 + 四方向边距
-->
<template>
  <div class="free-export-tab">
    <!-- 可折叠卡片 1: 导出配置 -->
    <SectionCollapsible sectionKey="free-config" title="导出配置" :defaultExpanded="true">
      <!-- 图层表格 -->
      <div v-if="selectedLayers.length > 0">
        <div class="layers-toolbar">
          <span class="layers-count">共 {{ selectedLayers.length }} 个图层</span>
          <div class="layers-toolbar-actions">
            <span class="rows-label">行数</span>
            <input type="number" v-model="tableRows" min="2" max="30" class="rows-input" title="表格行数" />
            <button class="btn btn-sm" @click="reversed = !reversed">
              {{ reversed ? '倒序 ↑' : '正序 ↓' }}
            </button>
          </div>
        </div>
        <div class="layers-table-wrap" :style="{ maxHeight: tableRows * 32 + 'px' }">
        <table class="layers-table">
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-name">图层名</th>
              <th class="col-type">类型</th>
              <th class="col-size">尺寸</th>
              <th class="col-filename">导出文件名</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(l, i) in displayedLayers"
              :key="l.layerId"
              :class="{ 'row-duplicate': duplicateNames.has(getEffectiveFileName(l)) }"
            >
              <td class="col-num">{{ i + 1 }}</td>
              <td class="col-name">{{ l.layerName }}</td>
              <td class="col-type">{{ l.kindName }}</td>
              <td class="col-size">{{ l.width }} × {{ l.height }} px</td>
              <td class="col-filename">
                <input
                  type="text"
                  v-model="l.exportFileName"
                  class="filename-input"
                  :class="{ 'input-duplicate': duplicateNames.has(getEffectiveFileName(l)) }"
                  :title="l.exportFileName"
                />
              </td>
            </tr>
          </tbody>
        </table>
        </div>
        <!-- 命名冲突警告 -->
        <div v-if="duplicateNames.size > 0" class="conflict-warn">
          ⚠ 检测到文件名重复（{{ duplicateNames.size }} 个），导出时将自动追加序号
        </div>
      </div>
      <div v-else-if="detectError" class="empty-state">{{ detectError }}</div>
      <div v-else class="empty-state">在 PS 中选中多个图层后自动检测</div>

      <div class="section-divider"></div>

      <!-- 四方向边距 -->
      <div class="canvas-size-table">
        <div class="canvas-size-row canvas-size-header">
          <span class="cs-col-label">方向</span><span class="cs-col-pad">边距</span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">上</span>
          <span class="cs-col-pad"><input type="number" v-model="paddingTop" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">右</span>
          <span class="cs-col-pad"><input type="number" v-model="paddingRight" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">下</span>
          <span class="cs-col-pad"><input type="number" v-model="paddingBottom" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">左</span>
          <span class="cs-col-pad"><input type="number" v-model="paddingLeft" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
        </div>
      </div>

      <div class="section-divider"></div>

      <div class="row">
        <label>导出格式</label>
        <div class="mode-switch">
          <button :class="['mode-btn', { active: format === 'png' }]" @click="format = 'png'">PNG</button>
          <button :class="['mode-btn', { active: format === 'jpg' }]" @click="format = 'jpg'">JPG</button>
        </div>
      </div>
      <div class="row">
        <label>导出目录</label>
        <div class="dir-row">
          <input type="text" :value="outputDir" readonly placeholder="请选择导出目录" class="dir-input" />
          <button class="btn btn-sm" @click="selectFolder" :disabled="isExporting">选择...</button>
        </div>
      </div>

      <div class="filename-hint">文件名中的非法字符将自动替换为下划线</div>

      <div class="export-actions">
        <div class="export-progress" v-if="isExporting">
          <span class="progress-icon">⏳</span>
          <span class="progress-text">正在导出，请稍候...</span>
        </div>
        <button class="btn btn-primary" @click="startExport" :disabled="isExporting || selectedLayers.length === 0">
          {{ isExporting ? '导出中...' : '开始导出' }}
        </button>
      </div>
    </SectionCollapsible>

    <!-- 可折叠卡片 2: 导出结果 -->
    <SectionCollapsible sectionKey="free-result" title="导出结果" :defaultExpanded="false">
      <div class="result-display">
        <div v-if="exportResult && exportResult.success" class="result-status success">
          <span class="result-icon">✓</span><span>导出完成</span>
        </div>
        <div v-else-if="exportResult && !exportResult.success" class="result-status error">
          <span class="result-icon">✗</span><span>导出失败</span>
        </div>
        <div v-else class="empty-state">暂无导出记录</div>

        <div v-if="exportResult && exportResult.success" class="result-detail">
          <div class="result-row"><span class="result-label">文件数</span><span class="result-value">{{ exportResult.data.total }}</span></div>
          <div class="result-row"><span class="result-label">输出目录</span><span class="result-value result-path">{{ exportResult.data.outputDir }}</span></div>
        </div>
        <div v-else-if="exportResult && !exportResult.success" class="result-detail">
          <div class="result-row result-error-msg">{{ exportResult.error }}</div>
        </div>
      </div>
    </SectionCollapsible>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, inject } from "vue";
import { psBridge } from "../bridge";
import SectionCollapsible from "./SectionCollapsible.vue";
import { outputDir, getSetting, setSetting } from "../composables/settings";
import { sanitizeFilename } from "../composables/filenameUtils";
import type { ExportFormat, FreeExportLayerInfo, FreeExportConfig, FreeExportResult } from "../types";

const showToast = inject<(msg: string, isError?: boolean) => void>("showToast", function () {});

const selectedLayers = ref<FreeExportLayerInfo[]>([]);
const detectError = ref("");
const format = ref<ExportFormat>("png");
const reversed = ref(getSetting("freeReversed", false));
const tableRows = ref(getSetting("freeTableRows", 8));
const paddingTop = ref(getSetting("freePaddingTop", 2));
const paddingRight = ref(getSetting("freePaddingRight", 2));
const paddingBottom = ref(getSetting("freePaddingBottom", 2));
const paddingLeft = ref(getSetting("freePaddingLeft", 2));
const isExporting = ref(false);
const exportResult = ref<{ success: boolean; data?: FreeExportResult; error?: string } | null>(null);

const POLL_INTERVAL = 1000;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let polling = false;

// 排序后的图层列表
const displayedLayers = computed(() => {
  if (!reversed.value) return selectedLayers.value;
  return [...selectedLayers.value].reverse();
});

/**
 * 获取有效文件名（空值 fallback 到图层名）
 */
function getEffectiveFileName(layer: FreeExportLayerInfo): string {
  return layer.exportFileName.trim() || layer.layerName;
}

/**
 * 检测重复文件名
 */
const duplicateNames = computed(() => {
  var names = selectedLayers.value.map(function (l) { return getEffectiveFileName(l); });
  var seen = new Set<string>();
  var dupes = new Set<string>();
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    if (seen.has(n)) {
      dupes.add(n);
    } else {
      seen.add(n);
    }
  }
  return dupes;
});

// 轮询检测选中图层
async function detectLayers() {
  var result = await psBridge.getSelectedLayersInfo();
  if (result.success && result.data) {
    detectError.value = "";
    // 合并：保留用户已编辑的文件名
    var oldMap = new Map<number, string>();
    for (var i = 0; i < selectedLayers.value.length; i++) {
      var oldLayer = selectedLayers.value[i];
      // 仅当用户修改过文件名时才保留（与图层名不同）
      if (oldLayer.exportFileName !== oldLayer.layerName) {
        oldMap.set(oldLayer.layerId, oldLayer.exportFileName);
      }
    }

    var newLayers: FreeExportLayerInfo[] = [];
    for (var j = 0; j < result.data.layers.length; j++) {
      var l = result.data.layers[j];
      var fileName = oldMap.get(l.layerId);
      if (!fileName) {
        fileName = l.layerName;
      }
      newLayers.push({
        layerId: l.layerId,
        layerName: l.layerName,
        kind: l.kind,
        kindName: l.kindName,
        width: l.width,
        height: l.height,
        exportFileName: fileName,
      });
    }
    selectedLayers.value = newLayers;

    if (!polling) startPolling();
  } else if (result.noDocument) {
    detectError.value = "未打开文档";
    selectedLayers.value = [];
  } else if (result.error) {
    detectError.value = result.error;
    selectedLayers.value = [];
  }
}

function startPolling() {
  if (polling) return;
  polling = true;
  pollLoop();
}

async function pollLoop() {
  if (!polling) return;
  if (!isExporting.value) {
    await detectLayers();
  }
  pollTimer = setTimeout(pollLoop, POLL_INTERVAL);
}

function stopPolling() {
  polling = false;
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

// 设置默认导出目录
async function setDefaultOutputDir() {
  if (outputDir.value) return;
  var result = await psBridge.getDocumentPath();
  if (result.success && result.data && result.data.path) {
    var psdPath = result.data.path;
    var lastSep = Math.max(psdPath.lastIndexOf("/"), psdPath.lastIndexOf("\\"));
    outputDir.value = (lastSep >= 0 ? psdPath.substring(0, lastSep) : psdPath) + "/output";
  }
}

// 选择文件夹
async function selectFolder() {
  var result = await psBridge.selectFolder();
  if (result.success && result.data) { outputDir.value = result.data.path; }
  else if (result.error) { showToast(result.error, true); }
}

// 开始导出
async function startExport() {
  if (isExporting.value) return;
  if (selectedLayers.value.length === 0) { showToast("请先在 PS 中选中多个图层", true); return; }
  if (!outputDir.value.trim()) { showToast("请选择导出目录", true); return; }

  doExport();
}

async function doExport() {
  isExporting.value = true;
  try {
    // 构建 layers 配置，面板侧完成 sanitize + 冲突序号追加
    var usedNames: Record<string, number> = {};
    var configLayers: Array<{ layerId: number; exportFileName: string }> = [];
    for (var i = 0; i < selectedLayers.value.length; i++) {
      var l = selectedLayers.value[i];
      var raw = getEffectiveFileName(l);
      var safe = sanitizeFilename(raw);
      if (safe === "") { safe = "layer"; }
      // 冲突检测与序号追加
      var finalName = safe;
      if (usedNames.hasOwnProperty(safe)) {
        usedNames[safe] = usedNames[safe] + 1;
        finalName = safe + "_" + usedNames[safe];
      } else {
        usedNames[safe] = 0;
      }
      configLayers.push({ layerId: l.layerId, exportFileName: finalName });
    }
    var config: FreeExportConfig = {
      layers: configLayers,
      format: format.value,
      paddingTop: paddingTop.value,
      paddingRight: paddingRight.value,
      paddingBottom: paddingBottom.value,
      paddingLeft: paddingLeft.value,
      outputDir: outputDir.value,
      reversed: reversed.value,
    };
    var result = await psBridge.freeExport(config);
    if (result.success && result.data) {
      exportResult.value = { success: true, data: result.data };
      showToast("导出完成！共 " + result.data.total + " 个文件");
    } else {
      exportResult.value = { success: false, error: result.error || "导出失败" };
      showToast(result.error || "导出失败", true);
    }
  } catch (e) {
    exportResult.value = { success: false, error: String(e) };
    showToast("导出失败: " + String(e), true);
  } finally {
    isExporting.value = false;
  }
}

onMounted(async () => {
  await detectLayers();
  await setDefaultOutputDir();
});

watch(tableRows, function (val) { setSetting("freeTableRows", val); });
watch(reversed, function (val) { setSetting("freeReversed", val); });
watch(paddingTop, function (val) { setSetting("freePaddingTop", val); });
watch(paddingRight, function (val) { setSetting("freePaddingRight", val); });
watch(paddingBottom, function (val) { setSetting("freePaddingBottom", val); });
watch(paddingLeft, function (val) { setSetting("freePaddingLeft", val); });

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.free-export-tab > * + * { margin-top: 10px; }

/* 图层表格 */
.layers-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.layers-count {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.layers-toolbar-actions {
  display: flex;
  align-items: center;
}

.layers-toolbar-actions > * + * { margin-left: 6px; }

.rows-label { font-size: 11px; color: var(--text-muted); }

.rows-input {
  width: 36px;
  padding: 2px 4px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-main);
  font-size: 11px;
  text-align: center;
}

.rows-input:focus { outline: none; border-color: var(--primary); }

.layers-table-wrap {
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.layers-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.layers-table th {
  position: sticky;
  top: 0;
  background: var(--bg-secondary, #2a2a2a);
  color: var(--text-muted);
  font-weight: 500;
  padding: 4px 6px;
  border-bottom: 1px solid var(--border);
  z-index: 1;
}

.layers-table td {
  padding: 2px 6px;
  border-bottom: 1px solid var(--border-hairline, #3a3a3a);
}

.col-num { width: 28px; text-align: center; color: var(--text-muted); font-size: 10px; }
.col-name { }
.col-type { width: 72px; color: var(--text-muted); font-size: 11px; }
.col-size { width: 96px; color: var(--text-secondary); font-size: 11px; text-align: right; padding-right: 8px !important; }
.col-filename { }

/* 文件名输入框 */
.filename-input {
  width: 100%;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-main);
  font-size: 11px;
  box-sizing: border-box;
}

.filename-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(58,141,255,0.25);
}

/* 重复行高亮 */
.row-duplicate .filename-input,
.input-duplicate {
  border-color: var(--error, #e74c3c);
  background: rgba(231, 76, 60, 0.08);
}

/* 命名冲突警告 */
.conflict-warn {
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 4px;
  font-size: 11px;
  color: var(--error, #e74c3c);
}

/* 文件名规则提示 */
.filename-hint {
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-muted);
}

/* 边距表格（与 tab1 canvas-size-table 一致） */
.canvas-size-table { background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-top: 8px; margin-bottom: 10px; }
.canvas-size-row { display: flex; align-items: center; padding: 8px 10px; font-size: 11px; }
.canvas-size-row + .canvas-size-row { border-top: 1px solid var(--border); }
.canvas-size-header { padding: 5px 10px; font-size: 10px; color: var(--text-muted); background: rgba(0,0,0,0.15); }
.cs-col-label { width: 32px; color: var(--text-secondary); flex-shrink: 0; }
.cs-col-pad { display: flex; align-items: center; margin-left: 12px; margin-right: 12px; }
.cs-input { width: 44px; background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 11px; text-align: center; }
.cs-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(58,141,255,0.25); }
.cs-unit { color: var(--text-muted); font-size: 10px; margin-left: 4px; }

/* 通用配置 */
.section-divider { height: 1px; background: var(--border); margin: 12px 0; }

/* 格式切换和路径选择复用 tab1 的 scoped 样式 */
.mode-switch { display: flex; margin-bottom: 10px; }
.mode-switch > * + * { margin-left: 4px; }
.mode-btn { flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); color: var(--text-muted); font-size: 11px; cursor: pointer; transition: all 0.15s ease; }
.mode-btn:hover { color: var(--text-secondary); }
.mode-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

.dir-row { display: flex; align-items: center; }
.dir-row > * + * { margin-left: 6px; }
.dir-input { flex: 1; }

.export-actions { display: flex; align-items: center; justify-content: flex-end; margin-top: 12px; }
.export-actions > * + * { margin-left: 10px; }
.export-progress { display: flex; align-items: center; font-size: 11px; color: var(--text-muted); }
.progress-icon { font-size: 11px; margin-right: 4px; }
.progress-text { font-size: 11px; }

.empty-state {
  padding: 20px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

/* 导出结果 */
.result-display { background: var(--bg-input); border-radius: 6px; padding: 10px; }
.result-status { display: flex; align-items: center; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.result-status.success { color: var(--success); }
.result-status.error { color: var(--error); }
.result-status > * + * { margin-left: 6px; }
.result-icon { font-size: 14px; }
.result-detail > * + * { margin-top: 4px; }
.result-row { display: flex; font-size: 11px; }
.result-label { color: var(--text-muted); width: 56px; flex-shrink: 0; }
.result-value { color: var(--text-main); }
.result-path { word-break: break-all; font-size: 10px; font-family: Consolas, Monaco, monospace; }
.result-error-msg { color: var(--error); font-size: 11px; }

</style>
