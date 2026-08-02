/**
 * freeExport.ts - 自由导出模块
 * 选中多个图层 → 每个图层保留原始尺寸，各自导出为独立图片
 *
 * 核心特点：
 * - 单 workDoc 复用（全程仅 1 次 Document.create + 1 次 close）
 * - 四方向边距独立配置（上/右/下/左）
 * - 每图层独享画布尺寸（layer.bounds + padding）
 * - 无需锚点对齐（normalize 后平移 padL/padT 即可）
 *
 * 所有 ps-api 类统一从 index.ts 导入，避免多路径引用导致的模块冲突
 */

import { Document, Layer } from "../ps-api/src/index";
import { ensureDirectory } from "./fileOps";
import {
  duplicateSourceLayer,
  resizeCanvasWithAnchor,
  translateLayerBy,
} from "./exportUtils";

var KIND_NAMES: { [key: number]: string } = {};
KIND_NAMES[1] = "像素图层";
KIND_NAMES[2] = "图层组";
KIND_NAMES[3] = "文本图层";
KIND_NAMES[4] = "形状图层";
KIND_NAMES[5] = "智能对象";

/**
 * 自由导出（选中多个图层 → 各自原始尺寸 + 边距 → 独立文件）
 * @param configJson 导出配置 JSON 字符串
 * @returns JSON { total, outputDir }
 */
export function freeExport(configJson: string): string {
  var oldDialogs = DialogModes.NO;
  try {
    if (app.documents.length === 0) {
      return "__NO_DOCUMENT__";
    }

    var config = JSON.parse(configJson);
    var layers = config.layers;
    var format = config.format;
    var padT = config.paddingTop != null ? config.paddingTop : 0;
    var padR = config.paddingRight != null ? config.paddingRight : 0;
    var padB = config.paddingBottom != null ? config.paddingBottom : 0;
    var padL = config.paddingLeft != null ? config.paddingLeft : 0;
    var outputDir = config.outputDir;
    var reversed = config.reversed;

    if (!layers || layers.length === 0) {
      return "__ERROR__:未选中任何有效图层";
    }

    // 确保输出目录存在
    var dirResult = ensureDirectory(outputDir);
    if (dirResult !== "__OK__") {
      return dirResult;
    }

    // 保存源文档引用
    var srcDoc = app.activeDocument;

    // 全局关闭 PS 对话框
    oldDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    // ── Phase 0: 预测量所有图层 + 筛选有效图层 ──
    var allSelected = Layer.getSelectedLayers();
    var preMeasured: Array<{
      layerId: number;
      exportFileName: string;
      srcW: number;
      srcH: number;
    }> = [];

    // 构建 layerId → config 映射
    var configByName: { [key: number]: string } = {};
    for (var ci = 0; ci < layers.length; ci++) {
      configByName[layers[ci].layerId] = layers[ci].exportFileName;
    }

    var maxCanvasW = 0;
    var maxCanvasH = 0;

    for (var si = 0; si < allSelected.length; si++) {
      var srcLayer = allSelected[si];

      // 跳过图层组
      var sKind = 0;
      try {
        sKind = srcLayer.kind();
      } catch (e) {
        /* 忽略 */
      }
      if (sKind === 2) {
        continue;
      }

      var sId = srcLayer.id;
      var sName = configByName[sId];
      if (!sName) {
        // 兜底：使用图层名
        try {
          sName = srcLayer.name();
        } catch (e) {
          sName = "layer_" + sId;
        }
      }

      var sW = 0;
      var sH = 0;
      try {
        var sBounds = srcLayer.bounds();
        sW = Math.ceil(sBounds.width);
        sH = Math.ceil(sBounds.height);
      } catch (e) {
        /* 忽略 */
      }

      if (sW === 0 && sH === 0) {
        continue;
      }

      preMeasured.push({
        layerId: sId,
        exportFileName: sName,
        srcW: sW,
        srcH: sH,
      });

      var canvasW = sW + padL + padR;
      var canvasH = sH + padT + padB;
      if (canvasW > maxCanvasW) {
        maxCanvasW = canvasW;
      }
      if (canvasH > maxCanvasH) {
        maxCanvasH = canvasH;
      }
    }

    if (preMeasured.length === 0) {
      app.displayDialogs = oldDialogs;
      return "__ERROR__:未选中任何有效图层（图层组已跳过）";
    }

    // 排序
    if (reversed) {
      preMeasured.reverse();
    }

    // ── 计算 workDoc 初始大小 ──
    var workDocSize = maxCanvasW + maxCanvasH + 200;
    if (workDocSize < 2000) {
      workDocSize = 2000;
    }
    if (workDocSize > 10000) {
      workDocSize = 10000;
    }

    // ── Phase 1: 创建 workDoc ──
    var workDoc = Document.create("_free_export", workDocSize, workDocSize, 72, false, false);
    var workDocName = "_free_export";

    var isPng = format === "png";
    var ext = isPng ? ".png" : ".jpg";
    var exportCount = 0;

    for (var li = 0; li < preMeasured.length; li++) {
      var item = preMeasured[li];

      // 1) 计算本图层画布尺寸
      var cW = item.srcW + padL + padR;
      var cH = item.srcH + padT + padB;

      // 2) 跨文档复制图层
      var dupLayer = duplicateSourceLayer(srcDoc, item.layerId, workDocName);

      // 3) normalize 到原点
      var dupBounds = dupLayer.bounds();
      translateLayerBy(-dupBounds.x, -dupBounds.y);

      // 4) 缩放画布到目标尺寸（Left/Top 锚点，原点不动）
      resizeCanvasWithAnchor(
        workDoc,
        cW,
        cH,
        charIDToTypeID("Left"),
        charIDToTypeID("Top ")
      );

      // 5) 应用边距偏移
      if (padL !== 0 || padT !== 0) {
        translateLayerBy(padL, padT);
      }

      // 6) sanitize 文件名 + 冲突处理
      // 面板侧已完成 sanitize + 冲突序号，此处直接使用
      var filename = item.exportFileName + ext;
      var filePath = outputDir + "/" + filename;

      // 7) 导出（saveAs 使用 PS 主渲染引擎）
      if (isPng) {
        // @ts-ignore
        workDoc.saveAs(filePath, "PNGFormat", true);
      } else {
        // @ts-ignore
        workDoc.saveAs(filePath, "JPEG", true);
      }

      // 8) 清理图层，为下一个图层腾空 workDoc
      dupLayer.remove();

      exportCount++;
    }

    // ── Phase 2: 清理 ──
    workDoc.close(false);
    app.displayDialogs = oldDialogs;

    return JSON.stringify({
      total: exportCount,
      outputDir: outputDir,
    });
  } catch (e) {
    try {
      app.displayDialogs = oldDialogs;
    } catch (e2) {
      /* 忽略 */
    }
    // 清理残留 _free_export 文档
    try {
      var openDocs = app.documents;
      for (var d = 0; d < openDocs.length; d++) {
        var docName = openDocs[d].name;
        if (docName.indexOf("_free_export") === 0) {
          openDocs[d].close(SaveOptions.DONOTSAVECHANGES);
        }
      }
    } catch (eCleanup) {
      /* 忽略 */
    }
    return "__ERROR__:" + e;
  }
}
