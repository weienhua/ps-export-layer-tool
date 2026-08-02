<!--
  BatchExportTab.vue - 批量导出 Tab
  参考 ps-layer-tool 布局：预设卡片在底部，配置表单整合
-->
<template>
  <div class="batch-export-tab">
    <!-- 可折叠卡片 1: 字体信息 -->
    <SectionCollapsible sectionKey="batch-font" title="字体信息" :defaultExpanded="true">
      <div v-if="fontInfo" class="font-info-display">
        <div class="font-info-row">
          <span class="font-info-label">字体</span>
          <span class="font-info-value">
            {{ fontInfo.fontName }} {{ fontInfo.fontStyle }}, {{ fontInfo.fontSize }}px
            <span v-if="!fontInfo.fontAvailable" class="font-warning">⚠ 字体未安装</span>
          </span>
        </div>
        <div class="font-info-row">
          <span class="font-info-label">颜色</span>
          <span class="font-info-value">
            <span class="color-swatch" :style="{ background: fontInfo.color }"></span>
            {{ fontInfo.color }}
          </span>
        </div>
        <div class="font-info-row">
          <span class="font-info-label">不透明度</span>
          <span class="font-info-value">{{ Math.round(fontInfo.opacity * 100 / 255) }}%</span>
        </div>
        <div class="font-info-row" v-if="fontInfo.activeEffects && fontInfo.activeEffects.length > 0">
          <span class="font-info-label">效果</span>
          <span class="font-info-value">{{ fontInfo.activeEffects.join("、") }}</span>
        </div>
        <div class="font-info-row">
          <span class="font-info-label">图层</span>
          <span class="font-info-value">{{ fontInfo.layerName }}</span>
          <span class="re-detect-btn"><button class="btn btn-sm" @click="detectTextLayer()" :disabled="isExporting">重新检测</button></span>
        </div>
      </div>
      <div v-else-if="detectError" class="empty-state">{{ detectError }}</div>
      <div v-else class="empty-state">选中 PS 文本图层后自动检测</div>
    </SectionCollapsible>

    <!-- 可折叠卡片 2: 导出配置 -->
    <SectionCollapsible sectionKey="batch-config" title="导出配置" :defaultExpanded="true">
      <div class="row">
        <label>预设名称</label>
        <input type="text" v-model="presetName" placeholder="输入名称后保存" />
      </div>
      <div class="row">
        <label>文件名前缀</label>
        <input type="text" v-model="prefix" placeholder="time_" />
      </div>
      <div class="preview-hint" v-if="prefix || items.length">
        → {{ safePrefix || 'file_' }}{{ getFirstItemName() }}{{ suffix }}, ... {{ safePrefix || 'file_' }}{{ getLastItemName() }}{{ suffix }}
      </div>
      <div class="filename-hint">文件名中的非法字符将自动替换为下划线</div>

      <!-- 导出项表格（内嵌在配置卡片中） -->
      <div class="items-inline">
        <div class="items-inline-header">
          <span class="items-count">导出项（{{ items.length }}）</span>
          <div class="items-inline-actions">
            <span class="rows-label">行数</span>
            <input type="number" v-model="tableRows" min="2" max="30" class="rows-input" title="表格行数" />
            <button class="btn-add-row" @click="items.push({text:'',name:''})">+ 添加行</button>
          </div>
        </div>
        <div class="items-table-wrap" :style="{ maxHeight: tableRows * 32 + 'px' }">
          <table class="items-table" v-if="items.length > 0">
            <thead><tr>
              <th class="col-idx">#</th><th class="col-txt">渲染内容</th><th class="col-nm">文件后缀</th><th class="col-act"></th>
            </tr></thead>
            <tbody>
              <tr v-for="(item, idx) in items" :key="idx">
                <td class="col-idx">{{ idx + 1 }}</td>
                <td class="col-txt"><input type="text" :value="item.text" @input="setItemText(idx, ($event.target as HTMLInputElement).value)" placeholder="渲染文本" /></td>
                <td class="col-nm"><input type="text" :value="item.name || ''" @input="setItemName(idx, ($event.target as HTMLInputElement).value)" :placeholder="sanitizePreview(item.text)" /></td>
                <td class="col-act"><button class="btn-del-row" @click="items.splice(idx, 1)" title="删除">×</button></td>
              </tr>
            </tbody>
          </table>
          <div class="items-empty-inline" v-else>暂无导出项，请选择预设或手动添加</div>
        </div>
      </div>

      <div class="section-divider"></div>

      <!-- 画布设置 -->
      <div class="mode-switch">
        <button :class="['mode-btn', { active: sizeMode === 'auto' }]" @click="sizeMode = 'auto'">自动检测</button>
        <button :class="['mode-btn', { active: sizeMode === 'manual' }]" @click="sizeMode = 'manual'">手动输入</button>
      </div>

      <div v-if="sizeMode === 'auto'" class="canvas-size-table">
        <div class="canvas-size-row canvas-size-header">
          <span class="cs-col-label"></span><span class="cs-col-detect">检测值</span><span class="cs-col-pad">延长</span><span class="cs-col-result">最终尺寸</span>
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
          <span class="cs-col-manual"><input type="number" v-model="exportWidth" min="1" placeholder="64" class="cs-input" /><span class="cs-unit">px</span></span>
          <span class="cs-col-label">高度</span>
          <span class="cs-col-manual"><input type="number" v-model="exportHeight" min="1" placeholder="80" class="cs-input" /><span class="cs-unit">px</span></span>
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
      <div class="filename-hint">图层按照宽高锚点对齐以后四周的额外边距</div>

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
        <button class="btn btn-primary" @click="handleSavePreset()">保存为预设</button>
        <button class="btn btn-primary" @click="startExport" :disabled="isExporting">
          {{ isExporting ? '导出中...' : '开始导出' }}
        </button>
      </div>
    </SectionCollapsible>

    <!-- 可折叠卡片 3: 导出结果 -->
    <SectionCollapsible sectionKey="batch-result" title="导出结果" :defaultExpanded="false">
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
          <div class="result-row"><span class="result-label">最终画布</span><span class="result-value">{{ exportResult.data.maxWidth + (sizeMode === 'auto' ? paddingW + alignPadLeft + alignPadRight : 0) }} × {{ exportResult.data.maxHeight + (sizeMode === 'auto' ? paddingH + alignPadTop + alignPadBottom : 0) }} px</span></div>
          <div class="result-row"><span class="result-label">输出目录</span><span class="result-value result-path">{{ exportResult.data.outputDir }}</span></div>
        </div>
        <div v-else-if="exportResult && !exportResult.success" class="result-detail">
          <div class="result-row result-error-msg">{{ exportResult.error }}</div>
        </div>
      </div>
    </SectionCollapsible>

    <!-- 可折叠卡片 5: 预设（底部，参考 ps-layer-tool） -->
    <SectionCollapsible sectionKey="batch-presets" title="预设" :defaultExpanded="true">
      <div class="preset-section-header">
        <span class="preset-section-label">选择预设快速填充配置</span>
        <div class="preset-section-toggles">
          <label class="auto-export-toggle">
            <span class="toggle-label">预览</span>
            <span class="switch">
              <input type="checkbox" v-model="previewEnabled" />
              <span class="slider"></span>
            </span>
          </label>
          <label class="auto-export-toggle">
            <span class="toggle-label">应用后自动导出</span>
            <span class="switch">
              <input type="checkbox" v-model="autoExportEnabled" />
              <span class="slider"></span>
            </span>
          </label>
        </div>
      </div>
      <ExportPresetList
        :presets="presets"
        :previewEnabled="previewEnabled"
        @apply="onApplyPreset"
        @delete="handleDeletePreset"
        @reorder="handlePresetReorder"
      />
    </SectionCollapsible>

    <!-- 字体未安装确认弹窗 -->
    <div v-if="fontWarning.visible" class="modal-overlay" @click.self="fontWarning.visible = false">
      <div class="modal-dialog">
        <div class="modal-header">字体未安装</div>
        <div class="modal-body">
          字体 "{{ fontWarning.label }}" 未安装，导出时将使用系统默认字体替换。是否继续导出？
        </div>
        <div class="modal-footer">
          <button class="btn" @click="fontWarning.visible = false">取消</button>
          <button class="btn btn-primary" @click="fontWarning.onConfirm">继续导出</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, inject } from "vue";
