/**
 * verify-export-alignment.js - 导出结果像素边界校验（零依赖）
 *
 * 用途：读取导出的 PNG，输出画布尺寸 + 不透明像素实际包围盒 + 四周空白像素数，
 *      用于验证「分轴统一 / 按内容裁剪」两种模式的实际落点：
 *      - 参与统一的轴：所有素材该轴画布尺寸一致
 *      - 按内容裁剪的轴：画布尺寸 = 内容 + 边距，且四周空白 = 设定边距
 *
 * 用法：
 *   node scripts/verify-export-alignment.js <目录或文件...>
 *   node scripts/verify-export-alignment.js ./output
 *   node scripts/verify-export-alignment.js a.png b.png
 *
 * 说明：仅支持 8bit PNG（PS「另存为 PNG」默认输出）。JPG 无透明通道，会提示跳过。
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/**
 * 解码 8bit PNG，返回 { width, height, transparent(pixel,index), bbox() }
 */
function decodePng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 8 || !buffer.slice(0, 8).equals(signature)) {
    throw new Error("不是有效的 PNG 文件");
  }

  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  let palette = [];
  const idatParts = [];

  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const data = buffer.slice(dataStart, dataStart + length);
    offset = dataStart + length + 4; // 跳过 CRC

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      const interlace = data.readUInt8(12);
      if (interlace !== 0) throw new Error("不支持隔行扫描（interlaced）PNG");
    } else if (type === "PLTE") {
      palette = [];
      for (let i = 0; i + 2 < data.length; i += 3) {
        palette.push([data[i], data[i + 1], data[i + 2]]);
      }
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8) {
    throw new Error("仅支持 8bit PNG（当前 " + bitDepth + "bit）");
  }

  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) throw new Error("不支持的 PNG 颜色类型: " + colorType);

  const raw = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);

  // 逐行反 filter
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[pos++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos + x];
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[prevStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[prevStart + x - channels] : 0;
      let value;
      if (filterType === 0) {
        value = rawByte;
      } else if (filterType === 1) {
        value = rawByte + left;
      } else if (filterType === 2) {
        value = rawByte + up;
      } else if (filterType === 3) {
        value = rawByte + ((left + up) >> 1);
      } else if (filterType === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        let predictor;
        if (pa <= pb && pa <= pc) predictor = left;
        else if (pb <= pc) predictor = up;
        else predictor = upLeft;
        value = rawByte + predictor;
      } else {
        throw new Error("未知的行 filter 类型: " + filterType);
      }
      pixels[rowStart + x] = value & 0xff;
    }
    pos += stride;
  }

  function isTransparent(x, y) {
    const idx = y * stride + x * channels;
    if (colorType === 6) return pixels[idx + 3] === 0;
    if (colorType === 4) return pixels[idx + 1] === 0;
    if (colorType === 2 || colorType === 0) return false; // 无 alpha 通道，视为全不透明
    if (colorType === 3) return palette.length === 0; // 无调色板信息时保守处理
    return false;
  }

  /**
   * 读取某像素的 alpha 值（无 alpha 通道的 PNG 视为全不透明 255）
   */
  function alphaAt(x, y) {
    const idx = y * stride + x * channels;
    if (colorType === 6) return pixels[idx + 3];
    if (colorType === 4) return pixels[idx + 1];
    return 255;
  }

  /**
   * 按阈值统计包围盒（threshold=0 等价于 bbox()）
   */
  function bboxWithThreshold(threshold) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (alphaAt(x, y) > threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * 用「全空列」把图像切成若干横向段，每段各自求包围盒
   * 用于把「周」和后面的字分开，单独比较共有字形在每张图里的落点
   */
  function segments(threshold) {
    const occupied = [];
    for (let x = 0; x < width; x++) {
      let hit = false;
      for (let y = 0; y < height; y++) {
        if (alphaAt(x, y) > threshold) { hit = true; break; }
      }
      occupied.push(hit);
    }
    const result = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const hit = x < width ? occupied[x] : false;
      if (hit && start < 0) start = x;
      if (!hit && start >= 0) {
        const box = bboxOfRange(start, x - 1, threshold);
        if (box) result.push(box);
        start = -1;
      }
    }
    return result;
  }

  function bboxOfRange(x0, x1, threshold) {
    let minX = x1 + 1;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = x0; x <= x1; x++) {
        if (alphaAt(x, y) > threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  function bbox() {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isTransparent(x, y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return {
      left: minX,
      top: minY,
      right: maxX,
      bottom: maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      padLeft: minX,
      padTop: minY,
      padRight: width - 1 - maxX,
      padBottom: height - 1 - maxY,
    };
  }

  return { width, height, bbox, alphaAt, bboxWithThreshold, segments };
}

function collectFiles(targets) {
  const files = [];
  for (const target of targets) {
    if (!fs.existsSync(target)) {
      console.log("  跳过（不存在）: " + target);
      continue;
    }
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(target);
      for (const entry of entries) {
        const full = path.join(target, entry);
        if (fs.statSync(full).isFile()) files.push(full);
      }
    } else {
      files.push(target);
    }
  }
  return files;
}

function padRight(text, len) {
  let out = String(text);
  while (out.length < len) out += " ";
  return out;
}

function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.log("用法: node scripts/verify-export-alignment.js <目录或文件...>");
    process.exit(1);
  }

  const files = collectFiles(targets);
  if (files.length === 0) {
    console.log("未找到任何文件");
    process.exit(1);
  }

  console.log(
    padRight("文件", 28) +
      padRight("画布", 12) +
      padRight("内容包围盒", 24) +
      "留白(上/右/下/左)"
  );
  console.log("-".repeat(90));

  const sizeGroups = {};
  let parsed = 0;

  for (const file of files) {
    const name = path.basename(file);
    const ext = path.extname(file).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") {
      console.log(padRight(name, 28) + "JPG 无透明通道，跳过（请用 PNG 验证）");
      continue;
    }
    if (ext !== ".png") continue;

    let info;
    try {
      info = decodePng(file);
    } catch (e) {
      console.log(padRight(name, 28) + "解析失败: " + e.message);
      continue;
    }
    parsed++;

    const box = info.bbox();
    const canvasLabel = info.width + "x" + info.height;
    const key = info.width + "x" + info.height;
    if (!sizeGroups[key]) sizeGroups[key] = [];
    sizeGroups[key].push(name);

    if (!box) {
      console.log(padRight(name, 28) + padRight(canvasLabel, 12) + "（全透明，无像素内容）");
      continue;
    }

    const boxLabel = box.left + "," + box.top + " " + box.width + "x" + box.height;
    const gaps = [box.padTop, box.padRight, box.padBottom, box.padLeft].join(" / ");
    console.log(
      padRight(name, 28) +
        padRight(canvasLabel, 12) +
        padRight(boxLabel, 24) +
        gaps
    );
  }

  console.log("\n画布尺寸分组（同一分组 = 该轴尺寸一致）:");
  for (const key of Object.keys(sizeGroups)) {
    console.log("  " + padRight(key, 12) + "(" + sizeGroups[key].length + ") " + sizeGroups[key].join(", "));
  }
  console.log("\n共解析 " + parsed + " 个 PNG");
}

if (require.main === module) {
  main();
}

// 供 scripts/verify-text-alignment.js 复用（零依赖 PNG 解码 + 分段分析）
module.exports = { decodePng, collectFiles, padRight };
