/**
 * 共享类型定义
 * 项目中所有组件使用的共享类型和接口
 */

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
}

/**
 * 批量导出配置（面板 → 宿主）
 */
export interface BatchExportConfig {
  characters: string;
  prefix: string;
  format: ExportFormat;
  sizeMode: SizeMode;
  exportWidth: number;
  exportHeight: number;
  paddingW: number;
  paddingH: number;
  anchor: AnchorType;
  outputDir: string;
  // 字体属性
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
