/**
 * bridge.ts - PS 通信桥接层（模板骨架）
 * 提供面板与 Photoshop 宿主脚本通信的 Promise 化封装
 *
 * 新建项目时在此添加业务方法，格式参考 getDocumentInfo 示例
 */

// 调试开关
const DEBUG = (window as any).DEBUG || false;

// 类型导入
import type { TextLayerInfo, BatchExportConfig, BatchExportResult, SelectedLayersInfo, BatchExportLayersConfig, BatchExportLayersResult, MeasureLayersResult } from "./types";

/**
 * 通信日志回调类型
 */
export type LogCallback = (type: 'send' | 'receive' | 'error', data: any) => void;
let logCallback: LogCallback | null = null;

/**
 * 设置日志回调
 */
export function setLogCallback(callback: LogCallback | null) {
  logCallback = callback;
}

/**
 * PS 操作结果接口
 */
export interface PSResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  noDocument?: boolean;
}

/**
 * 文档信息接口
 */
export interface DocumentInfo {
  name: string;
  width: number;
  height: number;
}

/**
 * PSBridge - PS 通信类
 * 封装与 Photoshop 宿主脚本的通信逻辑
 */
export class PSBridge {
  private csInterface: CSInterface;

  constructor() {
    this.csInterface = new (window as any).CSInterface();
  }

  /**
   * 执行 ExtendScript 代码
   * @param script 要执行的脚本
   * @returns Promise 包装的结果
   */
  private evalScript<T>(script: string): Promise<PSResult<T>> {
    const startTime = Date.now();
    if (DEBUG) {
      console.log('[Bridge] Sending:', script);
    }
    logCallback?.('send', { script, timestamp: startTime });

    return new Promise((resolve) => {
      var resolved = false;

      // 超时保护：10 秒内没有回调则返回超时错误
      var timeoutId = window.setTimeout(function () {
        if (!resolved) {
          resolved = true;
          var error = 'Host script timeout (no response within 20s)';
          logCallback?.('error', { script, error, duration: 20000, timestamp: Date.now() });
          resolve({ success: false, error: error });
        }
      }, 20000);

      this.csInterface.evalScript(script, function (result: any) {
        if (resolved) return;
        resolved = true;
        window.clearTimeout(timeoutId);

        var duration = Date.now() - startTime;
        if (DEBUG) {
          console.log('[Bridge] Received (' + duration + 'ms):', result);
        }

        // 防御 result 为 undefined/null 的情况
        var safeResult = result === undefined || result === null
          ? '__UNDEFINED__'
          : String(result);
        logCallback?.('receive', { script: script, result: safeResult, duration: duration, timestamp: Date.now() });
        resolve(this.parseResult<T>(safeResult));
      }.bind(this));
    });
  }

  /**
   * 转义单引号字符串
   */
  private escapeForSingleQuotedString(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
  }

  /**
   * 解析 ExtendScript 返回的结果
   */
  private parseResult<T>(result: string): PSResult<T> {
    // 检查错误前缀
    if (result.startsWith("__ERROR__:")) {
      return {
        success: false,
        error: result.substring(10)
      };
    }

    // 检查无文档状态
    if (result === "__NO_DOCUMENT__") {
      return {
        success: false,
        noDocument: true,
        error: "No document is currently open"
      };
    }

    // 检查取消状态
    if (result === "__CANCEL__") {
      return {
        success: false,
        error: "User cancelled the operation"
      };
    }

    // 检查成功前缀
    if (result === "__OK__") {
      return { success: true };
    }

    // 尝试解析 JSON
    try {
      var data = JSON.parse(result) as T;
      return { success: true, data: data };
    } catch (e) {
      // 非 JSON 结果，作为字符串返回
      return { success: true, data: result as unknown as T };
    }
  }

  // ========== 业务方法 — 在此添加你的 PS 通信方法 ==========

  /**
   * 获取当前文档信息（示例方法，展示完整的 面板→bridge→hostscript 调用链）
   * @returns Promise 封装的结果
   */
  async getDocumentInfo(): Promise<PSResult<DocumentInfo>> {
    return this.evalScript<DocumentInfo>("$.HostScript.getDocumentInfo()");
  }

