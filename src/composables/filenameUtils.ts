/**
 * filenameUtils.ts - 文件名工具函数（面板侧）
 * 与宿主侧 exportUtils.sanitizeFilename 保持一致的字符替换规则
 */

/**
 * 对完整字符串逐字符 sanitize
 * 替换 Windows/macOS 文件名禁止字符为下划线
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

/**
 * 文件名特殊字符处理（与宿主侧 exportUtils.sanitizeFilenameChar 规则一致）
 */
function sanitizeFilenameChar(ch: string): string {
  if (ch === ":") return "_";
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
