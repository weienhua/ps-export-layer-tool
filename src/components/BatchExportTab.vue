<!--
  BatchExportTab.vue - 批量导出 Tab
  选中文本图层 → 配置参数 → 一键导出每个字符为统一尺寸的 web 素材
-->
<template>
  <div class="batch-export-tab">
    <!-- 可折叠卡片 1: 批量导出配置 -->
    <SectionCollapsible sectionKey="batch-config" title="批量导出" :defaultExpanded="true">
      <!-- 源文本图层 -->
      <div v-if="fontInfo" class="font-info-display">
        <div class="font-info-row">
          <span class="font-info-label">字体</span>
          <span class="font-info-value">{{ fontInfo.fontName }} {{ fontInfo.fontStyle }}, {{ fontInfo.fontSize }}px</span>
        </div>
        <div class="font-info-row">
          <span class="font-info-label">颜色</span>
          <span class="font-info-value">
            <span class="color-swatch" :style="{ background: fontInfo.color }"></span>
            {{ fontInfo.color }}
          </span>
        </div>
        <div class="font-info-row">
          <span class="font-info-label">图层</span>
          <span class="font-info-value">{{ fontInfo.layerName }}</span>
          <span class="re-detect-btn"><button class="btn btn-sm" @click="detectTextLayer()" :disabled="isExporting">重新检测</button></span>
        </div>
      </div>
      <div v-else-if="detectError" class="empty-state">{{ detectError }}</div>
      <div v-else class="empty-state">选中 PS 文本图层后自动检测</div>

      <div class="section-divider"></div>

      <!-- 导出内容 -->
      <div class="row">
        <label>导出字符</label>
        <input type="text" v-model="characters" placeholder="0123456789:" />
      </div>
      <div class="row">
        <label>文件名前缀</label>
        <input type="text" v-model="prefix" placeholder="time_" />
      </div>
      <div class="preview-hint" v-if="prefix || characters">
        → {{ prefix || 'file_' }}{{ getFirstChar() || '0' }}{{ format === 'png' ? '.png' : '.jpg' }}, ... {{ prefix || 'file_' }}{{ getLastChar() || '9' }}{{ format === 'png' ? '.png' : '.jpg' }}
      </div>

      <div class="section-divider"></div>

      <!-- 画布设置 -->
      <div class="mode-switch">
        <button
          :class="['mode-btn', { active: sizeMode === 'auto' }]"
          @click="sizeMode = 'auto'"
        >自动检测</button>
        <button
          :class="['mode-btn', { active: sizeMode === 'manual' }]"
          @click="sizeMode = 'manual'"
        >手动输入</button>
      </div>

      <div v-if="sizeMode === 'auto'" class="canvas-size-table">
        <div class="canvas-size-row canvas-size-header">
          <span class="cs-col-label"></span>
          <span class="cs-col-detect">检测值</span>
          <span class="cs-col-pad">边距</span>
          <span class="cs-col-result">最终尺寸</span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">宽度</span>
          <span class="cs-col-detect">{{ detectedMaxW > 0 ? detectedMaxW : '--' }} px</span>
          <span class="cs-col-pad">
            <input type="number" v-model="paddingW" min="0" class="cs-input" />
            <span class="cs-unit">px</span>
          </span>
          <span class="cs-col-result">{{ detectedMaxW > 0 ? detectedMaxW + paddingW : '--' }} px</span>
        </div>
        <div class="canvas-size-row">
          <span class="cs-col-label">高度</span>
          <span class="cs-col-detect">{{ detectedMaxH > 0 ? detectedMaxH : '--' }} px</span>
          <span class="cs-col-pad">
            <input type="number" v-model="paddingH" min="0" class="cs-input" />
            <span class="cs-unit">px</span>
          </span>
          <span class="cs-col-result">{{ detectedMaxH > 0 ? detectedMaxH + paddingH : '--' }} px</span>
        </div>
      </div>
      <div v-else class="canvas-size-table">
        <div class="canvas-size-row">
          <span class="cs-col-label">宽度</span>
          <span class="cs-col-manual">
            <input type="number" v-model="exportWidth" min="1" placeholder="64" class="cs-input" />
            <span class="cs-unit">px</span>
          </span>
          <span class="cs-col-label">高度</span>
          <span class="cs-col-manual">
            <input type="number" v-model="exportHeight" min="1" placeholder="80" class="cs-input" />
            <span class="cs-unit">px</span>
          </span>
        </div>
      </div>

      <div class="canvas-bottom-row">
        <div class="anchor-wrap">
          <span class="anchor-label">对齐</span>
          <AnchorGrid v-model="anchor" />
        </div>
        <button v-if="sizeMode === 'auto'" class="btn btn-sm" @click="detectSize" :disabled="!fontInfo || isMeasuring">
          {{ isMeasuring ? '检测中...' : '检测尺寸' }}
        </button>
      </div>

      <div class="section-divider"></div>

      <!-- 导出设置 -->
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
        <button class="btn btn-primary" @click="startExport" :disabled="isExporting || !canExport">
          {{ isExporting ? '导出中...' : '开始导出' }}
        </button>
      </div>
    </SectionCollapsible>

    <!-- 可折叠卡片 2: 导出结果 -->
    <SectionCollapsible sectionKey="batch-result" title="导出结果" :defaultExpanded="true">
      <div class="result-display">
        <div v-if="exportResult && exportResult.success" class="result-status success">
          <span class="result-icon">✓</span>
          <span>导出完成</span>
        </div>
        <div v-else-if="exportResult && !exportResult.success" class="result-status error">
          <span class="result-icon">✗</span>
          <span>导出失败</span>
        </div>
        <div v-else class="empty-state">暂无导出记录</div>

        <div v-if="exportResult && exportResult.success" class="result-detail">
          <div class="result-row"><span class="result-label">文件数</span><span class="result-value">{{ exportResult.data.total }}</span></div>
          <div class="result-row"><span class="result-label">最大尺寸</span><span class="result-value">{{ exportResult.data.maxWidth }} × {{ exportResult.data.maxHeight }} px</span></div>
          <div class="result-row"><span class="result-label">最终画布</span><span class="result-value">{{ exportResult.data.maxWidth + (sizeMode === 'auto' ? paddingW : 0) }} × {{ exportResult.data.maxHeight + (sizeMode === 'auto' ? paddingH : 0) }} px</span></div>
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
import { ref, computed, onMounted, onUnmounted, inject } from "vue";
import { psBridge } from "../bridge";
import SectionCollapsible from "./SectionCollapsible.vue";
import AnchorGrid from "./AnchorGrid.vue";
import type { AnchorType, ExportFormat, SizeMode, TextLayerInfo} from "../types";
import type { BatchExportConfig } from "../types";

