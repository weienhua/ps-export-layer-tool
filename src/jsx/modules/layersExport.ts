/**
 * layersExport.ts - 多图层批量导出模块
 * 选中多个图层 → 每个图层导出为独立图片，统一画布尺寸和对齐方式
 *
 * 所有 ps-api 类统一从 index.ts 导入，避免多路径引用导致的模块冲突
 */

import { Document, Layer } from "../ps-api/src/index";
import { ensureDirectory } from "./fileOps";
import {
  duplicateSourceLayer,
  resizeCanvasWithAnchor,
  translateLayerBy,
  calcAnchorOffsetX,
  calcAnchorOffsetY,
  sanitizeFilenameChar,
} from "./exportUtils";

var KIND_NAMES: { [key: number]: string } = {};
KIND_NAMES[1] = "像素图层";
KIND_NAMES[2] = "图层组";
KIND_NAMES[3] = "文本图层";
KIND_NAMES[4] = "形状图层";
KIND_NAMES[5] = "智能对象";

/**
 * 获取当前选中的所有图层信息（面板轮询用）
 * 跳过图层组（kind === 2）
 * @returns JSON 字符串
 */
export function getSelectedLayersInfo(): string {
  try {
    if (app.documents.length === 0) {
      return "__NO_DOCUMENT__";
    }

    var allLayers = Layer.getSelectedLayers();
    var layers: any[] = [];
    var skipped: any[] = [];

    for (var i = 0; i < allLayers.length; i++) {
      var layer = allLayers[i];
      var kind = 0;
      try {
        kind = layer.kind();
      } catch (e) {
        /* 忽略 */
      }

      // 跳过图层组
      if (kind === 2) {
        var groupName = "";
        try {
          groupName = layer.name();
        } catch (e) {
          /* 忽略 */
        }
        skipped.push({ layerName: groupName, reason: "图层组" });
        continue;
      }

      var layerName = "";
      try {
        layerName = layer.name();
      } catch (e) {
        /* 忽略 */
      }

      var w = 0;
      var h = 0;
      try {
        var b = layer.bounds();
        w = Math.ceil(b.width);
        h = Math.ceil(b.height);
      } catch (e) {
        /* 忽略 */
      }

      var kindName = KIND_NAMES[kind];
      if (!kindName) {
        kindName = "未知类型";
      }

      layers.push({
        layerId: layer.id,
        layerName: layerName,
        kind: kind,
        kindName: kindName,
        width: w,
        height: h,
      });
    }

    return JSON.stringify({
      layers: layers,
      totalCount: layers.length,
      skipped: skipped,
    });
  } catch (e) {
    return "__ERROR__:" + e;
  }
}

/**
 * 独立测量选中图层（面板"检测尺寸"按钮用）
 * 直接在源文档中遍历选中图层读 bounds，不需要创建 workDoc
 * @returns JSON { maxWidth, maxHeight, finalWidth, finalHeight }
 */
export function measureLayers(): string {
  try {
    if (app.documents.length === 0) {
      return "__NO_DOCUMENT__";
    }

    var allLayers = Layer.getSelectedLayers();
    var maxW = 0;
    var maxH = 0;

    for (var i = 0; i < allLayers.length; i++) {
      var layer = allLayers[i];

      // 跳过图层组
      var kind = 0;
      try {
        kind = layer.kind();
      } catch (e) {
        /* 忽略 */
      }
      if (kind === 2) {
        continue;
      }

      var w = 0;
      var h = 0;
      try {
        var b = layer.bounds();
        w = Math.ceil(b.width);
        h = Math.ceil(b.height);
      } catch (e) {
        /* 忽略 */
      }

      if (w > maxW) {
        maxW = w;
      }
      if (h > maxH) {
        maxH = h;
      }
    }

    if (maxW === 0 && maxH === 0) {
      return "__ERROR__:未选中任何有效图层";
    }

    return JSON.stringify({
      maxWidth: maxW,
      maxHeight: maxH,
      finalWidth: maxW,
      finalHeight: maxH,
    });
  } catch (e) {
    return "__ERROR__:" + e;
  }
}

/**
 * 多图层批量导出
 * @param configJson 导出配置 JSON 字符串
 * @returns JSON 字符串
 */