import { psBridge } from "../bridge";
import SectionCollapsible from "./SectionCollapsible.vue";
import AnchorGrid from "./AnchorGrid.vue";
import ExportPresetList from "./ExportPresetList.vue";
import { useExportPreset } from "../composables/useExportPreset";
import { getSetting, setSetting, outputDir } from "../composables/settings";
import { sanitizeFilename } from "../composables/filenameUtils";
import type { AnchorType, ExportFormat, SizeMode, TextLayerInfo, ExportPreset } from "../types";
import type { BatchExportConfig, ExportPresetItem } from "../types";

const showToast = inject<(msg: string, isError?: boolean) => void>("showToast", function () {});

const { presets, load: loadPresets, save: savePreset, remove: removePreset, reorder: reorderPresets } = useExportPreset();

const fontInfo = ref<TextLayerInfo | null>(null);
const detectError = ref("");
const items = ref<ExportPresetItem[]>([]);
const activePresetId = ref<string | null>(null);
const prefix = ref("");
const format = ref<ExportFormat>("png");
const sizeMode = ref<SizeMode>("auto");
const exportWidth = ref(0);
const exportHeight = ref(0);
const paddingW = ref(10);
const paddingH = ref(10);
const alignPadTop = ref(getSetting("batchAlignPadT", 0));
const alignPadRight = ref(getSetting("batchAlignPadR", 0));
const alignPadBottom = ref(getSetting("batchAlignPadB", 0));
const alignPadLeft = ref(getSetting("batchAlignPadL", 0));
const anchor = ref<AnchorType>("middle-center");
const isExporting = ref(false);
var fontWarning = reactive({ visible: false, label: "", onConfirm: () => {} });
const autoExportEnabled = ref(getSetting("autoExportEnabled", false));
const previewEnabled = ref(getSetting("previewEnabled", true));
const presetName = ref("");
const tableRows = ref(getSetting("tableRows", 8));
const exportResult = ref<{ success: boolean; data?: { total: number; maxWidth: number; maxHeight: number; outputDir: string }; error?: string } | null>(null);
const lastLayerId = ref(-1);
const isNoDocument = ref(false);
let detectTimer: ReturnType<typeof setInterval> | null = null;
const POLL_FAST = 1000;
const detectedMaxW = ref(0);
const detectedMaxH = ref(0);
const isMeasuring = ref(false);

