# PS 图层导出工具 — PS CEP 插件

Photoshop CEP 面板插件，用于快速导出 PS 文档中的图层资源。兼容 PS 2019（v20.0）及以上版本。

## 技术栈

- **面板侧**：Vue 3 SFC + TypeScript → webpack(vue-loader + ts-loader) → ES6 bundle
- **宿主脚本侧**：TypeScript → webpack(ts-loader, target: ES3) → ES3（ExtendScript，PS 进程内执行）
- **宿主运行时增强**：`extendscript-es5-shim`（ES5 API polyfill）/ `cep-shim`（面板侧 CEP 垫片）
- **宿主工具库**：`photoshop-script-api`（vendored in `src/jsx/ps-api/`，Apache 2.0）
- **类型**：`ps-extendscript-types`（宿主）/ 自定义 `cep-panel.d.ts`（面板）
- **CEP 版本**：9.0+，扩展 ID：`com.ps.export.layer.tool`

## 项目结构

```
├── CSXS/manifest.xml          # CEP 清单，宿主版本、面板尺寸、路径配置
├── src/
│   ├── main.ts                # Vue 入口：createApp(App).mount('#app')
│   ├── App.vue                # 根组件：DocInfo + StatusBar + DebugPanel + Toast
│   ├── components/            # Vue SFC 组件
│   │   ├── DocInfo.vue        # 文档信息 + 定时刷新（面板→bridge→hostscript 示例）
│   │   ├── StatusBar.vue      # 底部状态栏
│   │   ├── Toast.vue          # Toast 提示（provide/inject）
│   │   ├── DebugPanel.vue     # 调试面板（通信日志）
│   │   ├── TabBar.vue         # Tab 导航栏
│   │   ├── BatchExportTab.vue # 批量导出 Tab（文本图层字符批量导出为 web 素材）
│   │   ├── SectionCollapsible.vue # 可折叠卡片区域（折叠状态持久化到 localStorage）
│   │   └── AnchorGrid.vue     # 3×3 锚点网格选择器 + 下拉框
│   ├── composables/
│   │   └── useToast.ts        # Toast composable（inject）
│   ├── types/
│   │   ├── index.ts           # 共享类型：AnchorType, ExportFormat, TextLayerInfo, BatchExportConfig, BatchExportResult 等
│   │   └── cep-panel.d.ts     # CSInterface 全局类型（最小化声明）
│   ├── bridge.ts              # evalScript 封装，Promise 化通信 + 日志回调
│   ├── index.html             # 精简版 HTML（挂载点 + CSInterface + bundle）
│   └── style.css              # 全局基础样式（reset、CSS 变量、按钮、表单）
│   ├── lib/
│   │   └── CSInterface.js     # Adobe 官方 CEP 库 v9.4.0，不要修改，构建时原样复制
│   ├── vue-shims.d.ts         # Vue SFC 类型声明
│   └── jsx/
│       ├── hostscript.ts      # 宿主脚本入口（import + $.HostScript 注册）
│       ├── modules/
│       │   ├── types.d.ts     # 共享类型声明（ActionManager API）
│       │   ├── utils.ts       # 通用工具（log、rgbToHex、roundValue）
│       │   ├── document.ts    # 文档/图层基础查询
│       │   ├── fileOps.ts     # 文件系统操作
│       │   └── batchExport.ts # 批量导出（文本检测 + 字符测量 + 批量导出，全部 raw ActionManager）
│       └── ps-api/            # photoshop-script-api 子项目（vendored，ES3 兼容）
├── dist/                      # 构建产物，不要手动编辑
│   ├── index.html / bundle.js # 面板产物（CSS 打包进 bundle.js）
│   ├── lib/
│   │   └── CSInterface.js     # 从 src/lib/ 原样复制
│   └── jsx/hostscript.js      # webpack 构建产物（ES3）
├── doc/
│   ├── Windows.png            # Windows 安装示意图
│   └── csxs.reg/              # Windows 注册表文件（PlayerDebugMode，CSXS 6-11）
├── psdoc/                     # PS 脚本参考文档和 ActionManager 脚本示例
│   ├── references/            # API 文档 + 示例脚本
│   └── *.pdf                  # PS 脚本指南 PDF
├── scripts/
│   ├── install.js             # 自动安装脚本
│   ├── uninstall.js           # 卸载脚本
│   ├── build-installer.js     # 打包脚本（zip + pkg 可执行文件）
│   └── release.js             # 发布脚本
├── tsconfig.json              # 面板侧：target ES6，jsx: preserve，排除 src/jsx/
├── tsconfig.jsx.json          # 宿主侧：target ES3，types: [ps-extendscript-types]
├── webpack.config.js          # 面板 webpack：vue-loader + ts-loader + css-loader
├── webpack.config.jsx.js      # 宿主 webpack：entry hostscript.ts → hostscript.js
└── package.json               # pnpm / npm
```

