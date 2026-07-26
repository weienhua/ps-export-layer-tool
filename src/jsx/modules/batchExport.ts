/**
 * batchExport.ts - 批量导出模块
 * 提供文本图层字体信息读取和批量字符导出功能
 *
 * 所有 ps-api 类统一从 index.ts 导入，避免多路径引用导致的模块冲突
 */

import { Document } from "../ps-api/src/index";
import { Layer } from "../ps-api/src/index";
import { Text } from "../ps-api/src/index";
import { SolidColor } from "../ps-api/src/index";
import { ensureDirectory } from "./fileOps";

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
 function rgbToHex(r: number, g: number, b: number): string {
  var rh = Math.round(r).toString(16);
  var gh = Math.round(g).toString(16);
  var bh = Math.round(b).toString(16);
  return "#" + (rh.length === 1 ? "0" + rh : rh) + (gh.length === 1 ? "0" + gh : gh) + (bh.length === 1 ? "0" + bh : bh);
}

function readLayerEffects(layer: any): any {
  try {
    var c2t = app.charIDToTypeID;
    var s2t = app.stringIDToTypeID;
    var ref = new ActionReference();
    ref.putIdentifier(c2t("Lyr "), layer.id());
    var desc = app.executeActionGet(ref);

    var effects: any = {};

    if (desc.hasKey(s2t("layerEffects"))) {
      var layerEffects = desc.getObjectValue(s2t("layerEffects"));

      if (layerEffects.hasKey(s2t("gradientFill"))) {
        var gf = layerEffects.getObjectValue(s2t("gradientFill"));
        var gfEnabled = false;
        try { gfEnabled = gf.getBoolean(s2t("enabled")); } catch (e) { /* 忽略 */ }
        if (gfEnabled) {
          var opacity = 100;
          try { opacity = gf.getInteger(s2t("opacity")); } catch (e) { /* 忽略 */ }
          var mode = "normal";
          try { mode = gf.getString(s2t("mode")); } catch (e) { /* 忽略 */ }
          var angle = 0;
          try { angle = gf.getInteger(s2t("angle")); } catch (e) { /* 忽略 */ }
          var type = "linear";
          try { type = gf.getString(s2t("type")); } catch (e) { /* 忽略 */ }
          var reverse = false;
          try { reverse = gf.getBoolean(s2t("reverse")); } catch (e) { /* 忽略 */ }
          var scale = 100;
          try { scale = gf.getInteger(s2t("scale")); } catch (e) { /* 忽略 */ }
          var align = true;
          try { align = gf.getBoolean(s2t("align")); } catch (e) { /* 忽略 */ }

          var colors: any[] = [];
          try {
            if (gf.hasKey(s2t("gradient"))) {
              var gradient = gf.getObjectValue(s2t("gradient"));
              if (gradient.hasKey(s2t("colors"))) {
                var colorList = gradient.getList(s2t("colors"));
                for (var i = 0; i < colorList.count; i++) {
                  var colorStop = colorList.getObjectValue(i);
                  if (colorStop.hasKey(s2t("colorStop"))) {
                    var stop = colorStop.getObjectValue(s2t("colorStop"));
                    var location = 0;
                    try { location = stop.getInteger(s2t("location")); } catch (e) { /* 忽略 */ }
                    var midpoint = 50;
                    try { midpoint = stop.getInteger(s2t("midpoint")); } catch (e) { /* 忽略 */ }

                    var colorHex = "#FFFFFF";
                    try {
                      var color = stop.getObjectValue(s2t("color"));
                      var r = 0, g = 0, b = 0;
                      if (color.hasKey(s2t("redFloat"))) {
                        r = color.getDouble(s2t("redFloat")) * 255;
                        g = color.getDouble(s2t("greenFloat")) * 255;
                        b = color.getDouble(s2t("blueFloat")) * 255;
                      } else if (color.hasKey(s2t("red"))) {
                        r = color.getDouble(s2t("red"));
                        g = color.getDouble(s2t("grain"));
                        b = color.getDouble(s2t("blue"));
                      }
                      colorHex = rgbToHex(r, g, b);
                    } catch (e) { /* 忽略 */ }

                    colors.push({
                      color: colorHex,
                      location: location,
                      midpoint: midpoint,
                    });
                  }
                }
              }
            }
          } catch (e) { /* 忽略 */ }

          effects.gradientFill = {
            enabled: gfEnabled,
            opacity: opacity,
            mode: mode,
            angle: angle,
            type: type,
            reverse: reverse,
            scale: scale,
            align: align,
            colors: colors,
          };
        }
      }

      if (layerEffects.hasKey(s2t("dropShadow"))) {
        var ds = layerEffects.getObjectValue(s2t("dropShadow"));
        var dsEnabled = false;
        try { dsEnabled = ds.getBoolean(s2t("enabled")); } catch (e) { /* 忽略 */ }
        if (dsEnabled) {
          var dsOpacity = 100;
          try { dsOpacity = ds.getInteger(s2t("opacity")); } catch (e) { /* 忽略 */ }
          var dsMode = "multiply";
          try { dsMode = ds.getString(s2t("mode")); } catch (e) { /* 忽略 */ }
          var dsColorHex = "#000000";
          try {
            var dsColor = ds.getObjectValue(s2t("color"));
            var dsR = 0, dsG = 0, dsB = 0;
            if (dsColor.hasKey(s2t("redFloat"))) {
              dsR = dsColor.getDouble(s2t("redFloat")) * 255;
              dsG = dsColor.getDouble(s2t("greenFloat")) * 255;
              dsB = dsColor.getDouble(s2t("blueFloat")) * 255;
            } else if (dsColor.hasKey(s2t("red"))) {
              dsR = dsColor.getDouble(s2t("red"));
              dsG = dsColor.getDouble(s2t("grain"));
              dsB = dsColor.getDouble(s2t("blue"));
            }
            dsColorHex = rgbToHex(dsR, dsG, dsB);
          } catch (e) { /* 忽略 */ }
          var dsDistance = 5;
          try { dsDistance = ds.getInteger(s2t("distance")); } catch (e) { /* 忽略 */ }
          var dsAngle = 120;
          try { dsAngle = ds.getInteger(s2t("angle")); } catch (e) { /* 忽略 */ }
          var dsBlur = 5;
          try { dsBlur = ds.getInteger(s2t("blur")); } catch (e) { /* 忽略 */ }
          var dsSpread = 0;
          try { dsSpread = ds.getInteger(s2t("spread")); } catch (e) { /* 忽略 */ }

          effects.dropShadow = {
            enabled: dsEnabled,
            opacity: dsOpacity,
            mode: dsMode,
            color: dsColorHex,
            distance: dsDistance,
            angle: dsAngle,
            blur: dsBlur,
            spread: dsSpread,
          };
        }
      }

      if (layerEffects.hasKey(s2t("stroke"))) {
        var st = layerEffects.getObjectValue(s2t("stroke"));
        var stEnabled = false;
        try { stEnabled = st.getBoolean(s2t("enabled")); } catch (e) { /* 忽略 */ }
        if (stEnabled) {
          var stOpacity = 100;
          try { stOpacity = st.getInteger(s2t("opacity")); } catch (e) { /* 忽略 */ }
          var stMode = "normal";
          try { stMode = st.getString(s2t("mode")); } catch (e) { /* 忽略 */ }
          var stColorHex = "#000000";
          try {
            var stColor = st.getObjectValue(s2t("color"));
            var stR = 0, stG = 0, stB = 0;
            if (stColor.hasKey(s2t("redFloat"))) {
              stR = stColor.getDouble(s2t("redFloat")) * 255;
              stG = stColor.getDouble(s2t("greenFloat")) * 255;
              stB = stColor.getDouble(s2t("blueFloat")) * 255;
            } else if (stColor.hasKey(s2t("red"))) {
              stR = stColor.getDouble(s2t("red"));
              stG = stColor.getDouble(s2t("grain"));
              stB = stColor.getDouble(s2t("blue"));
            }
            stColorHex = rgbToHex(stR, stG, stB);
          } catch (e) { /* 忽略 */ }
          var stSize = 1;
          try { stSize = st.getInteger(s2t("size")); } catch (e) { /* 忽略 */ }
          var stPosition = "center";
          try { stPosition = st.getString(s2t("position")); } catch (e) { /* 忽略 */ }

          effects.stroke = {
            enabled: stEnabled,
            opacity: stOpacity,
            mode: stMode,
            color: stColorHex,
            size: stSize,
            position: stPosition,
          };
        }
      }
    }

    return effects;
  } catch (e) {
    return {};
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

    var fontSize = 12;
    try { fontSize = text.size(); } catch (e) { /* 忽略 */ }

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

    var effects = readLayerEffects(layer);

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
      layerName: layerName,
      antiAlias: antiAlias,
      effects: effects,
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
    var anchor = config.anchor;
    var outputDir = config.outputDir;

    // 确保输出目录存在
    var dirResult = ensureDirectory(outputDir);
    if (dirResult !== "__OK__") {
      return dirResult;
    }

    var originalLayerEffects: any = null;
    try {
      var srcLayer = app.activeDocument.activeLayer;
      var srcRef = new ActionReference();
      srcRef.putIdentifier(charIDToTypeID("Lyr "), srcLayer.id);
      var srcDesc = executeActionGet(srcRef);
      if (srcDesc.hasKey(stringIDToTypeID("layerEffects"))) {
        originalLayerEffects = srcDesc.getObjectValue(stringIDToTypeID("layerEffects"));
      }
    } catch (e) { /* 忽略 */ }

    // ==================== Phase 1: 创建测量文档 ====================
    var workDocSize = calcWorkDocSize(config.fontSize);
    var workDoc = Document.create("_batch", workDocSize, workDocSize, 72, false, false);

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

        var text = createTextLayer(itemText, config);
        text.paint();

        var layer = Layer.getSelectedLayers()[0];

        if (originalLayerEffects !== null) {
          var fxDesc = new ActionDescriptor();
          var ref2 = new ActionReference();
          ref2.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
          fxDesc.putReference(charIDToTypeID("null"), ref2);
          fxDesc.putObject(stringIDToTypeID("to"), stringIDToTypeID("layerEffects"), originalLayerEffects);
          executeAction(stringIDToTypeID("set"), fxDesc, DialogModes.NO);
        }

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
      finalW = maxW + paddingW;
      finalH = maxH + paddingH;
    } else {
      if (exportWidth > 0) {
        finalW = exportWidth;
      }
      if (exportHeight > 0) {
        finalH = exportHeight;
      }
    }

    // ==================== Phase 3: 缩小画布到目标尺寸 ====================
    // raw ActionManager: resizeCanvas，ps-api 的版本硬编码了居中
    resizeCanvasWithAnchor(
      workDoc,
      finalW,
      finalH,
      charIDToTypeID("Cntr"),
      charIDToTypeID("Cntr")
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

        // 创建文本图层
        var exportText = createTextLayer(expTextStr, config);
        exportText.paint();

        var exportLayer = Layer.getSelectedLayers()[0];

        if (originalLayerEffects !== null) {
          var fxDesc2 = new ActionDescriptor();
          var ref3 = new ActionReference();
          ref3.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
          fxDesc2.putReference(charIDToTypeID("null"), ref3);
          fxDesc2.putObject(stringIDToTypeID("to"), stringIDToTypeID("layerEffects"), originalLayerEffects);
          executeAction(stringIDToTypeID("set"), fxDesc2, DialogModes.NO);
        }

        var exportBounds = exportLayer.bounds();

        // 计算偏移
        var translateX = calcAnchorOffsetX(
          anchor,
          exportBounds.x,
          exportBounds.width,
          finalW
        );
        var translateY = calcAnchorOffsetY(
          anchor,
          exportBounds.y,
          exportBounds.height,
          finalH
        );

        // 检查移动后的边界，避免文本超出画布
        // 仅当 bounds 不大于画布时才调整，避免 top/bottom 冲突
        var movedTop = exportBounds.y + translateY;
        var movedBottom = exportBounds.y + exportBounds.height + translateY;
        var movedLeft = exportBounds.x + translateX;
        var movedRight = exportBounds.x + exportBounds.width + translateX;

        if (exportBounds.height <= finalH) {
          if (movedTop < 0) {
            translateY -= movedTop;
          } else if (movedBottom > finalH) {
            translateY -= (movedBottom - finalH);
          }
        }
        if (exportBounds.width <= finalW) {
          if (movedLeft < 0) {
            translateX -= movedLeft;
          } else if (movedRight > finalW) {
            translateX -= (movedRight - finalW);
          }
        }

        // 平移图层
        translateLayerBy(translateX, translateY);

        // 导出文件名
        var filename = prefix + expName + ext;

        // 使用 exportToWeb 导出
        if (isPng) {
          // @ts-ignore
          var pngOptions = new ExportOptionsSaveForWeb();
          pngOptions.format = SaveDocumentType.PNG;
          pngOptions.PNG8 = false;
          pngOptions.transparency = true;
          workDoc.exportToWeb(outputDir, filename, pngOptions);
        } else {
          // @ts-ignore
          var jpgOptions = new ExportOptionsSaveForWeb();
          jpgOptions.format = SaveDocumentType.JPEG;
          jpgOptions.quality = 85;
          workDoc.exportToWeb(outputDir, filename, jpgOptions);
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

        // 创建文本图层
        var exportText2 = createTextLayer(itemText2, config);
        exportText2.paint();

        var exportLayer2 = Layer.getSelectedLayers()[0];

        if (originalLayerEffects !== null) {
          var fxDesc3 = new ActionDescriptor();
          var ref4 = new ActionReference();
          ref4.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
          fxDesc3.putReference(charIDToTypeID("null"), ref4);
          fxDesc3.putObject(stringIDToTypeID("to"), stringIDToTypeID("layerEffects"), originalLayerEffects);
          executeAction(stringIDToTypeID("set"), fxDesc3, DialogModes.NO);
        }

        var exportBounds2 = exportLayer2.bounds();
        var charW2 = Math.ceil(exportBounds2.width);
        var charH2 = Math.ceil(exportBounds2.height);

        // 顺带统计最大尺寸（用于结果展示）
        if (charW2 > maxW) maxW = charW2;
        if (charH2 > maxH) maxH = charH2;

        // 计算偏移
        var translateX2 = calcAnchorOffsetX(
          anchor,
          exportBounds2.x,
          exportBounds2.width,
          finalW
        );
        var translateY2 = calcAnchorOffsetY(
          anchor,
          exportBounds2.y,
          exportBounds2.height,
          finalH
        );

        // 检查移动后的边界，避免文本超出画布
        // 仅当 bounds 不大于画布时才调整，避免 top/bottom 冲突
        var movedTop2 = exportBounds2.y + translateY2;
        var movedBottom2 = exportBounds2.y + exportBounds2.height + translateY2;
        var movedLeft2 = exportBounds2.x + translateX2;
        var movedRight2 = exportBounds2.x + exportBounds2.width + translateX2;

        if (exportBounds2.height <= finalH) {
          if (movedTop2 < 0) {
            translateY2 -= movedTop2;
          } else if (movedBottom2 > finalH) {
            translateY2 -= (movedBottom2 - finalH);
          }
        }
        if (exportBounds2.width <= finalW) {
          if (movedLeft2 < 0) {
            translateX2 -= movedLeft2;
          } else if (movedRight2 > finalW) {
            translateX2 -= (movedRight2 - finalW);
          }
        }

        // 平移图层
        translateLayerBy(translateX2, translateY2);

        // 导出文件名
        var filename2 = prefix + itemName2 + ext;

        // 使用 exportToWeb 导出
        if (isPng) {
          // @ts-ignore
          var pngOptions2 = new ExportOptionsSaveForWeb();
          pngOptions2.format = SaveDocumentType.PNG;
          pngOptions2.PNG8 = false;
          pngOptions2.transparency = true;
          workDoc.exportToWeb(outputDir, filename2, pngOptions2);
        } else {
          // @ts-ignore
          var jpgOptions2 = new ExportOptionsSaveForWeb();
          jpgOptions2.format = SaveDocumentType.JPEG;
          jpgOptions2.quality = 85;
          workDoc.exportToWeb(outputDir, filename2, jpgOptions2);
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

    return JSON.stringify(result);
  } catch (e) {
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

    // 读取原图层效果，与 batchExport Phase 2 保持一致
    var originalLayerEffects: any = null;
    try {
      var srcLayer = app.activeDocument.activeLayer;
      var srcRef = new ActionReference();
      srcRef.putIdentifier(charIDToTypeID("Lyr "), srcLayer.id);
      var srcDesc = executeActionGet(srcRef);
      if (srcDesc.hasKey(stringIDToTypeID("layerEffects"))) {
        originalLayerEffects = srcDesc.getObjectValue(stringIDToTypeID("layerEffects"));
      }
    } catch (e) { /* 忽略 */ }

    var workDocSize = calcWorkDocSize(config.fontSize);
    var workDoc = Document.create("_measure", workDocSize, workDocSize, 72, false, false);

    var maxW = 0;
    var maxH = 0;

    for (var i = 0; i < items.length; i++) {
      var ch = items[i].text;

      var text = createTextLayer(ch, config);
      text.paint();

      var layer = Layer.getSelectedLayers()[0];

      // 应用原图层效果，确保测量结果包含效果范围
      if (originalLayerEffects !== null) {
        var fxDesc = new ActionDescriptor();
        var ref2 = new ActionReference();
        ref2.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        fxDesc.putReference(charIDToTypeID("null"), ref2);
        fxDesc.putObject(stringIDToTypeID("to"), stringIDToTypeID("layerEffects"), originalLayerEffects);
        executeAction(stringIDToTypeID("set"), fxDesc, DialogModes.NO);
      }

      var bounds = layer.bounds();
      var charW = Math.ceil(bounds.width);
      var charH = Math.ceil(bounds.height);

      if (charW > maxW) maxW = charW;
      if (charH > maxH) maxH = charH;

      try { layer.remove(); } catch (e) { /* 忽略 */ }
    }

    workDoc.close(false);

    return JSON.stringify({ maxWidth: maxW, maxHeight: maxH });
  } catch (e) {
    return "__ERROR__:" + e;
  }
}

/**
 * 创建配置了字体属性的 Text 对象
 */
function createTextLayer(content: string, config: any): Text {
  var text = new Text(content);

  var fontConfig = {
    name: config.fontName,
    style: config.fontStyle,
    scriptName: config.fontScriptName,
  };
  text.setFont(fontConfig);
  text.setSize(config.fontSize);

  var color = SolidColor.fromHexString(config.colorHex);
  if (color !== null) {
    text.setColor(color);
  }

  if (config.syntheticBold) {
    text.setBold(true);
  }
  if (config.syntheticItalic) {
    text.setItalic(true);
  }

  var hScale = config.horizontalScale;
  var vScale = config.verticalScale;
  if (hScale !== 100 || vScale !== 100) {
    text.setScale(hScale, vScale);
  }

  if (config.autoLeading) {
    text.setAutoLeading(true);
  } else {
    text.setLineHeight(config.lineHeight);
  }

  // 应用抗锯齿设置（从原图层读取，默认 Smooth）
  if (config.antiAlias) {
    try {
      text.setAntiAlias(config.antiAlias);
    } catch (e) { /* 忽略，使用默认 */ }
  }

  return text;
}

function applyGradientFill(gradientFillInfo: any): void {
  try {
    var c2t = app.charIDToTypeID;
    var s2t = app.stringIDToTypeID;

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(c2t("Lyr "), c2t("Ordn"), c2t("Trgt"));
    desc.putReference(c2t("null"), ref);

    var gfDesc = new ActionDescriptor();
    gfDesc.putBoolean(s2t("enabled"), true);
    gfDesc.putInteger(s2t("opacity"), gradientFillInfo.opacity);
    gfDesc.putEnumerated(s2t("mode"), s2t("blendMode"), s2t(gradientFillInfo.mode));
    gfDesc.putInteger(s2t("angle"), gradientFillInfo.angle);
    gfDesc.putEnumerated(s2t("type"), s2t("gradientType"), s2t(gradientFillInfo.type));
    gfDesc.putBoolean(s2t("reverse"), gradientFillInfo.reverse);
    gfDesc.putInteger(s2t("scale"), gradientFillInfo.scale);
    gfDesc.putBoolean(s2t("align"), gradientFillInfo.align);

    var gradientDesc = new ActionDescriptor();
    gradientDesc.putString(s2t("name"), "Custom");
    gradientDesc.putEnumerated(s2t("gradientForm"), s2t("gradientForm"), s2t("customStops"));

    var colorList = new ActionList();
    for (var i = 0; i < gradientFillInfo.colors.length; i++) {
      var stop = gradientFillInfo.colors[i];
      var stopDesc = new ActionDescriptor();

      var colorStopDesc = new ActionDescriptor();

      var colorDesc = new ActionDescriptor();
      colorDesc.putClass(s2t("class"), s2t("RGBColor"));
      var hex = stop.color.replace("#", "");
      var r = parseInt(hex.substring(0, 2), 16);
      var g = parseInt(hex.substring(2, 4), 16);
      var b = parseInt(hex.substring(4, 6), 16);
      colorDesc.putDouble(s2t("red"), r);
      colorDesc.putDouble(s2t("grain"), g);
      colorDesc.putDouble(s2t("blue"), b);

      colorStopDesc.putObject(s2t("color"), s2t("RGBColor"), colorDesc);
      colorStopDesc.putEnumerated(s2t("type"), s2t("colorStopType"), s2t("userStop"));
      colorStopDesc.putInteger(s2t("location"), stop.location);
      colorStopDesc.putInteger(s2t("midpoint"), stop.midpoint);

      stopDesc.putObject(s2t("colorStop"), s2t("colorStop"), colorStopDesc);
      colorList.putObject(s2t("colorStop"), stopDesc);
    }
    gradientDesc.putList(s2t("colors"), colorList);

    var transList = new ActionList();
    var tDesc1 = new ActionDescriptor();
    var tsDesc1 = new ActionDescriptor();
    tsDesc1.putInteger(s2t("opacity"), 100);
    tsDesc1.putInteger(s2t("location"), 0);
    tsDesc1.putInteger(s2t("midpoint"), 50);
    tDesc1.putObject(s2t("transferSpec"), s2t("transferSpec"), tsDesc1);
    transList.putObject(s2t("transferSpec"), tDesc1);

    var tDesc2 = new ActionDescriptor();
    var tsDesc2 = new ActionDescriptor();
    tsDesc2.putInteger(s2t("opacity"), 100);
    tsDesc2.putInteger(s2t("location"), 4096);
    tsDesc2.putInteger(s2t("midpoint"), 50);
    tDesc2.putObject(s2t("transferSpec"), s2t("transferSpec"), tsDesc2);
    transList.putObject(s2t("transferSpec"), tDesc2);

    gradientDesc.putList(s2t("transparency"), transList);
    gfDesc.putObject(s2t("gradient"), s2t("gradient"), gradientDesc);

    desc.putObject(s2t("using"), s2t("gradientFill"), gfDesc);

    app.executeAction(s2t("make"), desc, DialogModes.NO);
  } catch (e) {
    $.writeln("applyGradientFill error: " + e);
  }
}

/**
 * 带锚点的 resizeCanvas（ps-api 版本固定居中）
 */
function resizeCanvasWithAnchor(
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
function translateLayerBy(offsetX: number, offsetY: number): void {
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
 * 锚点偏移计算
 */
function calcAnchorOffsetX(
  anchor: string,
  boundsX: number,
  textWidth: number,
  canvasWidth: number
): number {
  var textLeft = boundsX;
  var textCenter = boundsX + textWidth / 2;
  var textRight = boundsX + textWidth;

  if (
    anchor === "top-left" ||
    anchor === "middle-left" ||
    anchor === "bottom-left"
  ) {
    return -textLeft;
  } else if (
    anchor === "top-center" ||
    anchor === "middle-center" ||
    anchor === "bottom-center"
  ) {
    return canvasWidth / 2 - textCenter;
  } else {
    return canvasWidth - textRight;
  }
}

function calcAnchorOffsetY(
  anchor: string,
  boundsY: number,
  textHeight: number,
  canvasHeight: number
): number {
  var textTop = boundsY;
  var textMiddle = boundsY + textHeight / 2;
  var textBottom = boundsY + textHeight;

  if (
    anchor === "top-left" ||
    anchor === "top-center" ||
    anchor === "top-right"
  ) {
    return -textTop;
  } else if (
    anchor === "middle-left" ||
    anchor === "middle-center" ||
    anchor === "middle-right"
  ) {
    return canvasHeight / 2 - textMiddle;
  } else {
    return canvasHeight - textBottom;
  }
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

/**
 * 文件名特殊字符处理
 */
function sanitizeFilenameChar(ch: string): string {
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
