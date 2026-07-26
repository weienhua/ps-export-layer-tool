/**
 * 面板设置持久化（仅 localStorage，不写文件）
 * 合并: activeTab / tableRows / activePresetId / previewEnabled / autoExportEnabled
 */

const KEY = "exportLayerTool.settings.v1";

export function getSetting<T>(key: string, fallback: T): T {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var obj = JSON.parse(raw);
      if (obj[key] !== undefined) return obj[key] as T;
    }
  } catch (e) { /* ignore */ }
  return fallback;
}

export function setSetting(key: string, value: any): void {
  try {
    var raw = localStorage.getItem(KEY);
    var obj = raw ? JSON.parse(raw) : {};
    obj[key] = value;
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch (e) { /* ignore */ }
}