  /**
   * 获取选中文本图层的字体信息
   * @returns Promise 封装的结果
   */
  async getTextLayerInfo(): Promise<PSResult<TextLayerInfo>> {
    return this.evalScript<TextLayerInfo>("$.HostScript.getTextLayerInfo()");
  }

  /**
   * 单独检测字符尺寸（仅测量，不导出）
   * @param config 导出配置
   */
  async measureCharacters(config: BatchExportConfig): Promise<PSResult<{ maxWidth: number; maxHeight: number }>> {
    var configJson = JSON.stringify(config);
    return this.evalScript<{ maxWidth: number; maxHeight: number }>(
      "$.HostScript.measureCharacters('" + this.escapeForSingleQuotedString(configJson) + "')"
    );
  }

  /**
   * 获取当前文档的文件路径
   * @returns Promise 封装的结果
   */
  async getDocumentPath(): Promise<PSResult<{ path: string }>> {
    return this.evalScript<{ path: string }>("$.HostScript.getDocumentPath()");
  }

  /**
   * 打开文件夹选择对话框
   * @returns Promise 封装的结果，包含选中的文件夹路径
   */
  async selectFolder(): Promise<PSResult<{ path: string }>> {
    return this.evalScript<{ path: string }>("$.HostScript.selectFolderDialog()");
  }

  /**
   * 读取文件内容
   * @param filePath 文件路径
   */
  async readFile(filePath: string): Promise<PSResult<string>> {
    var safePath = this.escapeForSingleQuotedString(filePath);
    return this.evalScript<string>(
      "$.HostScript.readFile('" + safePath + "')"
    );
  }

  /**
   * 写入文件内容
   * @param filePath 文件路径
   * @param content 文件内容
   */
  async writeFile(filePath: string, content: string): Promise<PSResult<void>> {
    var safePath = this.escapeForSingleQuotedString(filePath);
    var safeContent = this.escapeForSingleQuotedString(content);
    return this.evalScript<void>(
      "$.HostScript.writeFile('" + safePath + "', '" + safeContent + "')"
    );
  }

  /**
   * 确保目录存在
   * @param dirPath 目录路径
   */
  async ensureDirectory(dirPath: string): Promise<PSResult<void>> {
    var safePath = this.escapeForSingleQuotedString(dirPath);
    return this.evalScript<void>(
      "$.HostScript.ensureDirectory('" + safePath + "')"
    );
  }

  /**
   * 获取插件扩展目录路径
   */
  async getExtensionPath(): Promise<PSResult<{ path: string }>> {
    return this.evalScript<{ path: string }>("$.HostScript.getExtensionPath()");
  }

  /**
   * 批量导出文本图层中的每个字符为独立图片
   * @param config 导出配置
   * @returns Promise 封装的结果
   */
  async batchExport(config: BatchExportConfig): Promise<PSResult<BatchExportResult>> {
    var configJson = JSON.stringify(config);
    return this.evalScript<BatchExportResult>(
      "$.HostScript.batchExport('" + this.escapeForSingleQuotedString(configJson) + "')"
    );
  }

  /**
   * 获取当前选中的所有图层信息
   */
  async getSelectedLayersInfo(): Promise<PSResult<SelectedLayersInfo>> {
    return this.evalScript<SelectedLayersInfo>("$.HostScript.getSelectedLayersInfo()");
  }

  /**
   * 多图层批量测量（仅测量尺寸，不导出）
   */
  async measureLayers(): Promise<PSResult<MeasureLayersResult>> {
    return this.evalScript<MeasureLayersResult>("$.HostScript.measureLayers()");
  }

  /**
   * 多图层批量导出
   * @param config 导出配置
   */
  async batchExportLayers(config: BatchExportLayersConfig): Promise<PSResult<BatchExportLayersResult>> {
    var configJson = JSON.stringify(config);
    return this.evalScript<BatchExportLayersResult>(
      "$.HostScript.batchExportLayers('" + this.escapeForSingleQuotedString(configJson) + "')"
    );
  }
}

/**
 * 导出 PSBridge 单例
 */
export const psBridge = new PSBridge();