const suffix = computed(function () { return format.value === "png" ? ".png" : ".jpg"; });
const safePrefix = computed(function () { return sanitizeFilename(prefix.value); });
const canExport = computed(function () { return items.value.length > 0; });

function sanitizePreview(ch: string): string {
  if (ch === ":") return "-"; if (ch === "/" || ch === "\\" || ch === "*" || ch === "?" || ch === "\"" || ch === "<" || ch === ">" || ch === "|") return "_";
  return ch;
}
function getFirstItemName(): string {
  if (items.value.length === 0) return "0";
  var first = items.value[0];
  return first.name || sanitizePreview(first.text);
}
function getLastItemName(): string {
  if (items.value.length === 0) return "9";
  var last = items.value[items.value.length - 1];
  return last.name || sanitizePreview(last.text);
}

async function detectTextLayer(): Promise<TextLayerInfo | null> {
  var result = await psBridge.getTextLayerInfo();
  if (result.success && result.data) {
    var info = result.data;
    isNoDocument.value = false;
    if (!polling) startPolling();
    // 始终更新 fontInfo：opacity/颜色/效果等属性可能在同一图层上发生变化
    fontInfo.value = info;
    detectError.value = "";
    // 仅图层切换时重新设置输出目录
    if (info.layerId !== lastLayerId.value) {
      setDefaultOutputDir();
    }
    lastLayerId.value = info.layerId;
    return info;
  } else if (result.noDocument) {
    detectError.value = "未打开文档，请在 PS 中打开一个文档并选中文本图层";
    fontInfo.value = null; lastLayerId.value = -1; isNoDocument.value = true; return null;
  } else {
    isNoDocument.value = false;
    detectError.value = result.error || "检测失败"; fontInfo.value = null; lastLayerId.value = -1; return null;
  }
}

async function detectSize() {
  if (!fontInfo.value) { showToast("请先选中一个文本图层", true); return; }
  if (items.value.length === 0) { showToast("请先选择预设或添加导出项", true); return; }
  if (!fontInfo.value.fontAvailable) {
    fontWarning.label = fontInfo.value.fontName + " " + fontInfo.value.fontStyle;
    fontWarning.onConfirm = () => { fontWarning.visible = false; doDetectSize(); };
    fontWarning.visible = true;
    return;
  }
  await doDetectSize();
}

