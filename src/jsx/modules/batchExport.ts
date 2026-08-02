/**
 * batchExport.ts - 批量导出模块
 * 提供文本图层字体信息读取和批量字符导出功能
 *
 * 所有 ps-api 类统一从 index.ts 导入，避免多路径引用导致的模块冲突
 */

import { Document, Layer } from "../ps-api/src/index";
import { ensureDirectory } from "./fileOps";
import { duplicateSourceLayer, duplicateLayer, resizeCanvasWithAnchor, translateLayerBy, calcAnchorOffsetX, calcAnchorOffsetY, sanitizeFilenameChar } from "./exportUtils";

function componentToHex(c: number): string {
  var hex = c.toString(16).toUpperCase();
  return hex.length === 1 ? "0" + hex : hex;
}

function getTextLayerColorHex(): string {
  try {
    var c2t = charIDToTypeID;
    var s2t = stringIDToTypeID;
    var layer = app.activeDocument.activeLayer;
    var layerId = layer.id;
    var ref = new ActionReference();
    ref.putIdentifier(c2t("Lyr "), layerId);
    var desc = executeActionGet(ref);

    if (!desc.hasKey(s2t("textKey"))) {
      return "#000000";
    }

    var textKey = desc.getObjectValue(s2t("textKey"));
    if (!textKey.hasKey(s2t("textStyleRange"))) {
      return "#000000";
    }

    var textStyleRange = textKey.getList(s2t("textStyleRange"));
    if (textStyleRange.count === 0) {
      return "#000000";
    }

    var textStyleObj = textStyleRange.getObjectValue(0);
    if (!textStyleObj.hasKey(s2t("textStyle"))) {
      return "#000000";
    }

    var textStyle = textStyleObj.getObjectValue(s2t("textStyle"));
    if (!textStyle.hasKey(s2t("color"))) {
      return "#000000";
    }

    var colorObj = textStyle.getObjectValue(s2t("color"));

    var r: number;
    var g: number;
    var b: number;

    var redFloatKey = s2t("redFloat");
    var greenFloatKey = s2t("greenFloat");
    var blueFloatKey = s2t("blueFloat");

    var redKey = s2t("red");
    var greenKey = s2t("grain");
    var blueKey = s2t("blue");

    if (colorObj.hasKey(redFloatKey) && colorObj.hasKey(greenFloatKey) && colorObj.hasKey(blueFloatKey)) {
      r = colorObj.getDouble(redFloatKey);
      g = colorObj.getDouble(greenFloatKey);
      b = colorObj.getDouble(blueFloatKey);
      r = Math.min(Math.round(r * 255), 255);
      g = Math.min(Math.round(g * 255), 255);
      b = Math.min(Math.round(b * 255), 255);
    } else if (colorObj.hasKey(redKey) && colorObj.hasKey(greenKey) && colorObj.hasKey(blueKey)) {
      r = Math.round(colorObj.getDouble(redKey));
      g = Math.round(colorObj.getDouble(greenKey));
      b = Math.round(colorObj.getDouble(blueKey));
    } else {
      return "#000000";
    }

    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
  } catch (e) {
    return "#000000";
  }
}

/**
 * 获取选中文本图层的字体信息
 * @returns JSON 字符串
 */
/**
 * 效果 stringID → 中文名称映射
 */
var EFFECT_NAMES: { [key: string]: string } = {};
EFFECT_NAMES["solidFill"] = "颜色叠加";
EFFECT_NAMES["gradientFill"] = "渐变叠加";
EFFECT_NAMES["patternFill"] = "图案叠加";
EFFECT_NAMES["dropShadow"] = "投影";
EFFECT_NAMES["innerShadow"] = "内阴影";
EFFECT_NAMES["outerGlow"] = "外发光";
EFFECT_NAMES["innerGlow"] = "内发光";
EFFECT_NAMES["bevelEmboss"] = "斜面浮雕";
EFFECT_NAMES["chromeFX"] = "光泽";
EFFECT_NAMES["frameFX"] = "描边";

/**
 * 检查单个效果 descriptor 是否 enabled
 */
function isEffectEnabled(effect: any): boolean {
  try { return effect.getBoolean(stringIDToTypeID("enabled")); } catch (e) { return false; }
}