## 构建命令

```bash
npm install                # 安装依赖
npm run build              # 完整构建（开发模式，显示调试面板）
npm run build:jsx          # 仅构建宿主脚本（webpack --config webpack.config.jsx.js）
npm run build:panel        # 仅构建面板（开发模式）
npm run dev                # 同时启动面板 + 宿主 watch（concurrently）
npm run dev:panel          # 仅面板 webpack watch（开发模式）
npm run dev:jsx            # 仅宿主 webpack watch（开发模式）
npm run clean              # rimraf dist installer
npm run package            # 生产模式构建 + 打包发布文件（zip + 安装程序）到 installer/
```

### 打包产物

`npm run package` 生成：
- `com.ps.export.layer.tool-vX.X.X.zip` — 跨平台手动安装包
- `com.ps.export.layer.tool-installer.exe` — Windows 自动安装程序
- `com.ps.export.layer.tool-installer-macos` — macOS 自动安装程序
- `com.ps.export.layer.tool-uninstaller.exe` — Windows 卸载程序
- `com.ps.export.layer.tool-uninstaller-macos` — macOS 卸载程序

`pkg` 支持交叉编译，可在 macOS 上同时生成 Windows 和 macOS 安装程序。

## 架构：两个隔离的执行上下文

```
面板（Chromium）                          PS 宿主（ExtendScript）
────────────────                          ──────────────────────
src/index.ts                              src/jsx/hostscript.ts
src/bridge.ts                                 ↓ webpack(ts-loader, target: ES3)
    │                                     dist/jsx/hostscript.js
    │  cs.evalScript("fn()")  ──────────→     全局函数（$.HostScript.*）
    │  callback(result)       ←──────────     return string
    ↓
Promise<PSResult<T>>
```

**关键约束**：两侧完全隔离，只能通过字符串传递数据。

## 代码规范

### ExtendScript 兼容性

- **三元运算符**：`src/jsx/hostscript.ts` 中避免使用三元运算符，改用 `if/else`（ExtendScript 兼容性）
- **hasKey 缓存**：`hasKey()` 等方法在 `if-else if` 结构中多次调用时可能产生不可预期的行为。**必须将结果缓存到变量**后再进行条件判断，避免重复调用。示例：
  ```typescript
  // ✗ 错误写法
  if (obj.hasKey(s2t("red"))) { ... }
  else if (obj.hasKey(s2t("redFloat"))) { ... }

  // ✓ 正确写法
  var hasRed = obj.hasKey(s2t("red"));
  var hasRedFloat = obj.hasKey(s2t("redFloat"));
  if (hasRed && !hasRedFloat) { ... }
  else if (!hasRed && hasRedFloat) { ... }
  ```
- **ES3 + shim 能力边界**（`target: ES3` + `extendscript-es5-shim`）：
  - `const`/`let`、箭头函数、模板字符串等语法 → 由 TypeScript 编译降级，可使用
  - 部分 ES5 API（如常见数组/对象辅助方法）→ 由 `extendscript-es5-shim` 在运行时补充，通常可用
  - ExtendScript/Photoshop 宿主限制（DOM 能力、执行环境差异）→ 仍然存在，不会被 shim 消除
  - 对兼容性敏感的逻辑建议优先使用保守写法，并加 `try/catch` 兜底

### CSS 兼容性

