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

  // 切回目标文档，获取复制后的图层（调用方可用 getLayerId 读取其 id）
  var targetDoc = app.documents.getByName(targetDocName);
  app.activeDocument = targetDoc;
  return Layer.getSelectedLayers()[0];
}

/**
 * 文档内复制图层（按 ID 选中后复制），返回复制后的图层
 * 复制完成后选中新图层（调用方可直接对 activeLayer 操作），并确保其可见（模板层已被隐藏）
 */
export function duplicateLayer(layerId: number): any {
  // 选中图层
  selectLayerById(layerId);

  // 原地复制
  duplicateActiveLayer();

  // 确保复制出的图层是可见的（模板层已被隐藏）
  var dupLayer = Layer.getSelectedLayers()[0];
  dupLayer.show();
  return dupLayer;
}

/**
 * 选中指定 ID 的图层
 */
function selectLayerById(layerId: number): void {
  var selectDesc = new ActionDescriptor();
  var selectRef = new ActionReference();
  selectRef.putIdentifier(charIDToTypeID("Lyr "), layerId);
  selectDesc.putReference(charIDToTypeID("null"), selectRef);
  selectDesc.putBoolean(charIDToTypeID("MkVs"), false);
  executeAction(charIDToTypeID("slct"), selectDesc, DialogModes.NO);
}

/**
 * 原地复制当前选中的图层
 */
function duplicateActiveLayer(): void {
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
}

/**
 * 复制指定 ID 的图层，返回新图层 ID（复制后新图层为选中状态）
 * 避免通过 putIdentifier 叠加引用推断 ID，直接读取文档 activeLayer.id
 */
export function duplicateLayerById(layerId: number): number {
  selectLayerById(layerId);
  duplicateActiveLayer();
  return app.activeDocument.activeLayer.id;
}

/**
 * 查询图层自身的 ID 属性（layer.id 是属性，不是方法）
 */
export function getLayerId(layer: any): number {
  return layer.id;
}

/**
 * 按 ID 读取当前文档中图层的 bounds（含图层效果，不改变选中状态）
 * @param layerId 图层 ID
 * @returns Rect { x, y, width, height }
 */
export function getBoundsById(layerId: number): any {
  var ref = new ActionReference();
  ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("bounds"));
  ref.putIdentifier(charIDToTypeID("Lyr "), layerId);
  var desc = executeActionGet(ref);
  var rect = desc.getObjectValue(stringIDToTypeID("bounds"));
  var left = rect.getUnitDoubleValue(charIDToTypeID("Left"));
  var top = rect.getUnitDoubleValue(charIDToTypeID("Top "));
  var right = rect.getUnitDoubleValue(charIDToTypeID("Rght"));
  var bottom = rect.getUnitDoubleValue(charIDToTypeID("Btom"));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * 按 ID 删除当前文档中的图层
 * 与 ps-api Layer.remove() 使用同一 ActionManager 序列（targetEnum + layerID 列表），保证兼容性
 */
export function removeLayerById(layerId: number): void {
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putEnumerated(
    stringIDToTypeID("layer"),
    stringIDToTypeID("ordinal"),
    stringIDToTypeID("targetEnum")
  );
  desc.putReference(stringIDToTypeID("null"), ref);
  var idList = new ActionList();
  idList.putInteger(layerId);
  desc.putList(stringIDToTypeID("layerID"), idList);
  executeAction(stringIDToTypeID("delete"), desc, DialogModes.NO);
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
 * 对锚点偏移做边距钳制：把内容夹在 [padStart, canvasSize - boxSize - padEnd] 区间内
 * 统一轴上画布尺寸由统一尺寸决定（存在松弛空间），锚点选择照常生效；
 * 裁剪轴上画布尺寸 = ceil(内容) + 边距（松弛空间 = 两侧边距之和），锚点退化为钳制边界
 *
 * boxSize 取 Math.ceil(contentSize)，保证裁剪轴上内容落点仍为整数像素
 * （否则 canvas = ceil(content) + 边距 会留下亚像素松弛，使留白左右不均）
 * @param offset 期望偏移（来自 calcAnchorOffsetX/Y）
 * @param contentSize 内容实际尺寸（bounds 的宽或高，可为小数）
 * @param canvasSize 画布尺寸
 * @param padStart 起始侧对齐边距（左 / 上）
 * @param padEnd 结束侧对齐边距（右 / 下）
 * @returns 钳制后的偏移量
 */
export function clampAnchorOffset(
  offset: number,
  contentSize: number,
  canvasSize: number,
  padStart: number,
  padEnd: number
): number {
  var boxSize = contentSize;
  if (Math.ceil(contentSize) >= canvasSize) {
    // 裁剪轴上 canvas = ceil(content) + 边距：仅在内容尺寸正好为整数时取整余量为 0，
    // 此时若按 content 计算会留下亚像素松弛，导致留白左右不均，故改用 ceil 作为盒尺寸
    boxSize = Math.ceil(contentSize);
  }
  var maxOffset = canvasSize - boxSize - padEnd;
  if (maxOffset < padStart) {
    // box + 边距超出画布（内容尺寸正好为整数时的取整余量）：优先保证起始侧边距
    return padStart;
  }
  var result = offset;
  if (result < padStart) {
    result = padStart;
  }
  if (result > maxOffset) {
    result = maxOffset;
  }
  return result;
}

/**
 * 计算某一轴的画布尺寸
 * @param contentSize 内容实际尺寸（bounds 的宽或高）
 * @param unifiedSize 该轴统一尺寸（统一轴传入；裁剪轴传 0）
 * @param isUnified 该轴是否参与统一画布
 * @param padding 画布延长边距（paddingW / paddingH）
 * @param padStart 起始侧对齐边距（左 / 上）
 * @param padEnd 结束侧对齐边距（右 / 下）
 * @returns 画布尺寸；<= 0 表示该轴无尺寸（调用方应跳过该项）
 */
export function calcAxisCanvasSize(
  contentSize: number,
  unifiedSize: number,
  isUnified: boolean,
  padding: number,
  padStart: number,
  padEnd: number
): number {
  if (isUnified) {
    if (unifiedSize > 0) {
      return unifiedSize;
    }
    return 0;
  }
  return Math.ceil(contentSize) + padding + padStart + padEnd;
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