/**
 * 获取图层启用的效果名称列表（仅名称，不读参数）
 * 支持普通 key 和 *Multi 数组格式
 */
function getEnabledEffects(layer: any): string[] {
  try {
    var s2t = stringIDToTypeID;
    var ref = new ActionReference();
    ref.putIdentifier(charIDToTypeID("Lyr "), layer.id);
    var desc = executeActionGet(ref);

    // 检查 FX 眼睛是否可见
    var fxVisible = true;
    try { fxVisible = desc.getBoolean(s2t("layerFXVisible")); } catch (e) { /* 忽略 */ }
    var hasEffects = desc.hasKey(s2t("layerEffects"));
    if (!hasEffects || !fxVisible) {
      return [];
    }

    var layerEffects = desc.getObjectValue(s2t("layerEffects"));
    var result: string[] = [];

    // 单值效果：key 直接是效果 descriptor
    var singleKeys = ["solidFill", "dropShadow", "outerGlow", "innerGlow", "bevelEmboss", "chromeFX"];

    for (var i = 0; i < singleKeys.length; i++) {
      var key = singleKeys[i];
      if (layerEffects.hasKey(s2t(key))) {
        var effect = layerEffects.getObjectValue(s2t(key));
        if (isEffectEnabled(effect)) {
          result.push(EFFECT_NAMES[key]);
        }
      }
    }

    // 多值效果（*Multi 数组）：key 是数组，每项是 { "effectKey": {...} }
    var multiKeys = ["gradientFill", "innerShadow", "frameFX", "patternFill"];

    for (var j = 0; j < multiKeys.length; j++) {
      var mKey = multiKeys[j];
      var multiKey = mKey + "Multi";
      if (layerEffects.hasKey(s2t(multiKey))) {
        var list = layerEffects.getList(s2t(multiKey));
        for (var k = 0; k < list.count; k++) {
          var item = list.getObjectValue(k);
          if (item.hasKey(s2t(mKey))) {
            var mEffect = item.getObjectValue(s2t(mKey));
            if (isEffectEnabled(mEffect)) {
              var mName = EFFECT_NAMES[mKey];
              if (result.indexOf(mName) === -1) {
                result.push(mName);
              }
            }
          }
        }
      }
    }

    return result;
  } catch (e) {
    return [];
  }
}

