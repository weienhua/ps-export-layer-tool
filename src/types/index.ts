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
  /**
   * 宽度参与统一画布：true / undefined = 宽度统一；false = 按内容裁剪宽度
   * 裁剪轴画布尺寸 = ceil(bounds.width) + paddingW + paddingLeft + paddingRight
   */
  unifyWidth?: boolean;
  /**
   * 高度参与统一画布：true / undefined = 高度统一；false = 按内容裁剪高度
   * 裁剪轴画布尺寸 = ceil(bounds.height) + paddingH + paddingTop + paddingBottom
   */
  unifyHeight?: boolean;
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
  /** 对齐边距：上（top 锚点时生效） */
  paddingTop?: number;
  /** 对齐边距：右（right 锚点时生效） */
  paddingRight?: number;
  /** 对齐边距：下（bottom 锚点时生效） */
  paddingBottom?: number;
  /** 对齐边距：左（left 锚点时生效） */
  paddingLeft?: number;
  /**
   * 水平基准（缺省 = ink 墨迹）
   * - layout：按字宽（排印框）定位 → 等字宽素材的共有字形同 x，内容按字宽居中
   * - ink：按各项可见墨迹定位 → 每张内容居中，共有字形 x 会随墨迹宽变化
   */
  alignModeX?: AlignMode;
  /**
   * 垂直基准（缺省 = layout 排印框）
   * - layout：整组共用同一常量位移 → 基线一致（墨迹高矮不一的项会显得偏心）
   * - ink：各项可见墨迹居中 → 高矮不一则基线错开
   */
  alignModeY?: AlignMode;
  /** 兼容旧数据（单开关时期）：仅读取，落盘写 alignModeX / alignModeY */
  alignMode?: AlignMode;
}

/**
 * 对齐基准（004），按轴选择
 * - layout：排印框
 *   水平 → 用字宽(advance)与可见墨迹的**较宽者**定位：等字宽素材（「周一…周日」）共有字形同 x
 *   垂直 → 用整组墨迹框（众数框）做**整组常量位移** + 并集画布：各项基线一致、绝不裁切
 * - ink：墨迹 —— 按每项实际像素包围盒定位：每张内容各自居中（水平居中 / 垂直居中）
 *
 * 缺省（新预设）：水平 ink + 垂直 layout（即「混合」，每张内容横向居中 + 基线一致）。
 * 统一画布下「每张内容居中」与「共有字形同 x」不可兼得，只能按轴取舍。
 */
export type AlignMode = "layout" | "ink";

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
  layerId: number;
  layerName: string;
  fontAvailable: boolean;
  antiAlias: string;
  opacity: number;
  activeEffects: string[];
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
  opacity: number;
  activeEffects: string[];
  /** 对齐边距：上 */
  paddingTop?: number;
  /** 对齐边距：右 */
  paddingRight?: number;
  /** 对齐边距：下 */
  paddingBottom?: number;
  /** 对齐边距：左 */
  paddingLeft?: number;
  /** 水平基准（缺省 = ink 墨迹） */
  alignModeX?: AlignMode;
  /** 垂直基准（缺省 = layout 排印框） */
  alignModeY?: AlignMode;
  /** 兼容旧数据（单开关时期）：仅读取 */
  alignMode?: AlignMode;
}

/**
 * 批量导出结果（宿主 → 面板）
 */
export interface BatchExportResult {
  total: number;
  maxWidth: number;
  maxHeight: number;
  /** 参与统一宽度的项数（0 = 宽度全部按内容裁剪） */
  unifiedWCount?: number;
  /** 参与统一高度的项数（0 = 高度全部按内容裁剪） */
  unifiedHCount?: number;
  /** 含按内容裁剪轴的项数 */
  trimmedCount?: number;
  /** 因内容为空被跳过的项数 */
  skippedCount?: number;
  /** 跳过原因（诊断用） */
  skipReason?: string;
  /** 宿主脚本版本号（确认 PS 是否加载最新脚本） */
  hostVersion?: string;
  /** 实际生效的水平基准（layout = 排印框，ink = 墨迹） */
  alignModeX?: AlignMode;
  /** 实际生效的垂直基准 */
  alignModeY?: AlignMode;
  /** 请求排印框但被迫退回墨迹对齐的原因（诊断用，如 x:paragraph-text / x:multiline） */
  alignFallback?: string;
  outputDir: string;
}

// ── 多图层批量导出类型 ──

/**
 * 单个选中图层的概要信息
 */
export interface LayerInfo {
  layerId: number;
  layerName: string;
  kind: number;
  kindName: string;
  width: number;
  height: number;
}

/**
 * 选中图层列表（宿主 → 面板）
 */
export interface SelectedLayersInfo {
  layers: LayerInfo[];
  totalCount: number;
}

/**
 * 多图层批量导出配置（面板 → 宿主）
 */
export interface BatchExportLayersConfig {
  prefix: string;
  startIndex: number;
  format: ExportFormat;
  sizeMode: SizeMode;
  exportWidth: number;
  exportHeight: number;
  paddingW: number;
  paddingH: number;
  anchor: AnchorType;
  outputDir: string;
  reversed: boolean;
  /** 对齐边距：上 */
  paddingTop?: number;
  /** 对齐边距：右 */
  paddingRight?: number;
  /** 对齐边距：下 */
  paddingBottom?: number;
  /** 对齐边距：左 */
  paddingLeft?: number;
}

/**
 * 多图层批量导出结果（宿主 → 面板）
 */
export interface BatchExportLayersResult {
  total: number;
  maxWidth: number;
  maxHeight: number;
  outputDir: string;
}

/**
 * 多图层测量结果（宿主 → 面板）
 */
export interface MeasureLayersResult {
  maxWidth: number;
  maxHeight: number;
  finalWidth: number;
  finalHeight: number;
}

// ── 自由导出类型 ──

/**
 * 自由导出图层信息（面板侧用，包含用户可编辑字段）
 * 基于 LayerInfo 扩展，增加导出文件名编辑能力
 */
export interface FreeExportLayerInfo {
  layerId: number;
  layerName: string;
  kind: number;
  kindName: string;
  width: number;
  height: number;
  /** 用户可编辑的导出文件名（不含扩展名），默认 = layerName */
  exportFileName: string;
}

/**
 * 自由导出配置（面板 → 宿主）
 * 每个图层保留原始尺寸，四方向边距独立配置
 */
export interface FreeExportConfig {
  layers: Array<{ layerId: number; exportFileName: string }>;
  format: ExportFormat;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  outputDir: string;
  reversed: boolean;
}

/**
 * 自由导出结果（宿主 → 面板）
 */
export interface FreeExportResult {
  total: number;
  outputDir: string;
}