// Toast inject
const showToast = inject<(msg: string, isError?: boolean) => void>("showToast", () => {});

// 表单状态
const fontInfo = ref<TextLayerInfo | null>(null);
const detectError = ref("");
const characters = ref("0123456789:");
const prefix = ref("");
const format = ref<ExportFormat>("png");
const sizeMode = ref<SizeMode>("auto");
const exportWidth = ref(0);
const exportHeight = ref(0);
const paddingW = ref(2);
const paddingH = ref(3);
const anchor = ref<AnchorType>("middle-center");
const outputDir = ref("");
const isExporting = ref(false);
const exportResult = ref<{ success: boolean; data?: { total: number; maxWidth: number; maxHeight: number; outputDir: string }; error?: string } | null>(null);
const lastLayerName = ref("");
const isNoDocument = ref(false);
let detectTimer: ReturnType<typeof setInterval> | null = null;
const POLL_FAST = 10000;   // 有文档时 1s

// 自动检测到的最大尺寸
const detectedMaxW = ref(0);
const detectedMaxH = ref(0);
const isMeasuring = ref(false);

// 是否可以导出
const canExport = computed(() => {
  if (characters.value.trim() === "") return false;
  if (sizeMode.value === "manual") {
    if (exportWidth.value <= 0 || exportHeight.value <= 0) return false;
  }
  return true;
});

// 预览辅助
function getFirstChar(): string {
  var s = characters.value.trim();
  return s.length > 0 ? safePreviewChar(s.charAt(0)) : "";
}
function getLastChar(): string {
  var s = characters.value.trim();
  return s.length > 0 ? safePreviewChar(s.charAt(s.length - 1)) : "";
}
function safePreviewChar(ch: string): string {
  if (ch === ":") return "-";
  if (ch === "/" || ch === "\\" || ch === "*" || ch === "?" || ch === "\"" || ch === "<" || ch === ">" || ch === "|") return "_";
  return ch;
}

// 检测文本图层信息
async function detectTextLayer(): Promise<TextLayerInfo | null> {
  var result = await psBridge.getTextLayerInfo();
  if (result.success && result.data) {
    var info = result.data;
    isNoDocument.value = false;
    // 检测成功后恢复轮询（之前可能因无文档而停止）
    if (!polling) startPolling();
    // 只有图层变化时才更新显示
    if (info.layerName !== lastLayerName.value) {
      fontInfo.value = info;
      detectError.value = "";
      // 自动设置默认导出路径为 PSD 目录下的 output 文件夹
      setDefaultOutputDir();
    }
    lastLayerName.value = info.layerName;
    return info;
  } else if (result.noDocument) {
    detectError.value = "未打开文档，请在 PS 中打开一个文档并选中文本图层";
    fontInfo.value = null;
    lastLayerName.value = "";
    isNoDocument.value = true;
    return null;
  } else {
    isNoDocument.value = false;
    detectError.value = result.error || "检测失败，请在 PS 中选中一个文本图层";
    fontInfo.value = null;
    lastLayerName.value = "";
    return null;
  }
}