async function doDetectSize() {
  isMeasuring.value = true;
  try {
    var result = await psBridge.measureCharacters(buildConfig(items.value));
    if (result.success && result.data) {
      detectedMaxW.value = result.data.maxWidth; detectedMaxH.value = result.data.maxHeight;
      showToast("检测完成 " + result.data.maxWidth + "×" + result.data.maxHeight + " px");
    } else { showToast(result.error || "检测失败", true); }
  } catch (e) { showToast("检测失败: " + String(e), true); }
  finally { isMeasuring.value = false; }
}

function buildConfig(theItems: ExportPresetItem[]): BatchExportConfig {
  var info = fontInfo.value;
  return {
    items: theItems, prefix: sanitizeFilename(prefix.value), format: format.value, sizeMode: sizeMode.value,
    exportWidth: sizeMode.value === "manual" ? exportWidth.value : 0,
    exportHeight: sizeMode.value === "manual" ? exportHeight.value : 0,
    paddingW: sizeMode.value === "auto" ? paddingW.value : 0,
    paddingH: sizeMode.value === "auto" ? paddingH.value : 0,
    paddingTop: alignPadTop.value,
    paddingRight: alignPadRight.value,
    paddingBottom: alignPadBottom.value,
    paddingLeft: alignPadLeft.value,
    anchor: anchor.value, outputDir: outputDir.value,
    fontName: info ? info.fontName : "", fontStyle: info ? info.fontStyle : "",
    fontScriptName: info ? info.fontScriptName : "", fontSize: info ? info.fontSize : 12,
    colorHex: info ? info.color : "#000000", syntheticBold: info ? info.syntheticBold : false,
    syntheticItalic: info ? info.syntheticItalic : false,
    horizontalScale: info ? info.horizontalScale : 100, verticalScale: info ? info.verticalScale : 100,
    autoLeading: info ? info.autoLeading : true, lineHeight: info ? info.lineHeight : -1,
    antiAlias: info ? info.antiAlias : "antiAliasSmooth", opacity: info ? info.opacity : 255,
  };
}

async function setDefaultOutputDir() {
  if (outputDir.value) return;
  var result = await psBridge.getDocumentPath();
  if (result.success && result.data && result.data.path) {
    var psdPath = result.data.path;
    var lastSep = Math.max(psdPath.lastIndexOf("/"), psdPath.lastIndexOf("\\"));
    outputDir.value = (lastSep >= 0 ? psdPath.substring(0, lastSep) : psdPath) + "/output";
  }
}

async function selectFolder() {
  var result = await psBridge.selectFolder();
  if (result.success && result.data) { outputDir.value = result.data.path; }
  else if (result.error) { showToast(result.error, true); }
}

async function doExport(_info: any) {
  isExporting.value = true;
  if (items.value.length === 0) { isExporting.value = false; showToast("请先选择预设或添加导出项", true); return; }
  if (outputDir.value.trim() === "") { isExporting.value = false; showToast("请选择导出目录", true); return; }
  if (sizeMode.value === "manual" && (exportWidth.value <= 0 || exportHeight.value <= 0)) {
    isExporting.value = false; showToast("请输入有效的画布尺寸", true); return;
  }
  try {
    var result = await psBridge.batchExport(buildConfig(items.value));
    if (result.success && result.data) {
      detectedMaxW.value = result.data.maxWidth; detectedMaxH.value = result.data.maxHeight;
      exportResult.value = { success: true, data: result.data };
      showToast("导出完成！共 " + result.data.total + " 个文件");
    } else { exportResult.value = { success: false, error: result.error || "导出失败" }; showToast(result.error || "导出失败", true); }
  } catch (e) { exportResult.value = { success: false, error: String(e) }; showToast("导出失败: " + String(e), true); }
  finally { isExporting.value = false; }
}

async function startExport() {
  if (isExporting.value) return;
  var info = await detectTextLayer();
  if (!info) { showToast(detectError.value || "请先选中文本图层", true); return; }
  if (!info.fontAvailable) {
    fontWarning.label = info.fontName + " " + info.fontStyle;
    fontWarning.onConfirm = () => { fontWarning.visible = false; doExport(info); };
    fontWarning.visible = true;
    return;
  }
  await doExport(info);
}

