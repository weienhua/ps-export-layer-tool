/**
 * batchExport.ts - 批量导出模块
 * 提供文本图层字体信息读取和批量字符导出功能
 *
 * 所有 ps-api 类统一从 index.ts 导入，避免多路径引用导致的模块冲突
 */

import { Document, Layer } from "../ps-api/src/index";
import { ensureDirectory } from "./fileOps";
import { removeLayerById, duplicateSourceLayer, duplicateLayer, resizeCanvasWithAnchor, translateLayerBy, calcAnchorOffsetX, calcAnchorOffsetY, clampAnchorOffset, calcAxisCanvasSize, calcAdvanceWidth, pickModeInkFrame, sanitizeFilenameChar } from "./exportUtils";

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

    // ===== 对齐基准（按轴，004） =====
    // 水平基准：缺省 ink（每张内容横向居中）；显式 "layout" 才按字宽（等字宽素材共有字形同 x）
    // 垂直基准：缺省 layout（整组基线一致）；显式 "ink" 才逐项墨迹居中
    // 兼容旧数据：只有 alignMode 时两轴都继承它
    var alignModeX = config.alignModeX;
    var alignModeY = config.alignModeY;
    if (alignModeX == null) { alignModeX = config.alignMode; }
    if (alignModeY == null) { alignModeY = config.alignMode; }
    var layoutXRequested = alignModeX === "layout";
    var layoutYRequested = alignModeY !== "ink";

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

    // 模板层是否为点文本：段落文本有固定文本框，字宽差值法会失真 → 水平轴退回墨迹（垂直轴不受影响）
    var templateIsPointText = true;
    if (layoutXRequested) {
      templateIsPointText = isPointTextLayer(templateLayer);
    }

    // ==================== Phase 2: 逐项测量 ====================
    // 任一侧需要排印框（或在自动尺寸下）都要测量；水平 ink 时可跳过字宽探测
    var needAdvance = layoutXRequested && anchorNeedsWidthReference(anchor);
    var layoutXPre = layoutXRequested && templateIsPointText;
    var measured = emptyMeasurement();
    if (sizeMode === "auto" || layoutXRequested || layoutYRequested) {
      measured = measureItemSet(
        templateLayer.id,
        items,
        layoutXPre,
        layoutYRequested,
        needAdvance
      );
    }

    // 统一画布尺寸（仅统计该轴参与统一的项，两轴可以来自不同项）
    var maxW = measured.maxW;
    var maxH = measured.maxH;
    var unifiedWCount = measured.unifiedWCount;
    var unifiedHCount = measured.unifiedHCount;
    var advWidths = measured.advWidths;

    // 水平排印框是否真正生效（段落文本 / 多行文本会退回墨迹，并记录原因）；垂直轴恒可用
    var layoutXEffective = layoutXPre && measured.advanceUsable;
    var layoutYEffective = layoutYRequested;
    var alignFallback = "";
    if (layoutXRequested && !layoutXEffective) {
      if (!templateIsPointText) {
        alignFallback = "x:paragraph-text";
      } else {
        alignFallback = "x:" + measured.advanceReason;
      }
    }

    // 纵向参考框：组内众数墨迹框，无众数（各项都不同）时退回并集框
    var layoutRefTop = measured.unionTop;
    var layoutRefH = measured.unionH;
    if (layoutYEffective && unifiedHCount > 0) {
      var modeFrame = pickModeInkFrame(pickUnifiedHeightBoxes(items, measured.boxes));
      if (modeFrame) {
        layoutRefTop = modeFrame.top;
        layoutRefH = modeFrame.height;
      }
    }

    // 计算统一画布尺寸（两轴各自基于参与统一的项；该轴无统一项时返回 0）
    var finalW = 0;
    var finalH = 0;

    if (sizeMode === "auto") {
      if (unifiedWCount > 0) {
        finalW = maxW + paddingW + padL + padR;
      }
      if (unifiedHCount > 0) {
        finalH = maxH + paddingH + padT + padB;
      }
    } else {
      if (exportWidth > 0) {
        finalW = exportWidth;
      }
      if (exportHeight > 0) {
        finalH = exportHeight;
      }
    }

    // ==================== Phase 3 + Phase 4: 逐项按轴定位后导出 ====================
    // 画布尺寸按轴决定：统一轴用统一尺寸，裁剪轴用「内容 + 两层边距」；
    // 画布尺寸变化时才 resize（top-left 锚点保证原点仍在 (0,0)）
    var tplW = Math.ceil(templateBounds.width);
    var tplH = Math.ceil(templateBounds.height);
    if (sizeMode === "auto" && finalW === 0) {
      finalW = tplW + paddingW + padL + padR;
    }
    if (sizeMode === "auto" && finalH === 0) {
      finalH = tplH + paddingH + padT + padB;
    }

    var isPng = format === "png";
    var ext = isPng ? ".png" : ".jpg";
    var exportCount = 0;
    var trimmedCount = 0;
    var skippedCount = 0;
    var lastSkipReason = "";

    // 画布尺寸跟踪：初始化时的 workDocSize 已是实际画布尺寸，后续按需 resize
    var canvasW = workDocSize;
    var canvasH = workDocSize;

    // 排印框模式：整组共用的纵向位移（首个统一高项时计算一次）
    var layoutYOffset = 0;
    var layoutYReady = false;

    for (var j = 0; j < items.length; j++) {
      var expItem = items[j];
      var expTextStr = expItem.text;
      var expName = expItem.name || sanitizeFilenameChar(expTextStr);

      var itemUnifyW = isUnifyAxis(expItem.unifyWidth);
      var itemUnifyH = isUnifyAxis(expItem.unifyHeight);

      if (!itemUnifyW || !itemUnifyH) {
        trimmedCount++;
      }

      // 复制模板层 → 改文字（属性/效果/不透明度全保留）
      // 使用 duplicateLayer：其内部会调用 show()，避免复制出隐藏图层导致导出空白
      var exportLayer = duplicateLayer(templateLayer.id);
      changeLayerText(expTextStr);

      var exportBounds = exportLayer.bounds();
      var boundsW = Math.ceil(exportBounds.width);
      var boundsH = Math.ceil(exportBounds.height);

      // 空文本 / 无有效内容：跳过，避免生成 0 尺寸素材
      if (boundsW <= 0 || boundsH <= 0) {
        skippedCount++;
        lastSkipReason = "empty-bounds " + boundsW + "x" + boundsH;
        try {
          exportLayer.remove();
        } catch (eRemoveSkip) {
          // 忽略
        }
        continue;
      }

      // 按轴计算本项画布尺寸
      var itemCanvasW = calcAxisCanvasSize(exportBounds.width, finalW, itemUnifyW, paddingW, padL, padR);
      var itemCanvasH = calcAxisCanvasSize(exportBounds.height, finalH, itemUnifyH, paddingH, padT, padB);

      if (itemCanvasW <= 0 || itemCanvasH <= 0) {
        skippedCount++;
        lastSkipReason = "zero-canvas " + itemCanvasW + "x" + itemCanvasH + " unifiedW=" + itemUnifyW + " unifiedH=" + itemUnifyH + " final=" + finalW + "x" + finalH;
        try {
          exportLayer.remove();
        } catch (eRemoveSkip2) {
          // 忽略
        }
        continue;
      }

      ensureCanvasSize(workDoc as any, itemCanvasW, itemCanvasH, canvasW, canvasH);
      canvasW = itemCanvasW;
      canvasH = itemCanvasH;

      // ===== 定位参考（按轴选） =====
      // 水平 layout：参考宽取「排印框 ∪ 墨迹框」的最大值
      //   墨迹 ≤ 排印宽（普通字形）：用排印宽 → 等字宽素材的共有字形落点一致（004）
      //   墨迹 > 排印宽（图层效果 / 溢出笔画，如带描边的数字、句点）：用墨迹宽 → 可见内容仍居中；
      //     否则会按比可见内容更窄的排印盒居中，把内容整体推偏（004 实测：数字偏右且贴边）
      // 水平 ink：逐项墨迹框居中（每张内容横向居中）
      // 垂直 layout：整组常量位移（基线一致）；垂直 ink：逐项墨迹框居中
      // 未勾选（裁剪）轴：两种情况下都保持现状（003）
      var itemIsLayoutW = layoutXEffective && itemUnifyW;
      var itemIsLayoutH = layoutYEffective && itemUnifyH;

      var refW = exportBounds.width;
      if (itemIsLayoutW && advWidths[j] > 0) {
        refW = advWidths[j];
        if (exportBounds.width > refW) {
          refW = exportBounds.width;
        }
      }
      var clampBoxW = refW;
      if (exportBounds.width > clampBoxW) {
        clampBoxW = exportBounds.width;
      }

      var translateX = calcAnchorOffsetX(anchor, exportBounds.x, refW, itemCanvasW, padL, padR);
      // 统一轴：画布已按内容/字宽定过尺寸（自动）或用户指定（手动）。
      // 居中偏移**可以为负**（内容自然位置就在理想位置右侧，例如左空边较大的「月/日」），
      // 此时按「偏移」钳制会把内容钉在左边 —— 004 实测：会偏右 8~16px。
      // 所以只有画布真的装不下内容时才钳制兜底；裁剪轴沿用原样（003 逐像素不变）。
      if (!itemUnifyW || itemCanvasW < clampBoxW) {
        translateX = clampAnchorOffset(translateX, clampBoxW, itemCanvasW, padL, padR);
      }

      var translateY: number;
      if (itemIsLayoutH) {
        // 整组共用同一常量：只在首个统一高项上算一次（纵向钳制同样只算这一次）
        if (!layoutYReady) {
          var rawLayoutY = calcAnchorOffsetY(anchor, layoutRefTop, layoutRefH, itemCanvasH, padT, padB);
          // 同理：只有画布装不下整组内容时才钳制（否则常量位移会被推偏，破坏基线一致）
          if (itemCanvasH < measured.unionH) {
            rawLayoutY = clampAnchorOffset(rawLayoutY, measured.unionH, itemCanvasH, padT, padB);
          }
          layoutYOffset = rawLayoutY;
          layoutYReady = true;
        }
        translateY = layoutYOffset;
      } else {
        translateY = calcAnchorOffsetY(anchor, exportBounds.y, exportBounds.height, itemCanvasH, padT, padB);
        // 同 X：裁剪轴原样钳制（003），统一轴仅在装不下时兜底
        if (!itemUnifyH || itemCanvasH < exportBounds.height) {
          translateY = clampAnchorOffset(translateY, exportBounds.height, itemCanvasH, padT, padB);
        }
      }

      // 平移图层
      translateLayerBy(translateX, translateY);

      // 可见性兜底：复制出的图层必须是可见的，否则导出为空白图（隐藏图层不参与 saveAs 渲染）
      try {
        var activeExportLayer = app.activeDocument.activeLayer;
        if (!activeExportLayer.visible) {
          activeExportLayer.visible = true;
        }
      } catch (eVis) {
        // 忽略
      }



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
        removeLayerById(exportLayer.id);
      } catch (eRemove) {
        // 删除失败不阻断流程
      }

      exportCount++;
    }


    // 关闭工作文档
    workDoc.close(false);

    var result = {
      total: exportCount,
      maxWidth: maxW,
      maxHeight: maxH,
      unifiedWCount: unifiedWCount,
      unifiedHCount: unifiedHCount,
      trimmedCount: trimmedCount,
      skippedCount: skippedCount,
      skipReason: lastSkipReason,
      hostVersion: getHostScriptVersion(),
      outputDir: outputDir,
      // 影响对齐的元信息（面板不展示，仅供调试核对 004）
      alignModeX: layoutXEffective ? "layout" : "ink",
      alignModeY: layoutYEffective ? "layout" : "ink",
      alignFallback: alignFallback,
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

    // 与 batchExport 同一套分轴对齐语义（缺省：水平 ink + 垂直 layout）
    var alignModeX = config.alignModeX;
    var alignModeY = config.alignModeY;
    if (alignModeX == null) { alignModeX = config.alignMode; }
    if (alignModeY == null) { alignModeY = config.alignMode; }
    var layoutXRequested = alignModeX === "layout";
    var layoutYRequested = alignModeY !== "ink";

    // 全局关闭 PS 对话框
    var oldDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    var workDocSize = calcWorkDocSize(config.fontSize);
    var workDoc = Document.create("_measure", workDocSize, workDocSize, 72, false, false);

    // 跨文档复制源图层到工作文档作为模板
    var templateLayer = duplicateSourceLayer(srcDoc, srcLayerId, "_measure");
    // 隐藏模板层，防止原始文字残留
    templateLayer.hide();

    // 与 batchExport 共用测量逻辑，保证「检测值 = 导出实际尺寸」
    var measured = measureItemSet(
      templateLayer.id,
      items,
      layoutXRequested && isPointTextLayer(templateLayer),
      layoutYRequested,
      layoutXRequested && anchorNeedsWidthReference(config.anchor)
    );

    workDoc.close(false);

    app.displayDialogs = oldDialogs;
    return JSON.stringify({ maxWidth: measured.maxW, maxHeight: measured.maxH });
  } catch (e) {
    try { app.displayDialogs = oldDialogs; } catch (e2) { /* 忽略 */ }
    return "__ERROR__:" + e;
  }
}