- **避免使用 `gap`**：Vue scoped styles + CEP Chromium 环境下兼容性差，改用 `margin` + 兄弟选择器：
  ```css
  .parent > * + * { margin-left: Npx; }
  ```

### Vue 模板兼容性

- 模板中避免使用反引号模板字符串（与 `{{ }}` 冲突），用字符串拼接代替

### 宿主脚本约定

- **ps-api 优先**：宿主脚本中需要 PS 操作时，优先查阅 `src/jsx/ps-api/API.md` 是否已有封装方法（如 `exportToBMP`、`duplicateToDocument`、`History.saveState` 等），这些方法经过验证可直接使用
- **ps-api 导入统一入口**：所有 ps-api 类（`Document`、`Layer`、`Text`、`SolidColor` 等）必须从 `src/jsx/ps-api/src/index.ts` 统一导入，**禁止**从 `src/jsx/ps-api/src/lib/` 子路径单独导入。单独导入会导致 webpack 模块路径解析不一致，引发整个 hostscript 运行时 `EvalScript error`。
- **ps-api Layer.id 是属性不是方法**：`layer.id` 返回数字（属性），不能写 `layer.id()`。`layer.name()`、`layer.bounds()` 等是方法，但 `id`、`index` 是属性。
- **bounds() 必须包含效果**：测量和导出时使用 `layer.bounds()`（含图层效果范围），禁止使用 `boundsNoEffects()`（仅文本内容）。
  ```typescript
  // ✓ 正确写法
  import { Document, Layer, Text, SolidColor } from "../ps-api/src/index";

  // ✗ 错误写法 — 会导致 webpack 模块冲突，hostscript 全部报错
  import { Document } from "../ps-api/src/lib/Document";
  import { Layer } from "../ps-api/src/lib/Layer";
  ```
- 若 ps-api 无对应方法，再查阅 `psdoc/references/` 中的 ActionManager 脚本示例和 API 文档作为参考
- 仅在两者都无现成方案时才从零编写 ActionManager 代码
- 所有通过 `$.HostScript` 暴露的函数必须是**全局函数**，返回值只能是**字符串**
- 返回值约定：
  - 正常结果 → JSON 字符串
  - `"__OK__"` → 操作成功（无返回值）
  - `"__NO_DOCUMENT__"` → 无打开文档
  - `"__CANCEL__"` → 用户取消操作（如文件夹选择对话框）
  - `"__ERROR__:<msg>"` → 运行时异常

### 颜色值格式处理

在读取 ActionDescriptor 中的颜色值时，需要同时支持整数格式和浮点数格式：

- **整数格式**：`red`/`grain`/`blue`，范围 0-255
- **浮点数格式**：`redFloat`/`greenFloat`/`blueFloat`，范围 0.0-1.0

**处理策略**：优先检查浮点数格式，再检查整数格式。浮点数需要乘以 255 并四舍五入转换为整数。

**示例代码**：
```typescript
// 优先检查浮点数格式（文本图层使用此格式）
if (desc.hasKey(app.stringIDToTypeID("redFloat"))) {
    const r = desc.getDouble(app.stringIDToTypeID("redFloat"));
    const g = desc.getDouble(app.stringIDToTypeID("greenFloat"));
    const b = desc.getDouble(app.stringIDToTypeID("blueFloat"));
    return new SolidColor(
        Math.min(Math.round(r * 255), 255),
        Math.min(Math.round(g * 255), 255),
        Math.min(Math.round(b * 255), 255)
    );
}
// 再检查整数格式（其他图层类型使用此格式）
if (desc.hasKey(app.stringIDToTypeID("red"))) {
    const red = desc.getDouble(app.stringIDToTypeID("red"));
    const green = desc.getDouble(app.stringIDToTypeID("grain"));
    const blue = desc.getDouble(app.stringIDToTypeID("blue"));
    return new SolidColor(red, green, blue);
}
```

**注意事项**：
- 使用 `getDouble()` 读取浮点数，而不是 `getInteger()`
- 浮点数转换后需要限制在 0-255 范围内，使用 `Math.min(Math.round(x * 255), 255)`
- 整数格式的绿色键名为 `grain`（历史遗留问题），而非 `green`
- 文本图层的颜色通常存储在浮点数格式中，若只读取整数格式会导致颜色显示为黑色