export function getTextLayerInfo(): string {
  try {
    if (app.documents.length === 0) {
      return "__NO_DOCUMENT__";
    }

    var layers = Layer.getSelectedLayers();
    if (layers.length === 0) {
      return "__ERROR__:未选中任何图层，请在 PS 中选中一个文本图层";
    }

    var layer = layers[0];

    // 检查图层类型
    var kind = 0;
    try {
      kind = layer.kind();
    } catch (e1) {
      return "__ERROR__:读取图层类型失败 - " + e1;
    }

    if (kind !== 3) {
      var kindNames: { [key: number]: string } = {};
      kindNames[1] = "像素图层";
      kindNames[2] = "图层组";
      kindNames[3] = "文本图层";
      kindNames[4] = "形状图层";
      kindNames[5] = "智能对象";
      var kindName = kindNames[kind];
      if (!kindName) {
        kindName = "未知类型";
      }
      return "__ERROR__:请选中一个文本图层。当前选中为" + kindName + "（类型" + kind + "），不支持导出";
    }

    // 读取文本对象
    var text = null;
    try {
      text = layer.text();
    } catch (e2) {
      return "__ERROR__:读取文本信息失败 - " + e2;
    }

    if (text === null) {
      return "__ERROR__:无法读取文本图层信息";
    }

    // 逐项读取字体属性
    var hexColor = getTextLayerColorHex();

    var fontName = "";
    try { fontName = text.fontName(); } catch (e) { /* 忽略 */ }

    var fontStyle = "";
    try { fontStyle = text.fontStyleName(); } catch (e) { /* 忽略 */ }

    var fontScriptName = "";
    try { fontScriptName = text.fontPostScriptName(); } catch (e) { /* 忽略 */ }

    // 检测字体是否已安装
    var fontAvailable = true;
    try {
      var faRef = new ActionReference();
      faRef.putIdentifier(charIDToTypeID("Lyr "), layer.id);
      var faDesc = executeActionGet(faRef);
      if (faDesc.hasKey(stringIDToTypeID("textKey"))) {
        var faTextKey = faDesc.getObjectValue(stringIDToTypeID("textKey"));
        if (faTextKey.hasKey(stringIDToTypeID("textStyleRange"))) {
          var faRangeList = faTextKey.getList(stringIDToTypeID("textStyleRange"));
          if (faRangeList.count > 0) {
            var faRangeObj = faRangeList.getObjectValue(0);
            if (faRangeObj.hasKey(stringIDToTypeID("textStyle"))) {
              var faStyle = faRangeObj.getObjectValue(stringIDToTypeID("textStyle"));
              if (faStyle.hasKey(stringIDToTypeID("fontAvailable"))) {
                fontAvailable = faStyle.getBoolean(stringIDToTypeID("fontAvailable"));
              }
            }
          }
        }
      }
    } catch (e) { /* 忽略 */ }

    var fontSize = 12;
    try { fontSize = Math.round(text.size() * 100) / 100; } catch (e) { /* 忽略 */ }

    var hasBold = false;
    try { hasBold = text.bold(); } catch (e) { /* 忽略 */ }

    var hasItalic = false;
    try { hasItalic = text.italic(); } catch (e) { /* 忽略 */ }

    var hScale = 100;
    try { hScale = text.horizontalScale(); } catch (e) { /* 忽略 */ }
    if (hScale === 0 || hScale === undefined) {
      hScale = 100;
      try {
        var baseParentStyle = text.styleDesc.getObjectValue(app.stringIDToTypeID("baseParentStyle"));
        if (baseParentStyle.hasKey(app.stringIDToTypeID("horizontalScale"))) {
          hScale = baseParentStyle.getDouble(app.stringIDToTypeID("horizontalScale"));
        }
      } catch (e) { /* 忽略 */ }
    }

    var vScale = 100;
    try { vScale = text.verticalScale(); } catch (e) { /* 忽略 */ }
    if (vScale === 0 || vScale === undefined) {
      vScale = 100;
      try {
        var baseParentStyle = text.styleDesc.getObjectValue(app.stringIDToTypeID("baseParentStyle"));
        if (baseParentStyle.hasKey(app.stringIDToTypeID("verticalScale"))) {
          vScale = baseParentStyle.getDouble(app.stringIDToTypeID("verticalScale"));
        }
      } catch (e) { /* 忽略 */ }
    }

    var lineHeight = -1;
    try { lineHeight = text.lineHeight(); } catch (e) { /* 忽略 */ }
    var isAutoLeading = lineHeight === -1;

    var layerName = "";
    try { layerName = layer.name(); } catch (e) { /* 忽略 */ }

    // 读取抗锯齿设置（默认 Smooth）
    var antiAlias = "antiAliasSmooth";
    try {
      var aaRef = new ActionReference();
      aaRef.putIdentifier(charIDToTypeID("Lyr "), layer.id);
      var aaDesc = executeActionGet(aaRef);
      if (aaDesc.hasKey(stringIDToTypeID("textKey"))) {
        var textKeyDesc = aaDesc.getObjectValue(stringIDToTypeID("textKey"));
        if (textKeyDesc.hasKey(stringIDToTypeID("antiAlias"))) {
          var aaEnum = textKeyDesc.getEnumerationValue(stringIDToTypeID("antiAlias"));
          antiAlias = typeIDToStringID(aaEnum);
        }
      }
    } catch (e) { /* 忽略 */ }

    // 读取图层不透明度 (0-255)
    var layerOpacity = 255;
    try { layerOpacity = layer.opacity(); } catch (e) { /* 忽略 */ }

    var activeEffects = getEnabledEffects(layer);

    var info = {
      fontName: fontName,
      fontStyle: fontStyle,
      fontScriptName: fontScriptName,
      fontSize: fontSize,
      color: hexColor,
      syntheticBold: hasBold,
      syntheticItalic: hasItalic,
      horizontalScale: hScale,
      verticalScale: vScale,
      autoLeading: isAutoLeading,
      lineHeight: lineHeight,
      layerId: layer.id,
      layerName: layerName,
      fontAvailable: fontAvailable,
      antiAlias: antiAlias,
      opacity: layerOpacity,
      activeEffects: activeEffects,
    };

    return JSON.stringify(info);
  } catch (e) {
    return "__ERROR__:" + e;
  }
}