// items 内联编辑
function setItemText(idx: number, text: string) {
  var newItems = [...items.value];
  newItems[idx] = { ...newItems[idx], text: text };
  items.value = newItems;
}
function setItemName(idx: number, name: string) {
  var newItems = [...items.value];
  newItems[idx] = { ...newItems[idx], name: name };
  items.value = newItems;
}

// 填充表单（不含 auto-export，用于恢复预设）
function fillFormFromPreset(preset: ExportPreset) {
  items.value = [...preset.items];
  activePresetId.value = preset.id;
  presetName.value = preset.name;
  prefix.value = preset.prefix || "";
  format.value = preset.format || "png";
  anchor.value = preset.anchor || "middle-center";
  paddingW.value = preset.paddingW !== undefined ? preset.paddingW : 10;
  paddingH.value = preset.paddingH !== undefined ? preset.paddingH : 10;
  alignPadTop.value = preset.paddingTop !== undefined ? preset.paddingTop : 0;
  alignPadRight.value = preset.paddingRight !== undefined ? preset.paddingRight : 0;
  alignPadBottom.value = preset.paddingBottom !== undefined ? preset.paddingBottom : 0;
  alignPadLeft.value = preset.paddingLeft !== undefined ? preset.paddingLeft : 0;
}

// 用户点击预设卡片 → 填充 + 可选自动导出
function onApplyPreset(preset: ExportPreset) {
  fillFormFromPreset(preset);
  showToast("已应用预设：" + preset.name);
  setSetting("activePresetName", preset.name);

  if (autoExportEnabled.value) {
    if (sizeMode.value === "manual") { sizeMode.value = "auto"; }
    doAutoExport();
  }
}

// 自动导出：host 端 batchExport 已有 Phase 2 测量，直接导出
function doAutoExport() {
  startExport();
}

function handlePresetReorder(fromId: string, toId: string) {
  reorderPresets(fromId, toId);
}

function handleDeletePreset(id: string) {
  removePreset(id);
  if (activePresetId.value === id) { activePresetId.value = null; }
}

function handleSavePreset() {
  if (items.value.length === 0) { showToast("请先添加导出项", true); return; }
  if (!presetName.value.trim()) { showToast("请输入预设名称", true); return; }
  var name = presetName.value.trim();
  savePreset({
    id: "",
    name: name,
    items: [...items.value], prefix: prefix.value, format: format.value,
    anchor: anchor.value, paddingW: paddingW.value, paddingH: paddingH.value,
    paddingTop: alignPadTop.value, paddingRight: alignPadRight.value,
    paddingBottom: alignPadBottom.value, paddingLeft: alignPadLeft.value,
  });
  showToast("预设已保存：" + name);
}

var polling = false;
async function pollLoop() {
  if (!polling) return;
  if (!isExporting.value) {
    await detectTextLayer();
    if (isNoDocument.value) { polling = false; return; }
  }
  detectTimer = setTimeout(pollLoop, POLL_FAST);
}
function startPolling() { if (polling) return; polling = true; pollLoop(); }
function stopPolling() { polling = false; if (detectTimer) { clearTimeout(detectTimer); detectTimer = null; } }

onMounted(async function () {
  await loadPresets();
  await detectTextLayer();

  // 恢复上次选中的预设，否则默认选「数字」（不触发 auto-export）
  if (items.value.length === 0) {
    var savedName = getSetting("activePresetName", "");
    var found = false;
    for (var j = 0; j < presets.value.length; j++) {
      if (presets.value[j].name === savedName) {
        fillFormFromPreset(presets.value[j]);
        found = true;
        break;
      }
    }
    if (!found) {
      for (var i = 0; i < presets.value.length; i++) {
        if (presets.value[i].id === "builtin-number-0-9") {
          fillFormFromPreset(presets.value[i]);
          break;
        }
      }
    }
  }
  startPolling();
});

watch(tableRows, function (val) { setSetting("tableRows", val); });
watch(previewEnabled, function (val) { setSetting("previewEnabled", val); });
watch(autoExportEnabled, function (val) { setSetting("autoExportEnabled", val); });
watch(alignPadTop, function (val) { setSetting("batchAlignPadT", val); });
watch(alignPadRight, function (val) { setSetting("batchAlignPadR", val); });
watch(alignPadBottom, function (val) { setSetting("batchAlignPadB", val); });
watch(alignPadLeft, function (val) { setSetting("batchAlignPadL", val); });