// 检测字符尺寸
async function detectSize() {
  if (!fontInfo.value) {
    showToast("请先选中一个文本图层", true);
    return;
  }
  isMeasuring.value = true;
  try {
    var config: BatchExportConfig = {
      characters: characters.value.trim(),
      prefix: "",
      format: format.value,
      sizeMode: "auto",
      exportWidth: 0,
      exportHeight: 0,
      paddingW: 0,
      paddingH: 0,
      anchor: anchor.value,
      outputDir: "",
      fontName: fontInfo.value.fontName,
      fontStyle: fontInfo.value.fontStyle,
      fontScriptName: fontInfo.value.fontScriptName,
      fontSize: fontInfo.value.fontSize,
      colorHex: fontInfo.value.color,
      syntheticBold: fontInfo.value.syntheticBold,
      syntheticItalic: fontInfo.value.syntheticItalic,
      horizontalScale: fontInfo.value.horizontalScale,
      verticalScale: fontInfo.value.verticalScale,
      autoLeading: fontInfo.value.autoLeading,
      lineHeight: fontInfo.value.lineHeight,
    };
    var result = await psBridge.measureCharacters(config);
    if (result.success && result.data) {
      detectedMaxW.value = result.data.maxWidth;
      detectedMaxH.value = result.data.maxHeight;
      showToast("检测完成，最大 " + result.data.maxWidth + "×" + result.data.maxHeight + " px");
    } else {
      showToast(result.error || "检测失败", true);
    }
  } catch (e) {
    showToast("检测失败: " + String(e), true);
  } finally {
    isMeasuring.value = false;
  }
}

// 自动设置默认导出路径为 PSD 所在目录下的 output 文件夹
async function setDefaultOutputDir() {
  // 只在用户未手动选择路径时自动设置
  if (outputDir.value) return;
  var result = await psBridge.getDocumentPath();
  if (result.success && result.data && result.data.path) {
    var psdPath = result.data.path;
    var lastSep = Math.max(psdPath.lastIndexOf("/"), psdPath.lastIndexOf("\\"));
    var psdDir = lastSep >= 0 ? psdPath.substring(0, lastSep) : psdPath;
    outputDir.value = psdDir + "/output";
  }
}

// 选择导出目录
async function selectFolder() {
  var result = await psBridge.selectFolder();
  if (result.success && result.data) {
    outputDir.value = result.data.path;
  } else if (result.error) {
    showToast(result.error, true);
  }
}

