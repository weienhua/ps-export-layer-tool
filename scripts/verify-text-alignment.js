/**
 * verify-text-alignment.js - 文字导出「对齐基准」像素校验（004 回归环）
 *
 * 背景：文字导出的定位基准按轴可选（004）：
 *      - 水平 layout（排印框）：按字宽定位 → 等字宽素材（「周X」）的共有字形同 x
 *      - 水平 ink（墨迹）：按各项可见墨迹定位 → 每张内容横向居中
 *      - 垂直 layout（排印框）：整组常量位移 → 各项基线一致
 *      - 垂直 ink（墨迹）：逐项墨迹居中
 *      本脚本用「全空列分段」把共有字形与后面的字分开，比较共有字形落点，
 *      并检查整幅墨迹相对画布中心的对称性（= 该轴是否「居中」）。
 *
 * 用法：
 *   node scripts/verify-text-alignment.js --run            # 跑默认组合（横墨迹·竖排印框）并断言
 *   node scripts/verify-text-alignment.js --run --matrix   # 跑四组合（layout/ink × layout/ink）并逐组合断言
 *   node scripts/verify-text-alignment.js <导出目录>        # 只分析已有导出目录（不跑 PS）
 *
 * 选项：
 *   --align-x=ink|layout   水平基准（默认 ink）
 *   --align-y=ink|layout   垂直基准（默认 layout）
 *   --threshold=N          alpha 阈值，默认 8（低于此值视为空白，滤掉抗锯齿毛边）
 *   --keep                 保留临时目录与 PS 里的临时文档（默认跑完清理）
 *   --via=bridge|jsxrun|osascript  指定驱动方式，默认自动探测
 *   --ps=NAME              osascript 方式使用的 Photoshop 应用名，默认 "Adobe Photoshop 2022"
 *
 * 断言口径（fixture = 周一…周日，等字宽、墨迹宽各不相同）：
 *   水平 layout → 共有字形 x 离散度 = 0；水平 ink → 每张 |左留白−右留白| ≤ 1
 *   垂直 layout → 共有字形 y 离散度 = 0；垂直 ink → 每张 |上留白−下留白| ≤ 1
 *
 * 驱动方式（自动探测顺序）：
 *   1. bridge —— 直接 POST http://127.0.0.1:8020/execute（即 jsxrun 的后端，无 30s 限制）
 *   2. jsxrun —— 调用命令行 jsxrun（注意其内置 30s 超时，故每个组合单独一次调用）
 *   3. osascript —— AppleScript `do javascript`（部分 PS 版本会返回 -10004 权限违例）
 *
 * 前置：`npm run build:jsx`（依赖 dist/jsx/hostscript.js）
 * 说明：会在 PS 里创建 zz_test_text_align 临时文档，默认结束即关闭，不触碰已打开的 PSD。
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");
const { decodePng, collectFiles, padRight } = require("./verify-export-alignment");

const HOST_SCRIPT = path.join(__dirname, "..", "dist", "jsx", "hostscript.js");
const BRIDGE_ENDPOINT = process.env.JSXRUN_ENDPOINT || "http://127.0.0.1:8020";
const ITEMS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const FONT_SIZE = 150;
const DOC_PADDING = 10;
const TEST_DOC = "zz_test_text_align";

/** 解析命令行参数 */
function parseArgs(argv) {
  const opts = {
    dir: null, run: false, keep: false, threshold: 8, ps: "Adobe Photoshop 2022", via: "auto",
    alignX: "ink", alignY: "layout", matrix: false,
  };
  for (const arg of argv) {
    if (arg === "--run") opts.run = true;
    else if (arg === "--keep") opts.keep = true;
    else if (arg === "--matrix") opts.matrix = true;
    else if (arg.indexOf("--threshold=") === 0) opts.threshold = parseInt(arg.slice(12), 10);
    else if (arg.indexOf("--ps=") === 0) opts.ps = arg.slice(5);
    else if (arg.indexOf("--via=") === 0) opts.via = arg.slice(6);
    else if (arg.indexOf("--align-x=") === 0) opts.alignX = arg.slice(10);
    else if (arg.indexOf("--align-y=") === 0) opts.alignY = arg.slice(10);
    else if (arg.indexOf("--") === 0) throw new Error("未知参数: " + arg);
    else opts.dir = arg;
  }
  if (opts.alignX !== "ink" && opts.alignX !== "layout") throw new Error("--align-x 只能是 ink 或 layout");
  if (opts.alignY !== "ink" && opts.alignY !== "layout") throw new Error("--align-y 只能是 ink 或 layout");
  return opts;
}