/**
 * 批量导出文本图层中的每个字符为独立图片
 * @param configJson 导出配置 JSON 字符串
 * @returns JSON 字符串
 */
export function batchExport(configJson: string): string {
  try {
    if (app.documents.length === 0) {
      return "__NO_DOCUMENT__";
    }

    var config = JSON.parse(configJson);
    var items = config.items;
    var prefix = config.prefix;
    var format = config.format;
    var sizeMode = config.sizeMode;
    var exportWidth = config.exportWidth;
    var exportHeight = config.exportHeight;
    var paddingW = config.paddingW;
    var paddingH = config.paddingH;
    var padT = config.paddingTop != null ? config.paddingTop : 0;
    var padR = config.paddingRight != null ? config.paddingRight : 0;
    var padB = config.paddingBottom != null ? config.paddingBottom : 0;
    var padL = config.paddingLeft != null ? config.paddingLeft : 0;
    var anchor = config.anchor;
    var outputDir = config.outputDir;

    // 确保输出目录存在
    var dirResult = ensureDirectory(outputDir);
    if (dirResult !== "__OK__") {
      return dirResult;
    }

    // 保存源文档和图层引用（创建 workDoc 后 activeDocument 会变）
    var srcDoc = app.activeDocument;
    var srcLayerId = srcDoc.activeLayer.id;

    // 全局关闭 PS 对话框（字体缺失等不弹窗，自动用默认字体替换）
    var oldDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    // ==================== Phase 1: 创建测量文档 + 模板层 ====================
    var workDocSize = calcWorkDocSize(config.fontSize);
    var workDoc = Document.create("_batch", workDocSize, workDocSize, 72, false, false);

    // 跨文档复制源图层到工作文档作为模板
    var templateLayer = duplicateSourceLayer(srcDoc, srcLayerId, "_batch");
    // normalize: 将模板层平移到 workDoc 原点 (0,0)，消除源文档绝对坐标影响
    var templateBounds = templateLayer.bounds();
    translateLayerBy(-templateBounds.x, -templateBounds.y);
    // 隐藏模板层，防止原始文字残留到导出图中
    templateLayer.hide();

    var measuredChars: Array<{
      text: string;
      name: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }> = [];
    var maxW = 0;
    var maxH = 0;

    // ==================== Phase 2: 逐字符测量（仅自动模式） ====================
    if (sizeMode === "auto") {
      for (var i = 0; i < items.length; i++) {
        var itemText = items[i].text;
        var itemName = items[i].name || sanitizeFilenameChar(itemText);

        // 复制模板层 → 改文字（属性/效果/不透明度全保留）
        var layer = duplicateLayer(templateLayer.id);
        changeLayerText(itemText);

        var bounds = layer.bounds();
        var charW = Math.ceil(bounds.width);
        var charH = Math.ceil(bounds.height);

        measuredChars.push({
          text: itemText,
          name: itemName,
          x: bounds.x,
          y: bounds.y,
          w: charW,
          h: charH,
        });

        if (charW > maxW) {
          maxW = charW;
        }
        if (charH > maxH) {
          maxH = charH;
        }

        try {
          layer.remove();
        } catch (eRemove) {
          // 删除失败不阻断流程
        }
      }
    }

    // 计算最终画布尺寸
    var finalW = maxW;
    var finalH = maxH;

    if (sizeMode === "auto") {
      finalW = maxW + paddingW + padL + padR;
      finalH = maxH + paddingH + padT + padB;
    } else {
      if (exportWidth > 0) {
        finalW = exportWidth;
      }
      if (exportHeight > 0) {
        finalH = exportHeight;
      }
    }

    // ==================== Phase 3: 缩小画布到目标尺寸 ====================
    // raw ActionManager: resizeCanvas，使用 top-left 锚点保证原点仍在 (0,0)
    resizeCanvasWithAnchor(
      workDoc,
      finalW,
      finalH,
      charIDToTypeID("Left"),
      charIDToTypeID("Top ")
    );

    // ==================== Phase 4: 逐字符导出 ====================
    var isPng = format === "png";
    var ext = isPng ? ".png" : ".jpg";
    var exportCount = 0;

    if (sizeMode === "auto") {
      // 自动模式：遍历测量结果
      for (var j = 0; j < measuredChars.length; j++) {
        var measured = measuredChars[j];
        var expTextStr = measured.text;
        var expName = measured.name;

        // 复制模板层 → 改文字（属性/效果/不透明度全保留）
        var exportLayer = duplicateLayer(templateLayer.id);
        changeLayerText(expTextStr);

        var exportBounds = exportLayer.bounds();

        // 计算偏移（传入对齐边距）
        var translateX = calcAnchorOffsetX(
          anchor,
          exportBounds.x,
          exportBounds.width,
          finalW,
          padL,
          padR
        );
        var translateY = calcAnchorOffsetY(
          anchor,
          exportBounds.y,
          exportBounds.height,
          finalH,
          padT,
          padB
        );

        // 检查移动后的边界，避免文本超出画布（含对齐边距）
        var movedTop = exportBounds.y + translateY;
        var movedBottom = exportBounds.y + exportBounds.height + translateY;
        var movedLeft = exportBounds.x + translateX;
        var movedRight = exportBounds.x + exportBounds.width + translateX;

        if (exportBounds.height <= finalH) {
          if (movedTop < padT) {
            translateY -= movedTop - padT;
          } else if (movedBottom > finalH - padB) {
            translateY -= movedBottom - (finalH - padB);
          }
        }
        if (exportBounds.width <= finalW) {
          if (movedLeft < padL) {
            translateX -= movedLeft - padL;
          } else if (movedRight > finalW - padR) {
            translateX -= movedRight - (finalW - padR);
          }
        }

        // 平移图层
        translateLayerBy(translateX, translateY);

        // 导出文件名
        var filename = prefix + expName + ext;

        // saveAs 使用 PS 主渲染引擎，避免 Save for Web 的文本裁切 bug
        var filePath1 = outputDir + "/" + filename;
        if (isPng) {
          // @ts-ignore
          workDoc.saveAs(filePath1, "PNGFormat", true);
        } else {
          // @ts-ignore
          workDoc.saveAs(filePath1, "JPEG", true);
        }

        try {
          exportLayer.remove();
        } catch (eRemove) {
          // 删除失败不阻断流程
        }

        exportCount++;
      }
    } else {
      // 手动模式：直接遍历 items，跳过单独测量阶段
      for (var k = 0; k < items.length; k++) {
        var itemText2 = items[k].text;
        var itemName2 = items[k].name || sanitizeFilenameChar(itemText2);

        // 复制模板层 → 改文字（属性/效果/不透明度全保留）
        var exportLayer2 = duplicateLayer(templateLayer.id);
        changeLayerText(itemText2);

        var exportBounds2 = exportLayer2.bounds();
        var charW2 = Math.ceil(exportBounds2.width);
        var charH2 = Math.ceil(exportBounds2.height);

        // 顺带统计最大尺寸（用于结果展示）
        if (charW2 > maxW) maxW = charW2;
        if (charH2 > maxH) maxH = charH2;

        // 计算偏移（传入对齐边距）
        var translateX2 = calcAnchorOffsetX(
          anchor,
          exportBounds2.x,
          exportBounds2.width,
          finalW,
          padL,
          padR
        );
        var translateY2 = calcAnchorOffsetY(
          anchor,
          exportBounds2.y,
          exportBounds2.height,
          finalH,
          padT,
          padB
        );

        // 检查移动后的边界，避免文本超出画布（含对齐边距）
        var movedTop2 = exportBounds2.y + translateY2;
        var movedBottom2 = exportBounds2.y + exportBounds2.height + translateY2;
        var movedLeft2 = exportBounds2.x + translateX2;
        var movedRight2 = exportBounds2.x + exportBounds2.width + translateX2;

        if (exportBounds2.height <= finalH) {
          if (movedTop2 < padT) {
            translateY2 -= movedTop2 - padT;
          } else if (movedBottom2 > finalH - padB) {
            translateY2 -= movedBottom2 - (finalH - padB);
          }
        }
        if (exportBounds2.width <= finalW) {
          if (movedLeft2 < padL) {
            translateX2 -= movedLeft2 - padL;
          } else if (movedRight2 > finalW - padR) {
            translateX2 -= movedRight2 - (finalW - padR);
          }
        }

        // 平移图层
        translateLayerBy(translateX2, translateY2);

        // 导出文件名
        var filename2 = prefix + itemName2 + ext;

        // saveAs 使用 PS 主渲染引擎，避免 Save for Web 的文本裁切 bug
        var filePath2 = outputDir + "/" + filename2;
        if (isPng) {
          // @ts-ignore
          workDoc.saveAs(filePath2, "PNGFormat", true);
        } else {
          // @ts-ignore
          workDoc.saveAs(filePath2, "JPEG", true);
        }

        try {
          exportLayer2.remove();
        } catch (eRemove) {
          // 删除失败不阻断流程
        }

        exportCount++;
      }
    }

    // 关闭工作文档
    workDoc.close(false);

    var result = {
      total: exportCount,
      maxWidth: maxW,
      maxHeight: maxH,
      outputDir: outputDir,
    };

    app.displayDialogs = oldDialogs;
    return JSON.stringify(result);
  } catch (e) {
    // 恢复对话框设置
    try { app.displayDialogs = oldDialogs; } catch (e2) { /* 忽略 */ }
    // 清理：确保工作文档被关闭，避免残留 _batch 文档
    try {
      var openDocs = app.documents;
      for (var d = 0; d < openDocs.length; d++) {
        var docName = openDocs[d].name;
        if (docName.indexOf("_batch") === 0) {
          openDocs[d].close(SaveOptions.DONOTSAVECHANGES);
        }
      }
    } catch (eCleanup) {
      // 清理失败忽略
    }
    return "__ERROR__:" + e;
  }
}

