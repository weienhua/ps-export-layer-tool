/**
 * exportUtils.ts - 导出通用工具函数
 * 提供跨文档复制、画布裁剪、图层平移、锚点计算等基础操作
 *
 * 所有 ps-api 类统一从 index.ts 导入，避免多路径引用导致的模块冲突
 */

import { Document } from "../ps-api/src/index";
import { Layer } from "../ps-api/src/index";

/**
 * 跨文档复制源图层到目标文档，返回复制后的图层
 */
export function duplicateSourceLayer(
  srcDoc: any,
  srcLayerId: number,
  targetDocName: string
): any {
  // 切换到源文档
  app.activeDocument = srcDoc;

  // 选中源图层
  var selectDesc = new ActionDescriptor();
  var selectRef = new ActionReference();
  selectRef.putIdentifier(charIDToTypeID("Lyr "), srcLayerId);
  selectDesc.putReference(charIDToTypeID("null"), selectRef);
  selectDesc.putBoolean(charIDToTypeID("MkVs"), false);
  executeAction(charIDToTypeID("slct"), selectDesc, DialogModes.NO);

  // 复制到目标文档
  var dupDesc = new ActionDescriptor();
  var dupRef = new ActionReference();
  dupRef.putEnumerated(
    stringIDToTypeID("layer"),
    stringIDToTypeID("ordinal"),
    stringIDToTypeID("targetEnum")
  );
  dupDesc.putReference(stringIDToTypeID("null"), dupRef);
  var dstRef = new ActionReference();
  dstRef.putName(stringIDToTypeID("document"), targetDocName);
  dupDesc.putReference(stringIDToTypeID("to"), dstRef);
  dupDesc.putInteger(stringIDToTypeID("version"), 5);
  executeAction(stringIDToTypeID("duplicate"), dupDesc, DialogModes.NO);

  // 切回目标文档，获取复制后的图层
  var targetDoc = app.documents.getByName(targetDocName);
  app.activeDocument = targetDoc;
  return Layer.getSelectedLayers()[0];
}

/**
 * 文档内复制图层（按 ID 选中后复制），返回复制后的图层
 */
export function duplicateLayer(layerId: number): any {
  // 选中图层
  var selectDesc = new ActionDescriptor();
  var selectRef = new ActionReference();
  selectRef.putIdentifier(charIDToTypeID("Lyr "), layerId);
  selectDesc.putReference(charIDToTypeID("null"), selectRef);
  selectDesc.putBoolean(charIDToTypeID("MkVs"), false);
  executeAction(charIDToTypeID("slct"), selectDesc, DialogModes.NO);

  // 原地复制
  var dupDesc = new ActionDescriptor();
  var dupRef = new ActionReference();
  dupRef.putEnumerated(
    stringIDToTypeID("layer"),
    stringIDToTypeID("ordinal"),
    stringIDToTypeID("targetEnum")
  );
  dupDesc.putReference(stringIDToTypeID("null"), dupRef);
  dupDesc.putInteger(stringIDToTypeID("version"), 5);
  executeAction(stringIDToTypeID("duplicate"), dupDesc, DialogModes.NO);

  // 确保复制出的图层是可见的（模板层已被隐藏）
  var dupLayer = Layer.getSelectedLayers()[0];
  dupLayer.show();
  return dupLayer;
}

/**
 * 带锚点的 resizeCanvas（ps-api 版本固定居中）
 */
export function resizeCanvasWithAnchor(
  doc: Document,
  width: number,
  height: number,
  hAnchor: number,
  vAnchor: number
): void {
  var c2t = charIDToTypeID;
  var desc = new ActionDescriptor();
  desc.putUnitDouble(c2t("Wdth"), c2t("#Pxl"), width);
  desc.putUnitDouble(c2t("Hght"), c2t("#Pxl"), height);
  desc.putEnumerated(c2t("Hrzn"), c2t("HrzL"), hAnchor);
  desc.putEnumerated(c2t("Vrtc"), c2t("VrtL"), vAnchor);
  executeAction(c2t("CnvS"), desc, DialogModes.NO);
}