export function batchExportLayers(configJson: string): string {
  try {
    if (app.documents.length === 0) {
      return "__NO_DOCUMENT__";
    }

    var config = JSON.parse(configJson);
    var prefix = config.prefix;
    var startIndex = config.startIndex != null ? config.startIndex : 0;
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

    // 保存源文档引用
    var srcDoc = app.activeDocument;

    // 全局关闭 PS 对话框
    var oldDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    // ── 读取选中图层 ──
    var allLayers = Layer.getSelectedLayers();

    // 过滤图层组，收集有效图层
    var validLayers: any[] = [];
    for (var i = 0; i < allLayers.length; i++) {
      var l = allLayers[i];
      var lKind = 0;
      try {
        lKind = l.kind();
      } catch (e) {
        /* 忽略 */
      }
      if (lKind === 2) {
        continue;
      }
      var lName = "";
      try {
        lName = l.name();
      } catch (e) {
        /* 忽略 */
      }
      var lW = 0;
      var lH = 0;
      try {
        var lb = l.bounds();
        lW = Math.ceil(lb.width);
        lH = Math.ceil(lb.height);
      } catch (e) {
        /* 忽略 */
      }
      validLayers.push({ layer: l, name: lName, srcW: lW, srcH: lH });
    }

    if (validLayers.length === 0) {
      app.displayDialogs = oldDialogs;
      return "__ERROR__:未选中任何有效图层（图层组已跳过）";
    }

    // ── 排序：reversed 时倒序 ──
    if (config.reversed) {
      validLayers.reverse();
    }

    // ── 计算最大尺寸（在源文档中直接测量）──
    var maxW = 0;
    var maxH = 0;
    for (var j = 0; j < validLayers.length; j++) {
      var b2 = validLayers[j].layer.bounds();
      var bw = Math.ceil(b2.width);
      var bh = Math.ceil(b2.height);
      if (bw > maxW) maxW = bw;
      if (bh > maxH) maxH = bh;
    }

    // ── 计算最终画布尺寸 ──
    var finalW = maxW;
    var finalH = maxH;
    if (sizeMode === "auto") {
      finalW = maxW + paddingW + padL + padR;
      finalH = maxH + paddingH + padT + padB;
    } else {
      if (exportWidth > 0) finalW = exportWidth;
      if (exportHeight > 0) finalH = exportHeight;
    }

    // ── 估算 workDoc 初始大小（至少 ≥ 最终画布尺寸）──
    var workDocSize = maxW + maxH + 200;
    if (workDocSize < finalW) workDocSize = finalW;
    if (workDocSize < finalH) workDocSize = finalH;
    if (workDocSize < 2000) workDocSize = 2000;
    if (workDocSize > 10000) workDocSize = 10000;

    // ── Phase 1: 创建 workDoc 并复制所有图层 ──
    var workDoc = Document.create("_batch_layers", workDocSize, workDocSize, 72, false, false);
    var workDocName = "_batch_layers";

    var duplicatedLayers: any[] = [];
    var layerMetaList: Array<{ name: string }> = [];

    for (var k = 0; k < validLayers.length; k++) {
      var dupLayer = duplicateSourceLayer(srcDoc, validLayers[k].layer.id, workDocName);
      // normalize: 将图层平移到 workDoc 原点 (0,0)，消除源文档绝对坐标影响
      var dupBounds = dupLayer.bounds();
      translateLayerBy(-dupBounds.x, -dupBounds.y);
      dupLayer.hide(); // 复制后立即隐藏，需要时再 show
      duplicatedLayers.push(dupLayer);
      layerMetaList.push({ name: validLayers[k].name });
    }

    // ── Phase 2: 缩小画布到目标尺寸（top-left 锚点，保证原点仍在 (0,0)）──
    resizeCanvasWithAnchor(
      workDoc,
      finalW,
      finalH,
      charIDToTypeID("Left"),
      charIDToTypeID("Top ")
    );

    // ── Phase 3: 逐个导出 ──
    var isPng = format === "png";
    var ext = isPng ? ".png" : ".jpg";
    var exportCount = 0;
    var totalCount = duplicatedLayers.length;
    var padLen = String(startIndex + totalCount - 1).length;

    for (var n = 0; n < duplicatedLayers.length; n++) {
      var expLayer = duplicatedLayers[n];
      var meta = layerMetaList[n];

      // 1) 显示并选中
      expLayer.show();
      expLayer.select();

      // 2) 获取 bounds 用于锚点偏移计算
      var expBounds = expLayer.bounds();

      // 3) 计算偏移（传入对齐边距）
      var translateX = calcAnchorOffsetX(anchor, expBounds.x, expBounds.width, finalW, padL, padR);
      var translateY = calcAnchorOffsetY(anchor, expBounds.y, expBounds.height, finalH, padT, padB);

      // 4) 出界检测与修正（含对齐边距）
      var movedTop = expBounds.y + translateY;
      var movedBottom = expBounds.y + expBounds.height + translateY;
      var movedLeft = expBounds.x + translateX;
      var movedRight = expBounds.x + expBounds.width + translateX;

      if (expBounds.height <= finalH) {
        if (movedTop < padT) {
          translateY -= movedTop - padT;
        } else if (movedBottom > finalH - padB) {
          translateY -= movedBottom - (finalH - padB);
        }
      }
      if (expBounds.width <= finalW) {
        if (movedLeft < padL) {
          translateX -= movedLeft - padL;
        } else if (movedRight > finalW - padR) {
          translateX -= movedRight - (finalW - padR);
        }
      }

      // 5) 平移图层到锚点位置
      translateLayerBy(translateX, translateY);

      // 6) 生成文件名：prefix + 零填充序号
      var seqNum = startIndex + n;
      var paddedNum = padZero(seqNum, padLen);
      var filename = prefix + paddedNum + ext;

      // 7) 导出（saveAs 使用 PS 主渲染引擎，避免 Save for Web 的文本裁切 bug）
      var filePath = outputDir + "/" + filename;
      if (isPng) {
        // @ts-ignore
        workDoc.saveAs(filePath, "PNGFormat", true);
      } else {
        // @ts-ignore
        workDoc.saveAs(filePath, "JPEG", true);
      }

      // 8) 隐藏当前图层
      expLayer.hide();

      exportCount++;
    }

    // ── Phase 4: 清理 ──
    workDoc.close(false);

    app.displayDialogs = oldDialogs;
    return JSON.stringify({
      total: exportCount,
      maxWidth: maxW,
      maxHeight: maxH,
      outputDir: outputDir,
    });
  } catch (e) {
    try {
      app.displayDialogs = oldDialogs;
    } catch (e2) {
      /* 忽略 */
    }
    // 清理残留 _batch_layers 文档
    try {
      var openDocs = app.documents;
      for (var d = 0; d < openDocs.length; d++) {
        var docName = openDocs[d].name;
        if (docName.indexOf("_batch_layers") === 0) {
          openDocs[d].close(SaveOptions.DONOTSAVECHANGES);
        }
      }
    } catch (eCleanup) {
      /* 忽略 */
    }
    return "__ERROR__:" + e;
  }
}

/**
 * 零填充序号
 */
function padZero(num: number, len: number): string {
  var s = String(num);
  while (s.length < len) {
    s = "0" + s;
  }
  return s;
}