### 面板通信约定（src/bridge.ts）

所有 PS 通信必须经过 `PSBridge`，禁止在 Vue 组件中直接调用 `CSInterface`。

```typescript
async getDocumentInfo(): Promise<PSResult<DocumentInfo>> {
  return this.evalScript<DocumentInfo>("$.HostScript.getDocumentInfo()");
}
```

面板侧解析返回值时通过 `parseResult` 统一处理：`__ERROR__:` → error、`__NO_DOCUMENT__` → noDocument、`__OK__` → 空成功、JSON → data、其他 → string data。

**超时保护**：`evalScript` 内部有 10 秒超时，超时后返回 `{ success: false, error: 'timeout' }`。

**调试支持**：通过 `setLogCallback()` 注册回调，可将通信日志实时输出到面板内的调试面板。

### 通用规范

- TS 代码使用 JSDoc + 中文描述，函数、类、接口必须有注释
- Vue 组件使用 `<script setup lang="ts">` 组合式 API，共享类型从 `src/types/index.ts` 导入
- 全局基础样式在 `src/style.css`，组件样式用 `<style scoped>`
- `CSInterface.js` 来自 Adobe CEP-Resources v9.4.0，不要修改，构建时原样复制
- `dist/` 为构建产物，不要手动编辑

## 宿主脚本约定（src/jsx/hostscript.ts + modules/）

宿主脚本采用模块化结构，入口文件 `hostscript.ts` 负责导入和注册，各功能分布在 `modules/` 子目录中：

```
src/jsx/
├── hostscript.ts          # 入口：import + $.HostScript 注册
├── modules/
│   ├── types.d.ts         # 共享类型声明（ActionManager API）
│   ├── utils.ts           # 通用工具（log、rgbToHex、roundValue）
│   ├── document.ts        # 文档/图层基础查询
│   ├── fileOps.ts         # 文件系统操作
│   └── batchExport.ts     # 批量导出（文本检测 + 字符测量 + 批量导出）
└── ps-api/                # photoshop-script-api（vendored）
```

已注册的宿主函数：

| 函数 | 所属模块 | 说明 |
|------|---------|------|
| `getDocumentInfo()` | document.ts | 文档名、尺寸 |
| `getDocumentPath()` | document.ts | 文档文件路径（需用 `.fsName` 取字符串） |
| `getTextLayerInfo()` | batchExport.ts | 读取选中文本图层的字体/颜色/样式 |
| `measureCharacters(configJson)` | batchExport.ts | 测量字符宽高，返回 maxWidth/maxHeight |
| `batchExport(configJson)` | batchExport.ts | 完整批量导出（测量 + 导出） |
| `selectFolderDialog()` | fileOps.ts | 原生文件夹选择对话框 |

```typescript
// 在对应模块文件中定义并导出函数（如 modules/document.ts）
export function getDocumentInfo(): string {
  try {
    if (app.documents.length === 0) return "__NO_DOCUMENT__";
    var doc = Document.activeDocument();
    var size = doc.size();
    return JSON.stringify({ name: doc.name(), width: size.width, height: size.height });
  } catch (e) {
    return "__ERROR__:" + e;
  }
}
```

入口文件导入并注册：
```typescript
// hostscript.ts
import { getDocumentInfo } from "./modules/document";

$ = $ || {};
$.HostScript = {
  getDocumentInfo,
};
```

## photoshop-script-api 子项目（src/jsx/ps-api/）