/**
 * ActionManager 平移图层
 */
export function translateLayerBy(offsetX: number, offsetY: number): void {
  var c2t = charIDToTypeID;
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putEnumerated(c2t("Lyr "), c2t("Ordn"), c2t("Trgt"));
  desc.putReference(c2t("null"), ref);
  var offsetDesc = new ActionDescriptor();
  offsetDesc.putUnitDouble(c2t("Hrzn"), c2t("#Pxl"), offsetX);
  offsetDesc.putUnitDouble(c2t("Vrtc"), c2t("#Pxl"), offsetY);
  desc.putObject(c2t("T   "), c2t("Ofst"), offsetDesc);
  executeAction(c2t("move"), desc, DialogModes.NO);
}

/**
 * 水平锚点偏移计算
 * @param anchor 锚点字符串（top-left, middle-center 等）
 * @param boundsX 图层左边界 x 坐标
 * @param textWidth 文本宽度
 * @param canvasWidth 画布宽度
 * @param padL 左边距（left 锚点时生效），可选
 * @param padR 右边距（right 锚点时生效），可选
 * @returns 需要平移的 x 偏移量
 */
export function calcAnchorOffsetX(
  anchor: string,
  boundsX: number,
  textWidth: number,
  canvasWidth: number,
  padL?: number,
  padR?: number
): number {
  var textLeft = boundsX;
  var textCenter = boundsX + textWidth / 2;
  var textRight = boundsX + textWidth;

  if (padL == null) { padL = 0; }
  if (padR == null) { padR = 0; }

  if (
    anchor === "top-left" ||
    anchor === "middle-left" ||
    anchor === "bottom-left"
  ) {
    return -textLeft + padL;
  } else if (
    anchor === "top-center" ||
    anchor === "middle-center" ||
    anchor === "bottom-center"
  ) {
    return canvasWidth / 2 - textCenter;
  } else {
    return canvasWidth - textRight - padR;
  }
}

/**
 * 垂直锚点偏移计算
 * @param anchor 锚点字符串（top-left, middle-center 等）
 * @param boundsY 图层上边界 y 坐标
 * @param textHeight 文本高度
 * @param canvasHeight 画布高度
 * @param padT 上边距（top 锚点时生效），可选
 * @param padB 下边距（bottom 锚点时生效），可选
 * @returns 需要平移的 y 偏移量
 */
export function calcAnchorOffsetY(
  anchor: string,
  boundsY: number,
  textHeight: number,
  canvasHeight: number,
  padT?: number,
  padB?: number
): number {
  var textTop = boundsY;
  var textMiddle = boundsY + textHeight / 2;
  var textBottom = boundsY + textHeight;

  if (padT == null) { padT = 0; }
  if (padB == null) { padB = 0; }

  if (
    anchor === "top-left" ||
    anchor === "top-center" ||
    anchor === "top-right"
  ) {
    return -textTop + padT;
  } else if (
    anchor === "middle-left" ||
    anchor === "middle-center" ||
    anchor === "middle-right"
  ) {
    return canvasHeight / 2 - textMiddle;
  } else {
    return canvasHeight - textBottom - padB;
  }
}

/**
 * 文件名特殊字符处理
 * @param ch 单个字符
 * @returns 替换后的安全字符
 */
export function sanitizeFilenameChar(ch: string): string {
  if (ch === ":") return "-";
  if (ch === "/") return "_";
  if (ch === "\\") return "_";
  if (ch === "*") return "_";
  if (ch === "?") return "_";
  if (ch === "\"") return "_";
  if (ch === "<") return "_";
  if (ch === ">") return "_";
  if (ch === "|") return "_";
  return ch;
}

/**
 * 对完整字符串逐字符 sanitize
 * @param name 原始字符串
 * @returns sanitize 后的安全字符串
 */
export function sanitizeFilename(name: string): string {
  var result = "";
  for (var i = 0; i < name.length; i++) {
    result += sanitizeFilenameChar(name.charAt(i));
  }
  return result;
}
