<!--
  LayersExportTab.vue - 多图层批量导出 Tab
  选中多个图层 → 每个图层导出为独立图片，统一画布尺寸和对齐方式
  参考 BatchExportTab 布局风格
-->
<template>
  <div class="layers-export-tab">
    <!-- 可折叠卡片 1: 选中图层列表 -->
    <SectionCollapsible sectionKey="layers-list" title="选中图层" :defaultExpanded="true">
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
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in displayedLayers" :key="l.layerId">
              <td class="col-num">{{ i + 1 }}</td>
              <td class="col-name">{{ l.layerName }}</td>
              <td class="col-type">{{ l.kindName }}</td>
              <td class="col-size">{{ l.width }} × {{ l.height }} px</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      <div v-else-if="detectError" class="empty-state">{{ detectError }}</div>
      <div v-else class="empty-state">在 PS 中选中多个图层后自动检测</div>
    </SectionCollapsible>

    <!-- 可折叠卡片 2: 导出配置 -->
    <SectionCollapsible sectionKey="layers-config" title="导出配置" :defaultExpanded="true">
      <div class="row">
        <label>文件名前缀</label>
        <input type="text" v-model="prefix" placeholder="list_" />
      </div>
      <div class="row">
        <label>起始序号</label>
        <input type="number" v-model.number="startIndex" min="0" class="input-narrow" />
      </div>
      <div class="preview-hint" v-if="prefix || selectedLayers.length">
        → {{ filenamePreview }}
      </div>
      <div class="filename-hint">文件名中的非法字符将自动替换为下划线</div>

      <div class="section-divider"></div>

      <!-- 画布设置 -->
      <div class="mode-switch">
        <button :class="['mode-btn', { active: sizeMode === 'auto' }]" @click="sizeMode = 'auto'">自动检测</button>
        <button :class="['mode-btn', { active: sizeMode === 'manual' }]" @click="sizeMode = 'manual'">手动输入</button>
      </div>

      <div v-if="sizeMode === 'auto'" class="canvas-size-table">
        <div class="canvas-size-row canvas-size-header">
          <span class="cs-col-label"></span><span class="cs-col-detect">检测值</span><span class="cs-col-pad">边距</span><span class="cs-col-result">最终尺寸</span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">宽度</span>
          <span class="cs-col-detect">{{ detectedMaxW > 0 ? detectedMaxW : '--' }} px</span>
          <span class="cs-col-pad"><input type="number" v-model="paddingW" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
          <span class="cs-col-result">{{ detectedMaxW > 0 ? detectedMaxW + paddingW + alignPadLeft + alignPadRight : '--' }} px</span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">高度</span>
          <span class="cs-col-detect">{{ detectedMaxH > 0 ? detectedMaxH : '--' }} px</span>
          <span class="cs-col-pad"><input type="number" v-model="paddingH" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
          <span class="cs-col-result">{{ detectedMaxH > 0 ? detectedMaxH + paddingH + alignPadTop + alignPadBottom : '--' }} px</span>
        </div>
      </div>
      <div v-else class="canvas-size-table">
        <div class="canvas-size-row">
          <span class="cs-col-label">宽度</span>
          <span class="cs-col-manual"><input type="number" v-model="exportWidth" min="1" placeholder="100" class="cs-input" /><span class="cs-unit">px</span></span>
          <span class="cs-col-label">高度</span>
          <span class="cs-col-manual"><input type="number" v-model="exportHeight" min="1" placeholder="100" class="cs-input" /><span class="cs-unit">px</span></span>
        </div>
      </div>

      <div class="canvas-bottom-row">
        <div class="anchor-wrap">
          <span class="anchor-label">对齐</span>
          <AnchorGrid v-model="anchor" />
        </div>
        <button v-if="sizeMode === 'auto'" class="btn btn-sm" @click="detectSize" :disabled="selectedLayers.length === 0 || isMeasuring">
          {{ isMeasuring ? '检测中...' : '检测尺寸' }}
        </button>
      </div>

      <!-- 对齐边距 -->
      <div class="canvas-size-table align-pad-table">
        <div class="canvas-size-row canvas-size-header">
          <span class="cs-col-label">方向</span><span class="cs-col-pad">对齐边距</span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">上</span>
          <span class="cs-col-pad"><input type="number" v-model="alignPadTop" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">右</span>
          <span class="cs-col-pad"><input type="number" v-model="alignPadRight" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">下</span>
          <span class="cs-col-pad"><input type="number" v-model="alignPadBottom" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">左</span>
          <span class="cs-col-pad"><input type="number" v-model="alignPadLeft" min="0" class="cs-input" /><span class="cs-unit">px</span></span>
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

    <!-- 可折叠卡片 3: 导出结果 -->
    <SectionCollapsible sectionKey="layers-result" title="导出结果" :defaultExpanded="false">
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
          <div class="result-row"><span class="result-label">最大尺寸</span><span class="result-value">{{ exportResult.data.maxWidth }} × {{ exportResult.data.maxHeight }} px</span></div>
          <div class="result-row"><span class="result-label">最终画布</span><span class="result-value">{{ finalCanvasW }} × {{ finalCanvasH }} px</span></div>
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
import AnchorGrid from "./AnchorGrid.vue";
import { outputDir, getSetting, setSetting } from "../composables/settings";
import { sanitizeFilename } from "../composables/filenameUtils";
import type { AnchorType, ExportFormat, SizeMode, LayerInfo, BatchExportLayersConfig, BatchExportLayersResult } from "../types";

