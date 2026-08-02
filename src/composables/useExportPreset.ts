/**
 * useExportPreset - 导出预设管理 composable
 * 参考 ps-layer-tool usePreset.ts：面板侧 CSInterface 获取扩展路径
 *
 * 存储: <扩展目录>/dist/lib/presets/default.json + localStorage
 */

import { ref } from "vue";
import type { ExportPreset } from "../types";
import { psBridge } from "../bridge";

const STORAGE_KEY = "exportLayerTool.presets.v1";
const PRESET_FILE = "/dist/lib/presets/default.json";
const PRESET_DIR = "/dist/lib/presets";

function getExtensionPathSync(): string {
  try {
    return new (window as any).CSInterface().getSystemPath("extension") || "";
  } catch (e) {
    return "";
  }
}

export function useExportPreset() {
  var presets = ref<ExportPreset[]>([]);
  var loading = ref(false);
  var loaded = ref(false);

  function loadFromStorage(): ExportPreset[] | null {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as ExportPreset[];
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveToStorage(data: ExportPreset[]): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  async function persist(): Promise<void> {
    saveToStorage(presets.value);
    try {
      var extPath = getExtensionPathSync();
      if (extPath) {
        var dirPath = extPath + PRESET_DIR;
        var filePath = extPath + PRESET_FILE;
        await psBridge.ensureDirectory(dirPath);
        await psBridge.writeFile(filePath, JSON.stringify(presets.value, null, 2));
      }
    } catch (e) {
      console.error("[useExportPreset] persist error:", e);
    }
  }

  function normalize(data: ExportPreset[]): ExportPreset[] {
    for (var i = 0; i < data.length; i++) {
      var p = data[i];
      if (p.prefix === undefined) p.prefix = "";
      if (p.format === undefined) p.format = "png";
      if (p.anchor === undefined) p.anchor = "middle-center";
      if (p.paddingW === undefined) p.paddingW = 10;
      if (p.paddingH === undefined) p.paddingH = 10;
      if (p.paddingTop === undefined) p.paddingTop = 0;
      if (p.paddingRight === undefined) p.paddingRight = 0;
      if (p.paddingBottom === undefined) p.paddingBottom = 0;
      if (p.paddingLeft === undefined) p.paddingLeft = 0;
    }
    return data;
  }

  async function load(): Promise<void> {
    if (loaded.value) return;
    loading.value = true;

    try {
      var extPath = getExtensionPathSync();
      if (extPath) {
        var dirPath = extPath + PRESET_DIR;
        var filePath = extPath + PRESET_FILE;
        await psBridge.ensureDirectory(dirPath);

        // 1. 文件
        var fileResult = await psBridge.readFile(filePath);
        if (fileResult.success && fileResult.data) {
          var raw = fileResult.data;
          if (typeof raw === "string" && raw.indexOf("__ERROR__") === 0) { /* skip corrupt data */ }
          else {
            var parsed: ExportPreset[] = typeof raw === "string"
              ? JSON.parse(raw)
              : raw as ExportPreset[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              presets.value = normalize(parsed);
              saveToStorage(presets.value);
              loaded.value = true;
              loading.value = false;
              return;
            }
          }
        }

        // 2. localStorage
        var storageData = loadFromStorage();
        if (storageData && storageData.length > 0) {
          presets.value = normalize(storageData);
          await psBridge.writeFile(filePath, JSON.stringify(presets.value, null, 2));
          saveToStorage(presets.value);
          loaded.value = true;
          loading.value = false;
          return;
        }

        // 3. 无数据：空列表
        presets.value = [];
        loaded.value = true;
        loading.value = false;
        return;
      }
    } catch (e) {
      console.error("[useExportPreset] load error:", e);
    }

    // 无扩展路径时的 fallback
    presets.value = [];
    loaded.value = true;
    loading.value = false;
  }

  // Bug 2 fix: 按 name 匹配；新增强制生成新 ID，更新保留原 ID
  function save(preset: ExportPreset): void {
    var idx = -1;
    for (var i = 0; i < presets.value.length; i++) {
      if (presets.value[i].name === preset.name) { idx = i; break; }
    }
    if (idx >= 0) {
      presets.value[idx] = Object.assign({}, preset, { id: presets.value[idx].id });
    } else {
      presets.value.push(Object.assign({}, preset, { id: String(Date.now()) }));
    }
    persist().catch(function () {});
  }

  function remove(id: string): void {
    var filtered: ExportPreset[] = [];
    for (var i = 0; i < presets.value.length; i++) {
      if (presets.value[i].id !== id) filtered.push(presets.value[i]);
    }
    presets.value = filtered;
    persist().catch(function () {});
  }

  function reorder(fromId: string, toId: string): void {
    var fromIdx = -1, toIdx = -1;
    for (var i = 0; i < presets.value.length; i++) {
      if (presets.value[i].id === fromId) fromIdx = i;
      if (presets.value[i].id === toId) toIdx = i;
    }
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    var item = presets.value.splice(fromIdx, 1)[0];
    presets.value.splice(toIdx, 0, item);
    persist().catch(function () {});
  }

  return { presets, loading, loaded, load, save, remove, reorder, persist };
}
