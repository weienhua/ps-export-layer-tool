/**
 * document.ts - 文档/图层基础查询（模板骨架）
 * 提供文档信息、图层查询等基础功能
 */

/// <reference types="ps-extendscript-types"/>

import { Document, Layer, Utils } from "../ps-api/src/index";

/**
 * 获取当前活动文档的基本信息
 * @returns JSON 字符串 { name, width, height }
 */
export function getDocumentInfo(): string {
  try {
    if (app.documents.length === 0) return "__NO_DOCUMENT__";
    var doc = Document.activeDocument();
    var size = doc.size();
    return JSON.stringify({
      name: doc.name(),
      width: size.width,
      height: size.height,
    });
  } catch (e) {
    return "__ERROR__:" + e;
  }
}

/**
 * 获取当前文档的文件路径
 * @returns JSON 字符串 { path }
 */
export function getDocumentPath(): string {
  try {
    if (app.documents.length === 0) return "__NO_DOCUMENT__";
    var doc = Document.activeDocument();
    var fileObj = doc.path();
    var pathStr = "";
    if (fileObj) {
      // File 对象需取 fsName 才是字符串路径
      // @ts-ignore
      pathStr = fileObj.fsName || fileObj.toString() || "";
    }
    return JSON.stringify({ path: pathStr });
  } catch (e) {
    return "__ERROR__:" + e;
  }
}