onUnmounted(function () { stopPolling(); });
</script>

<style scoped>
.batch-export-tab > * + * { margin-top: 10px; }

.font-info-display { background: var(--bg-input); border-radius: 6px; padding: 8px 10px; }
.font-info-display > * + * { margin-top: 4px; }
.font-info-row { display: flex; align-items: center; font-size: 11px; }
.font-info-label { color: var(--text-muted); width: 32px; flex-shrink: 0; }
.font-info-value { color: var(--text-main); display: flex; align-items: center; }
.color-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--border-strong); margin-right: 6px; }
.preview-hint { margin-top: 4px; font-size: 10px; color: var(--text-muted); font-family: Consolas, Monaco, monospace; }
.filename-hint { margin-top: 2px; font-size: 10px; color: var(--text-muted); }

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
.font-warning { color: #e6a23c; font-size: 11px; margin-left: 6px; }
.re-detect-btn { margin-left: auto; }

/* 导出项内嵌表格 */
.items-inline { margin-top: 10px; }
.items-inline-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.items-count { font-size: 11px; color: var(--text-secondary); }
.items-inline-actions { display: flex; align-items: center; }
.items-inline-actions > * + * { margin-left: 6px; }
.rows-input { width: 36px; padding: 2px 4px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); color: var(--text-main); font-size: 11px; text-align: center; }
.rows-input:focus { outline: none; border-color: var(--primary); }
.btn-add-row { padding: 2px 10px; border: 1px solid var(--primary); border-radius: 4px; background: var(--primary); color: #fff; font-size: 11px; cursor: pointer; }
.btn-add-row:hover { background: var(--primary-hover, #5aa0ff); }
.items-table-wrap { overflow-y: auto; border: 1px solid var(--border); border-radius: 4px; }
.items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.items-table th { position: sticky; top: 0; background: var(--bg-secondary, #2a2a2a); color: var(--text-muted); font-weight: 500; padding: 4px 6px; border-bottom: 1px solid var(--border); z-index: 1; }
.items-table td { padding: 2px 6px; border-bottom: 1px solid var(--border-hairline, #3a3a3a); }
.col-idx { width: 28px; text-align: center; color: var(--text-muted); font-size: 10px; }
.col-txt, .col-nm { width: 44%; }
.col-act { width: 24px; text-align: center; }
.items-table input { width: 100%; padding: 3px 4px; border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--text-main); font-size: 12px; box-sizing: border-box; }
.items-table input:hover { border-color: var(--border); }
.items-table input:focus { border-color: var(--primary); background: var(--bg-input); outline: none; }
.btn-del-row { background: none; border: none; color: var(--text-muted); font-size: 14px; cursor: pointer; padding: 0 2px; line-height: 1; }
.btn-del-row:hover { color: var(--error); }
.items-empty-inline { color: var(--text-muted); font-size: 12px; padding: 12px; text-align: center; }

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

/* 预设区域 */
.preset-section-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.preset-section-label { font-size: 11px; color: var(--text-secondary); white-space: nowrap; margin-bottom: 4px; }
.preset-section-toggles { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 4px; }
.preset-section-toggles > * { margin-top: 2px; }
.preset-section-toggles > * + * { margin-left: 16px; }

.auto-export-toggle { display: inline-flex; align-items: center; cursor: pointer; }
.auto-export-toggle > * + * { margin-left: 8px; }
.toggle-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

.switch { position: relative; display: inline-block; width: 32px; height: 18px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #444; transition: .2s; border-radius: 18px; }
.slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .2s; border-radius: 50%; }
input:checked + .slider { background-color: #0d6efd; }
input:checked + .slider:before { transform: translateX(14px); }

/* 自定义弹窗 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-dialog { background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px; padding: 20px 24px; max-width: 360px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
.modal-header { font-size: 14px; font-weight: 600; color: var(--text-main); margin-bottom: 12px; }
.modal-body { font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px; }
.modal-footer { display: flex; justify-content: flex-end; }
.modal-footer > * + * { margin-left: 8px; }

.align-pad-table { margin-top: 10px; }
</style>
