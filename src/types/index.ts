/**
 * 共享类型定义
 * 项目中所有组件使用的共享类型和接口
 */

/**
 * 导出预设项：渲染文本与文件命名的解耦
 */
export interface ExportPresetItem {
  text: string;   // PS 中渲染的文本内容
  name?: string;  // 文件名标识，空则 fallback 到 sanitize(text)
}

/**
 * 导出预设卡片数据（持久化 + UI 用）
 */
export interface ExportPreset {
  id: string;
  name: string;
  items: ExportPresetItem[];
  prefix: string;
  format: ExportFormat;
  anchor: AnchorType;
  paddingW: number;
  paddingH: number;
}

/**
 * 9 点锚位类型（Position Anchor）
 * 定义图层的参考点位置
 */
export type AnchorType =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

/**
 * 图层排序方式
 */
export type SortType =
  | "x-asc"         // 按 X 坐标升序
  | "y-asc"         // 按 Y 坐标升序
  | "ps-order";     // 按 PS 图层顺序

/**
 * 导出图片格式
 */
export type ExportFormat = "png" | "jpg";

/**
 * 画布尺寸模式
 */
export type SizeMode = "auto" | "manual";

/**
 * 文本图层字体信息（从 PS 读取）
 */
export interface GradientStop {
  color: string;
  location: number;
  midpoint: number;
}

export interface FXGradientFillInfo {
  enabled: boolean;
  opacity: number;
  mode: string;
  angle: number;
  type: string;
  reverse: boolean;
  scale: number;
  align: boolean;
  colors: GradientStop[];
}

export interface FXDropShadowInfo {
  enabled: boolean;
  opacity: number;
  mode: string;
  color: string;
  distance: number;
  angle: number;
  blur: number;
  spread: number;
}

export interface FXStrokeInfo {
  enabled: boolean;
  opacity: number;
  mode: string;
  color: string;
  size: number;
  position: string;
}

export interface LayerEffects {
  gradientFill?: FXGradientFillInfo;
  dropShadow?: FXDropShadowInfo;
  stroke?: FXStrokeInfo;
}

export interface TextLayerInfo {
  fontName: string;
  fontStyle: string;
  fontScriptName: string;
  fontSize: number;
  color: string;
  syntheticBold: boolean;
  syntheticItalic: boolean;
  horizontalScale: number;
  verticalScale: number;
  autoLeading: boolean;
  lineHeight: number;
  layerName: string;
  antiAlias: string;
  effects?: LayerEffects;
}

/**
 * 批量导出配置（面板 → 宿主）
 */
export interface BatchExportConfig {
  items: ExportPresetItem[];
  prefix: string;
  format: ExportFormat;
  sizeMode: SizeMode;
  exportWidth: number;
  exportHeight: number;
  paddingW: number;
  paddingH: number;
  anchor: AnchorType;
  outputDir: string;
  fontName: string;
  fontStyle: string;
  fontScriptName: string;
  fontSize: number;
  colorHex: string;
  syntheticBold: boolean;
  syntheticItalic: boolean;
  horizontalScale: number;
  verticalScale: number;
  autoLeading: boolean;
  lineHeight: number;
  antiAlias: string;
  effects?: LayerEffects;
}

/**
 * 批量导出结果（宿主 → 面板）
 */
export interface BatchExportResult {
  total: number;
  maxWidth: number;
  maxHeight: number;
  outputDir: string;
}