/* ============================ 像素分析 ============================ */

/** 分析一个导出目录，返回每张图的首段（共有字形）包围盒、整图包围盒与四周留白 */
function analyzeDir(dir, threshold) {
  const files = collectFiles([dir]).filter(function (f) {
    return path.extname(f).toLowerCase() === ".png";
  });
  files.sort();
  const rows = [];
  for (const file of files) {
    const info = decodePng(file);
    const segs = info.segments(threshold);
    const full = info.bboxWithThreshold(threshold);
    const pads = full
      ? {
          top: full.top,
          right: info.width - 1 - full.right,
          bottom: info.height - 1 - full.bottom,
          left: full.left,
        }
      : null;
    rows.push({
      name: path.basename(file),
      canvas: info.width + "x" + info.height,
      width: info.width,
      height: info.height,
      segCount: segs.length,
      first: segs.length > 0 ? segs[0] : null,
      full: full,
      pads: pads,
    });
  }
  return rows;
}

/**
 * 内容对称性：整幅墨迹相对画布中心的最大偏移（|左−右| = 2×偏移）
 * 水平基准为 ink 时该值应为 0（对齐边距左右相等的前提下）
 */
function symmetrySpread(rows) {
  const out = { x: 0, y: 0, missing: 0 };
  for (const r of rows) {
    if (!r.pads) {
      out.missing++;
      continue;
    }
    const dx = Math.abs(r.pads.left - r.pads.right);
    const dy = Math.abs(r.pads.top - r.pads.bottom);
    if (dx > out.x) out.x = dx;
    if (dy > out.y) out.y = dy;
  }
  return out;
}

/** 比较首段包围盒的离散度 */
function firstSpread(rows) {
  const keys = ["left", "top", "width", "height"];
  const spread = {};
  for (const k of keys) spread[k] = 0;
  const withBox = rows.filter(function (r) { return r.first; });
  if (withBox.length === 0) return { spread: spread, identical: false, missing: rows.length };
  for (const k of keys) {
    const values = withBox.map(function (r) { return r.first[k]; });
    spread[k] = Math.max.apply(null, values) - Math.min.apply(null, values);
  }
  const identical =
    withBox.length === rows.length &&
    spread.left === 0 && spread.top === 0 && spread.width === 0 && spread.height === 0;
  return { spread: spread, identical: identical, missing: rows.length - withBox.length };
}

function formatBox(box) {
  if (!box) return "（无内容）";
  return box.left + "," + box.top + " " + box.width + "x" + box.height;
}

function printRows(title, rows) {
  console.log("\n" + title);
  console.log(padRight("文件", 28) + padRight("画布", 12) + padRight("首段(共有字形)", 22) + "段数/整图包围盒");
  console.log("-".repeat(96));
  for (const r of rows) {
    console.log(
      padRight(r.name, 28) +
        padRight(r.canvas, 12) +
        padRight(formatBox(r.first), 22) +
        r.segCount + " / " + formatBox(r.full)
    );
  }
  const s = firstSpread(rows);
  console.log(
    "首段离散度: left=" + s.spread.left + " top=" + s.spread.top +
      " width=" + s.spread.width + " height=" + s.spread.height +
      (s.identical ? "  → 一致 ✓" : "  → 不一致 ✗")
  );
  return s;
}