/**
 * 读取宿主脚本版本号（用于确认 PS 是否加载了最新脚本）
 */
function getHostScriptVersion(): string {
  try {
    var g = $ as any;
    if (g.HostScriptVersion) {
      return g.HostScriptVersion;
    }
  } catch (e) {
    // 忽略
  }
  return "unknown";
}



/**
 * 判断某一轴是否参与统一画布
 * unifyWidth / unifyHeight 缺省（undefined）视为参与统一，保证旧预设行为不变
 */
function isUnifyAxis(value: any): boolean {
  return value !== false;
}

/**
 * 确保工作文档画布尺寸等于目标尺寸
 * resizeCanvas 使用 top-left 锚点，保证原点仍在 (0,0)；尺寸未变化时跳过，避免无谓的历史记录
 */
function ensureCanvasSize(
  doc: any,
  targetW: number,
  targetH: number,
  curW: number,
  curH: number
): void {
  if (targetW <= 0 || targetH <= 0) {
    return;
  }
  if (Math.ceil(curW) === Math.ceil(targetW) && Math.ceil(curH) === Math.ceil(targetH)) {
    return;
  }
  resizeCanvasWithAnchor(
    doc,
    targetW,
    targetH,
    charIDToTypeID("Left"),
    charIDToTypeID("Top ")
  );
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

/* ==================== 004 排印框对齐：测量与参考 ==================== */

/**
 * 空测量结果（墨迹模式 / 未测量时的兜底结构，保持字段完整便于调用方直读）
 */
function emptyMeasurement(): any {
  return {
    maxW: 0,
    maxH: 0,
    unifiedWCount: 0,
    unifiedHCount: 0,
    advWidths: [] as number[],
    inkWidths: [] as number[],
    boxes: [] as any[],
    unionTop: 0,
    unionBottom: 0,
    unionH: 0,
    hasUnion: false,
    advanceUsable: true,
    advanceReason: "",
  };
}

/**
 * 逐项测量（batchExport 与 measureCharacters 共用，保证「检测值 = 导出实际尺寸」）
 *
 * 两轴独立：
 * - layoutX（水平排印框）：maxW = 参与统一宽项的 max(字宽之和, 墨迹宽)；字宽测不出时回退墨迹宽
 * - layoutY（垂直排印框）：maxH = 参与统一高项墨迹上下沿的并集高（并集 ≥ 各项墨迹高，保证不裁切）
 * - 该轴不启用排印框时按旧行为取「各项最大墨迹尺寸」
 * - 无论哪种组合都回传每项墨迹框 / 字宽 / 并集范围，供定位阶段按轴选用
 *
 * 多行文本会让「追加末字符取差」跨行失真 → advanceUsable=false（**只影响水平轴**，
 * 垂直轴的墨迹框对多行依然有效），调用方让水平退回墨迹
 *
 * @param templateLayerId 模板层 ID（同文档复制用）
 * @param items 导出项
 * @param layoutX 水平轴是否启用排印框参考
 * @param layoutY 垂直轴是否启用排印框参考
 * @param needAdvance 是否需要逐项字宽（水平居中/右侧锚点才需要）
 */
function measureItemSet(
  templateLayerId: number,
  items: any[],
  layoutX: boolean,
  layoutY: boolean,
  needAdvance: boolean
): any {
  var result = emptyMeasurement();
  var suffixKeys: string[] = [];
  var suffixRights: number[] = [];

  for (var i = 0; i < items.length; i++) {
    var itemTextStr = items[i].text;
    var unifyW = isUnifyAxis(items[i].unifyWidth);
    var unifyH = isUnifyAxis(items[i].unifyHeight);

    var textValue = itemTextStr == null ? "" : String(itemTextStr);
    if (layoutX && (textValue.indexOf("\n") >= 0 || textValue.indexOf("\r") >= 0)) {
      result.advanceUsable = false;
      result.advanceReason = "multiline";
    }

    // 复制模板层 → 改文字（属性/效果/不透明度全保留）
    var layer = duplicateLayer(templateLayerId);
    changeLayerText(itemTextStr);
    var bounds = layer.bounds();

    var inkW = Math.ceil(bounds.width);
    var inkH = Math.ceil(bounds.height);

    result.advWidths.push(0);
    result.inkWidths.push(inkW);
    result.boxes.push({ y: bounds.y, height: bounds.height });

    if (unifyW) {
      result.unifiedWCount++;
      var candW = inkW;
      if (layoutX && needAdvance && result.advanceUsable) {
        var advance = measureAdvanceForText(templateLayerId, textValue, bounds, suffixKeys, suffixRights);
        // 字宽有效则记录；字宽小于墨迹宽（斜体/描边等溢出）时统一尺寸仍取墨迹宽
        result.advWidths[i] = advance;
        if (advance > 0 && Math.ceil(advance) > candW) {
          candW = Math.ceil(advance);
        }
      }
      if (candW > result.maxW) {
        result.maxW = candW;
      }
    }

    if (unifyH) {
      result.unifiedHCount++;
      if (!result.hasUnion) {
        result.unionTop = bounds.y;
        result.unionBottom = bounds.y + bounds.height;
        result.hasUnion = true;
      } else {
        if (bounds.y < result.unionTop) {
          result.unionTop = bounds.y;
        }
        if (bounds.y + bounds.height > result.unionBottom) {
          result.unionBottom = bounds.y + bounds.height;
        }
      }
      if (!layoutY && inkH > result.maxH) {
        result.maxH = inkH;
      }
    }

    try {
      removeLayerById(layer.id);
    } catch (eRemove) {
      // 删除失败不阻断流程
    }
  }

  if (result.hasUnion) {
    result.unionH = result.unionBottom - result.unionTop;
  }
  if (layoutY && result.unifiedHCount > 0) {
    result.maxH = Math.ceil(result.unionH);
  }

  return result;
}

/**
 * 测量一项文本的字宽之和（advance 之和）
 *
 * 同一文字原点下：inkRight(文本 + 末字符) − inkRight(末字符) = Σ字宽(文本)。
 * 末字符单独渲染的右边界按字符缓存（同一末字符只测一次）。
 *
 * @returns 字宽之和；末字符为空白/代理对半个字符/测不出结果时返回 0（调用方回退墨迹宽）
 */
function measureAdvanceForText(
  templateLayerId: number,
  textValue: string,
  itemBounds: any,
  suffixKeys: string[],
  suffixRights: number[]
): number {
  if (textValue.length === 0) {
    return 0;
  }
  var suffix = textValue.charAt(textValue.length - 1);
  if (!isUsableSuffixChar(suffix)) {
    return 0;
  }

  var suffixRight = -1;
  var cached = indexOfString(suffixKeys, suffix);
  if (cached >= 0) {
    suffixRight = suffixRights[cached];
  } else if (textValue.length === 1) {
    // 单项本身就是末字符：直接用它自己的墨迹右边界，省一次测量
    suffixRight = itemBounds.x + itemBounds.width;
    suffixKeys.push(suffix);
    suffixRights.push(suffixRight);
  } else {
    var probeLayer: any = duplicateLayer(templateLayerId);
    changeLayerText(suffix);
    var probeBounds = probeLayer.bounds();
    suffixRight = probeBounds.x + probeBounds.width;
    try {
      removeLayerById(probeLayer.id);
    } catch (eProbe) {
      // 删除失败不阻断流程
    }
    suffixKeys.push(suffix);
    suffixRights.push(suffixRight);
  }
  if (!(suffixRight >= 0)) {
    return 0;
  }

  // 追加末字符后的墨迹右边界
  var appendLayer: any = duplicateLayer(templateLayerId);
  changeLayerText(textValue + suffix);
  var appendBounds = appendLayer.bounds();
  var withSuffixRight = appendBounds.x + appendBounds.width;
  try {
    removeLayerById(appendLayer.id);
  } catch (eAppend) {
    // 删除失败不阻断流程
  }

  return calcAdvanceWidth(withSuffixRight, suffixRight);
}

/**
 * 挑出参与统一高的项对应的墨迹框（供「组内众数参考框」使用）
 */
function pickUnifiedHeightBoxes(items: any[], boxes: any[]): any[] {
  var out: any[] = [];
  for (var i = 0; i < items.length; i++) {
    if (i < boxes.length && isUnifyAxis(items[i].unifyHeight)) {
      out.push(boxes[i]);
    }
  }
  return out;
}

/**
 * 模板层是否点文本：段落文本有固定文本框，字宽差值法会失真
 *
 * 注意：ps-api 的 Layer 只是 id 包装，没有 textItem 属性，必须回到 DOM 按 id 取图层；
 * 读不到 kind（非文本层 / 图层在组内）时保守按点文本处理
 */
function isPointTextLayer(templateLayer: any): boolean {
  try {
    var layers = app.activeDocument.layers;
    for (var i = 0; i < layers.length; i++) {
      var domLayer = layers[i] as any;
      if (domLayer.id !== templateLayer.id) {
        continue;
      }
      if (domLayer.textItem.kind === TextType.PARAGRAPHTEXT) {
        return false;
      }
      return true;
    }
  } catch (e) {
    return true;
  }
  return true;
}

/**
 * 横向锚点是否需要「参考宽」：居中/右侧锚点需要字宽，左侧锚点只需墨迹左边界
 */
function anchorNeedsWidthReference(anchor: string): boolean {
  if (anchor === "top-center" || anchor === "middle-center" || anchor === "bottom-center") {
    return true;
  }
  if (anchor === "top-right" || anchor === "middle-right" || anchor === "bottom-right") {
    return true;
  }
  return false;
}

/**
 * 末字符能否用于字宽探测：空白无墨迹、代理对（半个字符）都会让差值法失真
 */
function isUsableSuffixChar(ch: string): boolean {
  if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\u3000") {
    return false;
  }
  var code = ch.charCodeAt(0);
  if (code >= 0xD800 && code <= 0xDFFF) {
    return false;
  }
  return true;
}

/**
 * 字符串数组查找（不用 Array.prototype.indexOf，保持 ES3 保守写法）
 */
function indexOfString(arr: string[], value: string): number {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === value) {
      return i;
    }
  }
  return -1;
}