const showToast = inject<(msg: string, isError?: boolean) => void>("showToast", function () {});

const selectedLayers = ref<LayerInfo[]>([]);
const detectError = ref("");
const prefix = ref("");
const startIndex = ref(0);
const sizeMode = ref<SizeMode>("auto");
const paddingW = ref(getSetting("layersPaddingW", 10));
const paddingH = ref(getSetting("layersPaddingH", 10));
const alignPadTop = ref(getSetting("layersAlignPadT", 0));
const alignPadRight = ref(getSetting("layersAlignPadR", 0));
const alignPadBottom = ref(getSetting("layersAlignPadB", 0));
const alignPadLeft = ref(getSetting("layersAlignPadL", 0));
const exportWidth = ref(100);
const exportHeight = ref(100);
const anchor = ref<AnchorType>("middle-center");
const format = ref<ExportFormat>("png");
const reversed = ref(getSetting("layersReversed", false));
const tableRows = ref(getSetting("layersTableRows", 8));
const isExporting = ref(false);
const isMeasuring = ref(false);
const detectedMaxW = ref(0);
const detectedMaxH = ref(0);
const exportResult = ref<{ success: boolean; data?: BatchExportLayersResult; error?: string } | null>(null);

const POLL_INTERVAL = 1000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;

// 排序后的图层列表
const displayedLayers = computed(() => {
  if (!reversed.value) return selectedLayers.value;
  return [...selectedLayers.value].reverse();
});

// 文件名预览（sanitize prefix）
const filenamePreview = computed(() => {
  if (selectedLayers.value.length === 0) return "-";
  var safePrefix = sanitizeFilename(prefix.value);
  var total = selectedLayers.value.length;
  var lastNum = startIndex.value + total - 1;
  var padLen = String(lastNum).length;
  var first = String(startIndex.value).padStart(padLen, "0");
  var last = String(lastNum).padStart(padLen, "0");
  var ext = format.value === "png" ? ".png" : ".jpg";
  return safePrefix + first + ext + ", ... " + safePrefix + last + ext;
});

// 最终画布尺寸
const finalCanvasW = computed(() => {
  if (sizeMode.value === "auto") return detectedMaxW.value > 0 ? detectedMaxW.value + paddingW.value + alignPadLeft.value + alignPadRight.value : 0;
  return exportWidth.value;
});
const finalCanvasH = computed(() => {
  if (sizeMode.value === "auto") return detectedMaxH.value > 0 ? detectedMaxH.value + paddingH.value + alignPadTop.value + alignPadBottom.value : 0;
  return exportHeight.value;
});

