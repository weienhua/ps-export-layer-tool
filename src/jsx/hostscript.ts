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
// @ts-ignore
$ = $ || {};
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