/**
 * 单独检测字符尺寸（仅测量，不导出）
 * 复用 batchExport 的测量逻辑，返回 maxW 和 maxH
 * @param configJson 配置 JSON 字符串（需要 font 属性 + characters）
 * @returns JSON { maxWidth, maxHeight }
 */
export function measureCharacters(configJson: string): string {
  try {
    if (app.documents.length === 0) {
      return "__NO_DOCUMENT__";
    }

    var config = JSON.parse(configJson);
    var items = config.items;

    // 保存源文档和图层引用
    var srcDoc = app.activeDocument;
    var srcLayerId = srcDoc.activeLayer.id;

    // 全局关闭 PS 对话框
    var oldDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    var workDocSize = calcWorkDocSize(config.fontSize);
    var workDoc = Document.create("_measure", workDocSize, workDocSize, 72, false, false);

    // 跨文档复制源图层到工作文档作为模板
    var templateLayer = duplicateSourceLayer(srcDoc, srcLayerId, "_measure");
    // 隐藏模板层，防止原始文字残留
    templateLayer.hide();

    var maxW = 0;
    var maxH = 0;

    for (var i = 0; i < items.length; i++) {
      var ch = items[i].text;

      // 复制模板层 → 改文字（属性/效果/不透明度全保留）
      var layer = duplicateLayer(templateLayer.id);
      changeLayerText(ch);

      var bounds = layer.bounds();
      var charW = Math.ceil(bounds.width);
      var charH = Math.ceil(bounds.height);

      if (charW > maxW) maxW = charW;
      if (charH > maxH) maxH = charH;

      try { layer.remove(); } catch (e) { /* 忽略 */ }
    }

    workDoc.close(false);

    app.displayDialogs = oldDialogs;
    return JSON.stringify({ maxWidth: maxW, maxHeight: maxH });
  } catch (e) {
    try { app.displayDialogs = oldDialogs; } catch (e2) { /* 忽略 */ }
    return "__ERROR__:" + e;
  }
}

/**
 * 修改当前选中图层的文本内容
 */
function changeLayerText(content: string): void {
  var layer = app.activeDocument.activeLayer as any;
  layer.textItem.contents = content;
}

/**
 * 根据字号动态计算工作文档尺寸
 * 确保单个字符（含图层效果）能完整放下
 */
function calcWorkDocSize(fontSize: number): number {
  var size = Math.round(fontSize * 6 + 200);
  if (size < 2000) size = 2000;
  if (size > 10000) size = 10000;
  return size;
}