// 开始导出
async function startExport() {
  if (isExporting.value) return;

  // 1. 检测文本图层
  isExporting.value = true;
  var info = await detectTextLayer();
  if (!info) {
    isExporting.value = false;
    showToast(detectError.value || "请先在 PS 中选中一个文本图层", true);
    return;
  }

  // 2. 验证配置
  if (characters.value.trim() === "") {
    isExporting.value = false;
    showToast("请输入要导出的字符", true);
    return;
  }
  if (outputDir.value.trim() === "") {
    isExporting.value = false;
    showToast("请选择导出目录。若 PSD 未保存，需手动指定导出路径。", true);
    return;
  }
  if (sizeMode.value === "manual" && (exportWidth.value <= 0 || exportHeight.value <= 0)) {
    isExporting.value = false;
    showToast("请输入有效的画布尺寸", true);
    return;
  }

  // 3. 构建配置
  var config: BatchExportConfig = {
    characters: characters.value.trim(),
    prefix: prefix.value,
    format: format.value,
    sizeMode: sizeMode.value,
    exportWidth: sizeMode.value === "manual" ? exportWidth.value : 0,
    exportHeight: sizeMode.value === "manual" ? exportHeight.value : 0,
    paddingW: sizeMode.value === "auto" ? paddingW.value : 0,
    paddingH: sizeMode.value === "auto" ? paddingH.value : 0,
    anchor: anchor.value,
    outputDir: outputDir.value,
    fontName: info.fontName,
    fontStyle: info.fontStyle,
    fontScriptName: info.fontScriptName,
    fontSize: info.fontSize,
    colorHex: info.color,
    syntheticBold: info.syntheticBold,
    syntheticItalic: info.syntheticItalic,
    horizontalScale: info.horizontalScale,
    verticalScale: info.verticalScale,
    autoLeading: info.autoLeading,
    lineHeight: info.lineHeight,
  };

  // 4. 执行导出
  try {
    var result = await psBridge.batchExport(config);
    if (result.success && result.data) {
      var data = result.data;
      detectedMaxW.value = data.maxWidth;
      detectedMaxH.value = data.maxHeight;
      exportResult.value = { success: true, data: data };
      showToast("导出完成！共 " + data.total + " 个文件");
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

// 轮询检测图层变化（有文档 1s，无文档停止）
var polling = false;
async function pollLoop() {
  if (!polling) return;
  if (!isExporting.value) {
    await detectTextLayer();
    // 无文档则停止轮询
    if (isNoDocument.value) {
      polling = false;
      return;
    }
  }
  detectTimer = setTimeout(pollLoop, POLL_FAST);
}

function startPolling() {
  if (polling) return;
  polling = true;
  pollLoop();
}

function stopPolling() {
  polling = false;
  if (detectTimer) {
    clearTimeout(detectTimer);
    detectTimer = null;
  }
}

onMounted(async () => {
  await detectTextLayer();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.batch-export-tab > * + * {
  margin-top: 10px;
}

.font-info-display {
  background: var(--bg-input);
  border-radius: 6px;
  padding: 8px 10px;
}

.font-info-display > * + * {
  margin-top: 4px;
}

.font-info-row {
  display: flex;
  align-items: center;
  font-size: 11px;
}

.font-info-label {
  color: var(--text-muted);
  width: 32px;
  flex-shrink: 0;
}

.font-info-value {
  color: var(--text-main);
  display: flex;
  align-items: center;
}

.color-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid var(--border-strong);
  margin-right: 6px;
}

.preview-hint {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-muted);
  font-family: Consolas, Monaco, monospace;
}

/* 模式切换 */
.mode-switch {
  display: flex;
  margin-bottom: 10px;
}

.mode-switch > * + * {
  margin-left: 4px;
}

.mode-btn {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  color: var(--text-secondary);
}

.mode-btn.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

/* 卡片内分隔 */
.section-divider {
  height: 1px;
  background: var(--border);
  margin: 12px 0;
}

.section-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 8px;
}

/* 画布尺寸表格 */
.canvas-size-table {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
  margin-bottom: 10px;
}

.canvas-size-row {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  font-size: 11px;
}

.canvas-size-row + .canvas-size-row {
  border-top: 1px solid var(--border);
}

.canvas-size-header {
  padding: 5px 10px;
  font-size: 10px;
  color: var(--text-muted);
  background: rgba(0, 0, 0, 0.15);
}

.cs-col-label {
  width: 32px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.cs-col-detect {
  width: 48px;
  color: var(--text-muted);
  text-align: center;
  flex-shrink: 0;
}

.cs-col-pad {
  display: flex;
  align-items: center;
  margin-left: 12px;
  margin-right: 12px;
}

.cs-col-manual {
  display: flex;
  align-items: center;
  flex: 1;
}

.cs-input {
  width: 44px;
  background: var(--bg-main);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 11px;
  text-align: center;
}

.cs-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(58, 141, 255, 0.25);
}

.cs-unit {
  color: var(--text-muted);
  font-size: 10px;
  margin-left: 4px;
}

.canvas-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.anchor-wrap {
  display: flex;
  align-items: center;
}

.anchor-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-right: 8px;
}

.cs-col-result {
  color: var(--primary);
  font-weight: 600;
  text-align: right;
  flex: 1;
}

/* 目录选择行 */
.dir-row {
  display: flex;
  align-items: center;
}

.dir-row > * + * {
  margin-left: 6px;
}

.dir-input {
  flex: 1;
}

/* 重新检测按钮 */
.re-detect-btn {
  margin-left: auto;
}

/* 导出操作区 */
.export-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 12px;
}

.export-actions > * + * {
  margin-left: 10px;
}

.export-progress {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
}

.progress-icon {
  font-size: 11px;
  margin-right: 4px;
}

.progress-text {
  font-size: 11px;
}

/* 导出结果 */
.result-display {
  background: var(--bg-input);
  border-radius: 6px;
  padding: 10px;
}

.result-status {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.result-status.success {
  color: var(--success);
}

.result-status.error {
  color: var(--error);
}

.result-status > * + * {
  margin-left: 6px;
}

.result-icon {
  font-size: 14px;
}

.result-detail > * + * {
  margin-top: 4px;
}

.result-row {
  display: flex;
  font-size: 11px;
}

.result-label {
  color: var(--text-muted);
  width: 56px;
  flex-shrink: 0;
}

.result-value {
  color: var(--text-main);
}

.result-path {
  word-break: break-all;
  font-size: 10px;
  font-family: Consolas, Monaco, monospace;
}

.result-error-msg {
  color: var(--error);
  font-size: 11px;
}
</style>
