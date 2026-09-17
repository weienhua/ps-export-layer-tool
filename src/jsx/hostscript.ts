/// <reference types="ps-extendscript-types"/>
// @ts-ignore
if (typeof Symbol === "undefined") var Symbol = { toStringTag: "Symbol.toStringTag" };
import "extendscript-es5-shim";

// ─── 模块导入（仅 $.HostScript 注册的函数）──────────────────
import { getDocumentInfo, getDocumentPath } from "./modules/document";
import { getTextLayerInfo, batchExport, measureCharacters } from "./modules/batchExport";
import { getSelectedLayersInfo, batchExportLayers, measureLayers } from "./modules/layersExport";
import { freeExport } from "./modules/freeExport";
import { selectFolderDialog, readFile, writeFile, getExtensionPath, ensureDirectory } from "./modules/fileOps";

// ─── 全局注册（PS 宿主调用入口）─────────────────────────────
// 宿主脚本版本号：面板「导出结果」会显示，用于确认 PS 加载的是否为最新脚本
// ⚠️ 修改宿主逻辑后必须同步递增，否则无法区分「代码 bug」与「PS 缓存了旧脚本」
// @ts-ignore
var HOST_SCRIPT_VERSION = "2026.09.16-分轴统一裁剪-1";
// @ts-ignore
$ = $ || {};
// @ts-ignore
$.HostScriptVersion = HOST_SCRIPT_VERSION;
// @ts-ignore
$.HostScript = {
  getDocumentInfo: getDocumentInfo,
  getDocumentPath: getDocumentPath,
  getTextLayerInfo: getTextLayerInfo,
  batchExport: batchExport,
  measureCharacters: measureCharacters,
  getSelectedLayersInfo: getSelectedLayersInfo,
  batchExportLayers: batchExportLayers,
  measureLayers: measureLayers,
  freeExport: freeExport,
  selectFolderDialog: selectFolderDialog,
  readFile: readFile,
  writeFile: writeFile,
  getExtensionPath: getExtensionPath,
  ensureDirectory: ensureDirectory,
};