// 轮询检测选中图层
async function detectLayers() {
  var result = await psBridge.getSelectedLayersInfo();
  if (result.success && result.data) {
    detectError.value = "";
    selectedLayers.value = result.data.layers;
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

// 检测尺寸
async function detectSize() {
  if (selectedLayers.value.length === 0) return;
  isMeasuring.value = true;
  try {
    var result = await psBridge.measureLayers();
    if (result.success && result.data) {
      detectedMaxW.value = result.data.maxWidth;
      detectedMaxH.value = result.data.maxHeight;
      showToast("检测完成 " + result.data.maxWidth + "×" + result.data.maxHeight + " px");
    } else {
      showToast(result.error || "检测失败", true);
    }
  } catch (e) {
    showToast("检测失败: " + String(e), true);
  } finally {
    isMeasuring.value = false;
  }
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
  if (sizeMode.value === "manual" && (exportWidth.value <= 0 || exportHeight.value <= 0)) {
    showToast("请输入有效的画布尺寸", true); return;
  }

  isExporting.value = true;
  try {
    var config: BatchExportLayersConfig = {
      prefix: sanitizeFilename(prefix.value),
      startIndex: startIndex.value,
      format: format.value,
      sizeMode: sizeMode.value,
      exportWidth: exportWidth.value,
      exportHeight: exportHeight.value,
      paddingW: paddingW.value,
      paddingH: paddingH.value,
      paddingTop: alignPadTop.value,
      paddingRight: alignPadRight.value,
      paddingBottom: alignPadBottom.value,
      paddingLeft: alignPadLeft.value,
      anchor: anchor.value,
      outputDir: outputDir.value,
      reversed: reversed.value,
    };
    var result = await psBridge.batchExportLayers(config);
    if (result.success && result.data) {
      detectedMaxW.value = result.data.maxWidth;
      detectedMaxH.value = result.data.maxHeight;
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

watch(tableRows, (val) => { setSetting("layersTableRows", val); });
watch(reversed, (val) => { setSetting("layersReversed", val); });
watch(paddingW, (val) => { setSetting("layersPaddingW", val); });
watch(paddingH, (val) => { setSetting("layersPaddingH", val); });
watch(alignPadTop, (val) => { setSetting("layersAlignPadT", val); });
watch(alignPadRight, (val) => { setSetting("layersAlignPadR", val); });
watch(alignPadBottom, (val) => { setSetting("layersAlignPadB", val); });
watch(alignPadLeft, (val) => { setSetting("layersAlignPadL", val); });

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.layers-export-tab > * + * { margin-top: 10px; }

/* 图层列表 */
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

.preview-hint {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-muted);
  font-family: Consolas, Monaco, monospace;
}

.filename-hint {
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-muted);
}

.input-narrow { width: 80px; background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font-size: 11px; }
.input-narrow:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(58,141,255,0.25); }

.mode-switch { display: flex; margin-bottom: 10px; }
.mode-switch > * + * { margin-left: 4px; }
.mode-btn { flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); color: var(--text-muted); font-size: 11px; cursor: pointer; transition: all 0.15s ease; }
.mode-btn:hover { color: var(--text-secondary); }
.mode-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }

.section-divider { height: 1px; background: var(--border); margin: 12px 0; }

.canvas-size-table { background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-top: 8px; margin-bottom: 10px; }
.canvas-size-row { display: flex; align-items: center; padding: 8px 10px; font-size: 11px; }
.canvas-size-row + .canvas-size-row { border-top: 1px solid var(--border); }
.canvas-size-header { padding: 5px 10px; font-size: 10px; color: var(--text-muted); background: rgba(0,0,0,0.15); }
.cs-col-label { width: 32px; color: var(--text-secondary); flex-shrink: 0; }
.cs-col-detect { width: 48px; color: var(--text-muted); text-align: center; flex-shrink: 0; }
.cs-col-pad { display: flex; align-items: center; margin-left: 12px; margin-right: 12px; }
.cs-col-manual { display: flex; align-items: center; flex: 1; }
.cs-input { width: 44px; background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; padding: 4px 6px; font-size: 11px; text-align: center; }
.cs-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px rgba(58,141,255,0.25); }
.cs-unit { color: var(--text-muted); font-size: 10px; margin-left: 4px; }
.canvas-bottom-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
.anchor-wrap { display: flex; align-items: center; }
.anchor-label { font-size: 11px; color: var(--text-secondary); margin-right: 8px; }
.cs-col-result { color: var(--primary); font-weight: 600; text-align: right; flex: 1; }
.dir-row { display: flex; align-items: center; }
.dir-row > * + * { margin-left: 6px; }
.dir-input { flex: 1; }

.export-actions { display: flex; align-items: center; justify-content: flex-end; margin-top: 12px; }
.export-actions > * + * { margin-left: 10px; }
.export-progress { display: flex; align-items: center; font-size: 11px; color: var(--text-muted); }
.progress-icon { font-size: 11px; margin-right: 4px; }
.progress-text { font-size: 11px; }

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

.align-pad-table { margin-top: 10px; }
</style>