/** 画布尺寸是否全等 */
function canvasesUniform(rows) {
  const set = {};
  for (const r of rows) set[r.canvas] = true;
  return Object.keys(set).length <= 1;
}

/* ============================ 驱动 PS ============================ */

function httpGet(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const req = http.get(url, function (res) {
      res.resume();
      resolve(res.statusCode);
    });
    req.setTimeout(timeoutMs, function () { req.destroy(new Error("请求超时")); });
    req.on("error", reject);
  });
}

function httpPostJson(url, body, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const data = JSON.stringify(body);
    const req = http.request(
      url,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      function (res) {
        const chunks = [];
        res.on("data", function (c) { chunks.push(c); });
        res.on("end", function () {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            return reject(new Error("HTTP " + res.statusCode + ": " + text.slice(0, 300)));
          }
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(new Error("桥接返回的不是 JSON: " + text.slice(0, 300)));
          }
        });
      }
    );
    req.setTimeout(timeoutMs, function () { req.destroy(new Error("请求超时（" + timeoutMs + "ms）")); });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function bridgeAlive() {
  try {
    const status = await httpGet(BRIDGE_ENDPOINT + "/status", 2000);
    return status === 200;
  } catch (e) {
    return false;
  }
}

function hasJsxrun() {
  try {
    execFileSync("which", ["jsxrun"], { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

/** 选择驱动方式 */
async function pickRunner(requested) {
  if (requested !== "auto") return requested;
  if (await bridgeAlive()) return "bridge";
  if (hasJsxrun()) return "jsxrun";
  return "osascript";
}

/** 把 JSX 送进 PS 执行，返回脚本最后一个表达式的值（字符串） */
async function runJsx(runner, code, opts, tempDir) {
  if (runner === "bridge") {
    const resp = await httpPostJson(BRIDGE_ENDPOINT + "/execute", { script: code }, 15 * 60 * 1000);
    if (!resp || resp.success !== true) {
      throw new Error("bridge 执行失败: " + JSON.stringify(resp && resp.error ? resp.error : resp).slice(0, 400));
    }
    return String(resp.result == null ? "" : resp.result);
  }

  if (runner === "jsxrun") {
    const file = path.join(tempDir, "driver_" + Date.now() + ".jsx");
    fs.writeFileSync(file, code, "utf8");
    return String(execFileSync("jsxrun", [file], { encoding: "utf8", timeout: 30 * 1000, maxBuffer: 8 * 1024 * 1024 }));
  }

  // osascript：文件必须带 BOM，否则 ExtendScript 会按 ANSI 解析（中文串乱码）
  const file = path.join(tempDir, "driver_" + Date.now() + ".jsx");
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(code, "utf8")]));
  const script =
    'tell application "' + opts.ps + '" to do javascript "$.evalFile(\\"' + file + '\\")"';
  return String(execFileSync("osascript", ["-e", script], { encoding: "utf8", timeout: 15 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 }));
}

/* ============================ 生成 fixture 脚本 ============================ */

const CJK_FONT_CANDIDATES = [
  "PingFangSC-Regular", "HiraginoSansGB-W3", "STHeitiSC-Light", "SongtiSC-Regular",
  "SourceHanSansSC-Regular", "NotoSansCJKsc-Regular", "MicrosoftYaHei", "SimHei", "STSong",
];

/** 公共前缀（ExtendScript ES3 子集：无 const/let/箭头/模板串） */
function driverPrelude() {
  return [
    "function pickCjkFont() {",
    "  var candidates = " + JSON.stringify(CJK_FONT_CANDIDATES) + ";",
    "  var fonts = app.fonts;",
    "  var i, j, f, name, ps, fam;",
    "  for (j = 0; j < candidates.length; j++) {",
    "    for (i = 0; i < fonts.length; i++) {",
    "      f = fonts[i];",
    "      name = ''; ps = ''; fam = '';",
    "      try { name = f.name; } catch (e1) { name = ''; }",
    "      try { ps = f.postScriptName; } catch (e2) { ps = ''; }",
    "      try { fam = f.family; } catch (e3) { fam = ''; }",
    "      if (name === candidates[j] || ps === candidates[j] || fam === candidates[j]) {",
    "        if (name !== '') { return name; }",
    "        return ps;",
    "      }",
    "    }",
    "  }",
    "  for (i = 0; i < fonts.length; i++) {",
    "    f = fonts[i];",
    "    name = '';",
    "    try { name = f.name + '|' + f.family; } catch (e4) { name = ''; }",
    "    if (name.indexOf('PingFang') >= 0 || name.indexOf('Hiragino') >= 0 || name.indexOf('Heiti') >= 0 || name.indexOf('Songti') >= 0) {",
    "      return fonts[i].name;",
    "    }",
    "  }",
    "  return '';",
    "}",
    "function findTestDoc() {",
    "  var i, doc;",
    "  for (i = 0; i < app.documents.length; i++) {",
    "    doc = app.documents[i];",
    "    if (doc.name.indexOf('" + TEST_DOC + "') === 0) { return doc; }",
    "  }",
    "  return null;",
    "}",
    "function closeStaleTestDocs() {",
    "  var i, doc;",
    "  for (i = app.documents.length - 1; i >= 0; i--) {",
    "    doc = app.documents[i];",
    "    if (doc.name.indexOf('" + TEST_DOC + "') === 0) { doc.close(SaveOptions.DONOTSAVECHANGES); }",
    "  }",
    "}",
    "function pickTextLayer(doc) {",
    "  var i, l;",
    "  for (i = 0; i < doc.layers.length; i++) {",
    "    l = doc.layers[i];",
    "    if (l.kind === LayerKind.TEXT) { return l; }",
    "  }",
    "  if (doc.layers.length > 0) { return doc.layers[0]; }",
    "  return null;",
    "}",
  ].join("\n");
}

/** 生成纯 ASCII 的 JS 字符串字面量（中文转 \uXXXX，避免任何编码环节出问题） */
function jsStringLiteral(value) {
  return JSON.stringify(String(value)).replace(/[\u007f-\uffff]/g, function (ch) {
    return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
  });
}

/** 阶段一：建临时文档 + 文本图层
 *  注意：桥接的裸 ExtendScript 上下文里没有 JSON（JSON 由 hostscript bundle 自己 polyfill），
 *  所以 driver 一律不用 JSON，结果用换行分隔的标记文本返回。 */
function buildSetupDriver() {
  return [
    driverPrelude(),
    "var ok = '0';",
    "var font = '';",
    "var err = '';",
    "try {",
    "  app.displayDialogs = DialogModes.NO;",
    "  closeStaleTestDocs();",
    "  font = pickCjkFont();",
    "  var doc = app.documents.add(1200, 400, 72, '" + TEST_DOC + "', NewDocumentMode.RGB, DocumentFill.TRANSPARENT);",
    "  var layer = doc.artLayers.add();",
    "  layer.kind = LayerKind.TEXT;",
    "  layer.name = 'zz_text_layer';",
    "  layer.textItem.contents = '\\u5468\\u4e00';",
    "  if (font !== '') { layer.textItem.font = font; }",
    "  layer.textItem.size = " + FONT_SIZE + ";",
    "  doc.activeLayer = layer;",
    "  ok = '1';",
    "} catch (e) { err = '' + e; }",
    "ok + '\\n' + font + '\\n' + err;",
    "",
  ].join("\n");
}

/** 阶段二：在已存在的临时文档上跑一次 batchExport（并可选关闭文档）
 *  配置 JSON 由 Node 侧生成并以纯 ASCII 字面量嵌入，driver 不依赖 JSON */
function buildExportDriver(hostScriptBomPath, configLiteral, closeDoc) {
  return [
    driverPrelude(),
    "var err = '';",
    "var result = '';",
    "var closed = '0';",
    "try {",
    "  app.displayDialogs = DialogModes.NO;",
    "  var doc = findTestDoc();",
    "  if (doc === null) {",
    "    err = 'NO_TEST_DOC';",
    "  } else {",
    "    app.activeDocument = doc;",
    "    var target = pickTextLayer(doc);",
    "    if (target === null) {",
    "      err = 'NO_TEXT_LAYER';",
    "    } else {",
    "      doc.activeLayer = target;",
    "      $.evalFile(" + jsStringLiteral(hostScriptBomPath) + ");",
    "      result = $.HostScript.batchExport(" + configLiteral + ");",
    "    }",
    "  }",
    "  if (" + (closeDoc ? "true" : "false") + ") {",
    "    closeStaleTestDocs();",
    "    closed = '1';",
    "  }",
    "} catch (e) { err = '' + e; }",
    "err + '\\n' + closed + '\\n' + result;",
    "",
  ].join("\n");
}

/**
 * fixture 导出配置
 * @param outputDir 输出目录
 * @param align 分轴基准 { x, y }（layout = 排印框，ink = 墨迹）
 * @param items 可选：自定义文本项（默认周一…周日）
 */
function buildConfig(outputDir, align, items) {
  var texts = items || ITEMS;
  return {
    items: texts.map(function (text, i) {
      return { text: text, name: "week_" + (i + 1), unifyWidth: true, unifyHeight: true };
    }),
    prefix: "",
    format: "png",
    sizeMode: "auto",
    exportWidth: 0,
    exportHeight: 0,
    paddingW: DOC_PADDING,
    paddingH: DOC_PADDING,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    anchor: "middle-center",
    alignModeX: align.x,
    alignModeY: align.y,
    outputDir: outputDir,
    fontSize: FONT_SIZE,
  };
}

/** 拆 driver 的换行分隔结果（字段顺序由调用方约定；末段可能含换行）
 *  注意：不能 trim 开头——第一个字段（err）为空时就是空串，trim 会把字段整体前移 */
function splitMarker(raw, count) {
  const text = String(raw == null ? "" : raw).replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const parts = text.split("\n");
  const out = [];
  for (let i = 0; i < count; i++) out.push(parts[i] == null ? "" : parts[i]);
  if (parts.length > count) out[count - 1] = parts.slice(count - 1).join("\n");
  return out;
}

/** 基准的中文名（用于输出） */
function zhMode(mode) {
  return mode === "layout" ? "排印框" : "墨迹";
}

/**
 * ink 轴「内容居中」断言的容差（px）
 * 只留给栅格化的亚像素/抗锯齿差异（实测 ≤1px）。
 * 注意：早期这里放到 10px 是因为踩到一个真 bug ——
 * `clampAnchorOffset` 把「偏移」当「内容位置」钳制，当内容自然位置已在理想位置右侧
 * （如左空边较大的「月/日」）时负偏移会被钳到 0、内容钉在左边（偏右 8~16px）。
 * 该 bug 已修（统一轴仅在画布装不下内容时才钳制），所以容差收紧回 2。
 */
const INK_SYMMETRY_TOLERANCE = 2;

async function runFixture(opts) {
  if (!fs.existsSync(HOST_SCRIPT)) {
    throw new Error("缺少 " + HOST_SCRIPT + "，请先运行 npm run build:jsx");
  }

  const runner = await pickRunner(opts.via);
  if (runner === "bridge" && !(await bridgeAlive())) {
    throw new Error("bridge 不可用（" + BRIDGE_ENDPOINT + "/status 无响应）");
  }
  console.log("驱动方式: " + runner + (runner === "bridge" ? "（" + BRIDGE_ENDPOINT + "）" : ""));

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-text-align-"));

  // hostscript 另存 BOM 副本：PS 从磁盘读无 BOM 的 UTF-8 会按 ANSI 解析（中文串乱码）
  const hostBom = path.join(workDir, "hostscript.bom.jsx");
  fs.writeFileSync(hostBom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(HOST_SCRIPT)]));

  console.log("临时目录: " + workDir);

  // 组合：默认只跑指定组合；--matrix 跑四组合
  const combos = opts.matrix
    ? [
        { x: "layout", y: "layout" },
        { x: "ink", y: "ink" },
        { x: "ink", y: "layout" }, // 新默认（混合）
        { x: "layout", y: "ink" },
      ]
    : [{ x: opts.alignX, y: opts.alignY }];

  const results = [];
  try {
    const rawSetup = await runJsx(runner, buildSetupDriver(), opts, workDir);
    const setupParts = splitMarker(rawSetup, 3);
    if (setupParts[0] !== "1") {
      throw new Error("建临时文档失败: " + (setupParts[2] || String(rawSetup).slice(0, 300)));
    }
    console.log("使用字体: " + (setupParts[1] || "（默认字体/回退）"));

    // 每个组合一次调用（jsxrun 内置 30s 超时，避免单次跑太久）
    for (let k = 0; k < combos.length; k++) {
      const combo = combos[k];
      const dir = path.join(workDir, combo.x + "_" + combo.y);
      fs.mkdirSync(dir);
      const closeDoc = k === combos.length - 1 && !opts.keep;
      const raw = await runJsx(
        runner,
        buildExportDriver(hostBom, jsStringLiteral(JSON.stringify(buildConfig(dir, combo))), closeDoc),
        opts,
        workDir
      );
      const out = splitMarker(raw, 3);
      if (out[0] !== "") {
        throw new Error("[" + zhMode(combo.x) + "/" + zhMode(combo.y) + "] 阶段报错: " + out[0]);
      }
      console.log("[" + zhMode(combo.x) + "/" + zhMode(combo.y) + "] batchExport: " + out[2]);
      results.push({ combo: combo, rows: analyzeDir(dir, opts.threshold) });
    }
  } catch (e) {
    // 失败也尽量清掉临时文档
    try {
      await runJsx(
        runner,
        driverPrelude() + "\napp.displayDialogs = DialogModes.NO;\ncloseStaleTestDocs();\n'cleaned';\n",
        opts,
        workDir
      );
    } catch (eClean) { /* 忽略 */ }
    throw e;
  }

  const problems = [];
  const summary = [];
  for (const r of results) {
    const label = "【水平 " + zhMode(r.combo.x) + " · 垂直 " + zhMode(r.combo.y) + "】";
    const spread = printRows(label + " 首段（共有字形）落点", r.rows);
    const sym = symmetrySpread(r.rows);
    console.log(
      "内容对称性: 水平 |左−右| ≤ " + sym.x + " ｜ 垂直 |上−下| ≤ " + sym.y +
        (sym.missing ? "（" + sym.missing + " 张无内容）" : "")
    );

    if (!canvasesUniform(r.rows)) {
      problems.push(label + "画布尺寸不统一");
    }
    if (r.combo.x === "layout") {
      if (spread.spread.left !== 0) {
        problems.push(label + "水平排印框下共有字形 x 不一致（离散 " + spread.spread.left + "）");
      }
    } else {
      if (sym.x > INK_SYMMETRY_TOLERANCE) {
        problems.push(label + "水平墨迹下内容未居中（|左−右| = " + sym.x + " > " + INK_SYMMETRY_TOLERANCE + "）");
      }
      if (spread.spread.left === 0) {
        problems.push(label + "水平墨迹下共有字形 x 竟然完全一致 → fixture 不具备区分力");
      }
    }
    if (r.combo.y === "layout") {
      if (spread.spread.top !== 0) {
        problems.push(label + "垂直排印框下共有字形 y 不一致（离散 " + spread.spread.top + "）");
      }
    } else {
      if (sym.y > INK_SYMMETRY_TOLERANCE) {
        problems.push(label + "垂直墨迹下内容未居中（|上−下| = " + sym.y + " > " + INK_SYMMETRY_TOLERANCE + "）");
      }
    }
    summary.push({ label: label, spread: spread.spread, sym: sym });
  }

  console.log("\n组合一览（首段离散度 = 共有字形落点差异；对称性 = 整幅墨迹相对画布中心的偏移量×2）:");
  console.log(
    padRight("组合", 24) + padRight("x离散", 8) + padRight("y离散", 8) + padRight("|左−右|", 10) + "|上−下|"
  );
  for (const s of summary) {
    console.log(
      padRight(s.label.replace(/[【】]/g, ""), 24) +
        padRight(s.spread.left, 8) +
        padRight(s.spread.top, 8) +
        padRight(s.sym.x, 10) +
        s.sym.y
    );
  }

  console.log("");
  if (problems.length === 0) {
    console.log("结论: PASS —— " + results.length + " 个组合的断言全部通过");
  } else {
    console.log("结论: FAIL");
    for (const p of problems) console.log("  - " + p);
  }

  if (opts.keep) {
    console.log("\n保留临时目录: " + workDir);
  } else {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  return problems.length === 0 ? 0 : 1;
}