vendored 自 [photoshop-script-api](https://github.com/emptykid/photoshop-script-api) v1.0.4（Apache 2.0）。

提供面向对象的 PS ExtendScript API 封装：
- **核心**：`Application`、`Document`、`Layer`、`Selection`
- **工具**：`MoveTool`、`RulerTool`
- **颜色**：`SolidColor`、`GradientColor`
- **特效**：`FXDropShadow`、`FXColorOverlay`、`FXStroke`、`FXGradientFill`
- **文本**：`Text`（含字体、字号、颜色、对齐等子模块）
- **形状**：`Shape`（含 `Rectangle`、`Ellipse`、`Line` 等子类型）
- **辅助**：`Rect`、`Size`、`Utils`、`Guide`、`History`、`MetaData` 等

## 面板 UI 功能

### Tab 布局

- **TabBar**：双 tab 导航（「图层工具」「批量导出」），选中状态持久化到 `localStorage`（key: `exportLayerTool.activeTab.v1`）
- **图层工具** tab：占位（后续扩展）

### 批量导出 Tab（BatchExportTab）

选中 PS 文本图层后，一键将每个字符导出为统一画布尺寸的 web 素材（PNG/JPG）。

**核心流程**：
1. 轮询检测选中图层（有文档 1s 间隔，无文档停止）→ 自动读取字体/字号/颜色/样式/抗锯齿/图层效果
2. 配置导出字符、文件名前缀、画布尺寸（自动检测 + 边距 或 手动输入）、对齐方式（9 点锚位）
3. 自动默认路径为 PSD 所在目录下的 `output/` 子文件夹
4. 点击「开始导出」→ 自动模式：测量每个字符最大宽高 → 以统一画布逐字符导出；手动模式：直接以指定尺寸逐字符导出（跳过测量阶段）

**子组件**：
- **SectionCollapsible**：可折叠卡片，状态持久化到 `localStorage`（key: `exportLayerTool.sectionStates.v1`）。参考 ps-layer-tool 设计
- **AnchorGrid**：3×3 锚点网格 + 下拉选择器

### 其他基础组件

- **DocInfo**：显示当前文档名和尺寸，每 60 秒自动刷新（展示完整通信链示例）
- **StatusBar**：底部状态提示（就绪/成功/错误）
- **Toast**：操作反馈提示框（2s 显示 + 0.3s 淡出动画）
- **DebugPanel**：可收起的调试面板，带通信日志查看器（实时显示 send/receive/error 及耗时）

## 添加新功能的步骤

1. 如需新的共享类型，添加到 `src/types/index.ts`
2. 在 `src/jsx/modules/` 对应模块文件中添加函数（遵守 ES3 + 返回字符串约定 + `export` 导出）
   - 如需新的 ActionManager API，在 `modules/types.d.ts` 中添加声明
   - 导入 ps-api 类时**必须从 `src/jsx/ps-api/src/index.ts` 统一入口导入**，禁止从 `lib/` 子路径单独导入（会导致 webpack 模块冲突，hostscript 全部报 `EvalScript error`）
3. 在 `src/jsx/hostscript.ts` 中导入函数并在 `$.HostScript` 注册
4. `src/bridge.ts` 暴露对应异步方法
5. `src/components/` 创建或修改 Vue 组件（`<script setup lang="ts">`）
6. `npm run build` 重新构建

## 类型声明

| 文件 | 作用域 | 内容 |
|------|--------|------|
| `src/types/cep-panel.d.ts` | 面板侧 | `CSInterface` 类、`HostEnvironment`、`CSEvent` |
| `src/types/index.ts` | 面板侧 + 共享 | `AnchorType`（9 点锚位）、`ExportFormat`（png/jpg）、`SizeMode`（auto/manual）、`TextLayerInfo`（字体信息）、`BatchExportConfig`（导出配置）、`BatchExportResult`（导出结果） |
| `src/jsx/modules/types.d.ts` | 宿主脚本侧 | ActionManager 全局 API（`executeActionGet`、`stringIDToTypeID` 等） |
| `ps-extendscript-types`（npm） | 宿主脚本侧 | PS ExtendScript DOM（`app`、`Document`、`ArtLayer` 等） |

三套类型通过 tsconfig 隔离：`tsconfig.json` 的 `types: []` 不引入任何 npm 类型，`tsconfig.jsx.json` 的 `types: ["ps-extendscript-types"]` 仅作用于 `src/jsx/`。`modules/types.d.ts` 由 TypeScript 自动识别（`.d.ts` 文件无需显式导入）。

## 安装插件到 PS

### macOS — 符号链接（开发推荐）

```bash
ln -s $(pwd) ~/Library/Application\ Support/Adobe/CEP/extensions/com.ps.export.layer.tool
```

### Windows — 目录联接（管理员 PowerShell）

```powershell
New-Item -ItemType Junction -Path "$env:APPDATA\Adobe\CEP\extensions\com.ps.export.layer.tool" -Target (Get-Location)
```

### 删除链接（仅移除链接，不影响源目录内容）

```bash
# macOS
unlink ~/Library/Application\ Support/Adobe/CEP/extensions/com.ps.export.layer.tool

# Windows（PowerShell，用 cmd /c rmdir 避免误删源目录）
cmd /c rmdir "$env:APPDATA\Adobe\CEP\extensions\com.ps.export.layer.tool"
```

### 查看链接状态

```bash
# macOS
ls -la ~/Library/Application\ Support/Adobe/CEP/extensions/ | grep export-layer

# Windows（PowerShell）
Get-Item "$env:APPDATA\Adobe\CEP\extensions\com.ps.export.layer.tool" | Select-Object Attributes, LinkType, Target
```

### 开启 CEP 调试模式

**macOS**：
```bash
defaults write com.adobe.CSXS.9 PlayerDebugMode 1    # PS 2019
defaults write com.adobe.CSXS.10 PlayerDebugMode 1   # PS 2020-2021
defaults write com.adobe.CSXS.11 PlayerDebugMode 1   # PS 2022+
```

**Windows（注册表）**：
```powershell
# CEP 9 (PS 2019)
New-Item -Path "HKCU:\Software\Adobe\CSXS.9" -Force
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.9" -Name "PlayerDebugMode" -Value "1" -Type DWord

# CEP 10 (PS 2020-2021)
New-Item -Path "HKCU:\Software\Adobe\CSXS.10" -Force
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.10" -Name "PlayerDebugMode" -Value "1" -Type DWord

# CEP 11 (PS 2022+)
New-Item -Path "HKCU:\Software\Adobe\CSXS.11" -Force
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode" -Value "1" -Type DWord
```

也可使用 `doc/csxs.reg/` 目录中的注册表文件直接导入。

调试地址：`http://localhost:8088`（Chrome DevTools）

## 常见问题排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `CSInterface is not defined` | `dist/lib/CSInterface.js` 不存在 | 放置 `src/lib/CSInterface.js` 后重新 build |
| `EvalScript error.` | 宿主脚本语法错误或未编译 | 运行 `npm run build:jsx`，检查 `dist/jsx/hostscript.js` |
| 宿主类型报错（找不到 `app`） | ps-extendscript-types 未引入 | 确认 `tsconfig.jsx.json` 中 `types: ["ps-extendscript-types"]` |
| 修改 JSX 后不生效 | PS 缓存旧脚本 | 重启 PS 或重新加载扩展 |
| 面板白屏 | HTML/JS 加载失败 | 打开 `http://localhost:8088` 检查控制台错误 |
| 导出素材裁切 | overflow 检查必须使用 `if-else if`（非两个独立 `if`），否则 bounds 大于画布时 top/bottom 检查冲突 | overflow 逻辑已修复 |
| Layer.id 报错 "not callable" | `layer.id` 是属性（数字），不是方法 | 使用 `layer.id` 而非 `layer.id()` |
| 超大字号测量失败 | 工作文档硬编码 2000×2000 | 使用 `calcWorkDocSize(fontSize)` 动态计算 |
| 手动模式导出慢 | 仍执行完整测量流程 | 手动模式跳过 Phase 2，直接进入导出 |
| 边距太小导致裁切 | 默认 `paddingW=2, paddingH=3` | 默认改为 10/10，且持久化到 localStorage |
| 抗锯齿不一致 | 导出素材边缘不平滑 | 从原图层读取 antiAlias 并应用 |

## 会话交接约定

每次新 session 开始时，先读取 `handoffs/` 目录下最新的交接文档（按日期排序取最新），了解上次会话的上下文、进行中的工作和下一步计划。

交接文档命名格式：`YYYY-MM-DD-<简短描述>.md`，模板见 `handoffs/TEMPLATE.md`。