/* ============================ 主流程 ============================ */

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    return 1;
  }

  if (opts.run) {
    try {
      return await runFixture(opts);
    } catch (e) {
      console.error("\n运行失败: " + (e.message || e));
      if (opts.via === "osascript" || (await bridgeAlive()) === false) {
        console.error(
          "\nPS 驱动不可用时的自检：\n" +
            "  - bridge: 需要把 ps-llm/photoshop-manipulate-bridge 的 dist 软链到\n" +
            "    ~/Library/Application Support/Adobe/Adobe Photoshop <版本>/Plug-ins/Generator/，\n" +
            "    并在 Photoshop 里重启 Generator（偏好设置 → 插件 → 取消勾选再勾选「启用 Generator」）或重启 PS；\n" +
            "  - osascript: 部分 PS 版本的 do javascript 会返回 -10004 权限违例，请改用 bridge；\n" +
            "  - 或者手动执行：Photoshop → 文件 > 脚本 > 浏览，选择临时目录里的 driver_*.jsx。"
        );
      }
      return 1;
    }
  }

  if (!opts.dir) {
    console.log("用法:");
    console.log("  node scripts/verify-text-alignment.js --run            # 默认组合（横墨迹·竖排印框）");
    console.log("  node scripts/verify-text-alignment.js --run --matrix   # 四组合矩阵");
    console.log("  node scripts/verify-text-alignment.js <导出目录>        # 分析已有导出目录（不跑 PS）");
    return 1;
  }
  if (!fs.existsSync(opts.dir)) {
    console.error("目录不存在: " + opts.dir);
    return 1;
  }

  const rows = analyzeDir(opts.dir, opts.threshold);
  if (rows.length === 0) {
    console.error("目录中没有 PNG: " + opts.dir);
    return 1;
  }
  const spread = printRows("【" + opts.dir + "】首段（共有字形）落点", rows);
  const sym = symmetrySpread(rows);
  const uniform = canvasesUniform(rows);
  console.log("内容对称性: 水平 |左−右| ≤ " + sym.x + " ｜ 垂直 |上−下| ≤ " + sym.y);
  console.log("画布尺寸统一: " + (uniform ? "是 ✓" : "否 ✗"));

  if (spread.identical && uniform) {
    console.log("\n结论: PASS —— 共有字形在 " + rows.length + " 张图里逐像素一致");
    return 0;
  }
  console.log(
    "\n结论: FAIL —— 共有字形落点不一致（" + JSON.stringify(spread.spread) + "）。\n" +
      "说明：仅「有共有字形」的素材才要求一致；若这组是单项/字宽各异的素材，\n" +
      "      请看上面的对称性（水平墨迹应 |左−右| ≈ 0）与画布尺寸，别用这条判定。"
  );
  return 1;
}

main().then(function (code) {
  process.exit(code);
});
