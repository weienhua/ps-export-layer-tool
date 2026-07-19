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
│   │   └── DebugPanel.vue     # 调试面板（通信日志）
│   ├── composables/
│   │   └── useToast.ts        # Toast composable（inject）
│   ├── types/
│   │   ├── index.ts           # 共享类型：AnchorType, SortType
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
│       │   └── fileOps.ts     # 文件系统操作
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
- 若 ps-api 无对应方法，再查阅 `psdoc/references/` 中的 ActionManager 脚本示例和 API 文档作为参考
- 仅在两者都无现成方案时才从零编写 ActionManager 代码
- 所有通过 `$.HostScript` 暴露的函数必须是**全局函数**，返回值只能是**字符串**
- 返回值约定：
  - 正常结果 → JSON 字符串
  - `"__OK__"` → 操作成功（无返回值）
  - `"__NO_DOCUMENT__"` → 无打开文档
  - `"__CANCEL__"` → 用户取消操作（如文件夹选择对话框）
  - `"__ERROR__:<msg>"` → 运行时异常

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
│   └── fileOps.ts         # 文件系统操作
└── ps-api/                # photoshop-script-api（vendored）
```

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

### 当前示例组件

- **DocInfo**：显示当前文档名和尺寸，每 60 秒自动刷新（展示完整通信链示例）
- **StatusBar**：底部状态提示（就绪/成功/错误）
- **Toast**：操作反馈提示框（2s 显示 + 0.3s 淡出动画）
- **DebugPanel**：可收起的调试面板，带通信日志查看器（实时显示 send/receive/error 及耗时）

## 添加新功能的步骤

1. 在 `src/jsx/modules/` 对应模块文件中添加函数（遵守 ES3 + 返回字符串约定 + `export` 导出）
   - 如需新的 ActionManager API，在 `modules/types.d.ts` 中添加声明
2. 在 `src/jsx/hostscript.ts` 中导入函数并在 `$.HostScript` 注册
3. `src/bridge.ts` 暴露对应异步方法
4. `src/components/` 创建或修改 Vue 组件（`<script setup lang="ts">`）
5. 如需新的共享类型，添加到 `src/types/index.ts`
6. `npm run build` 重新构建

## 类型声明

| 文件 | 作用域 | 内容 |
|------|--------|------|
| `src/types/cep-panel.d.ts` | 面板侧 | `CSInterface` 类、`HostEnvironment`、`CSEvent` |
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

## 会话交接约定

每次新 session 开始时，先读取 `handoffs/` 目录下最新的交接文档（按日期排序取最新），了解上次会话的上下文、进行中的工作和下一步计划。

交接文档命名格式：`YYYY-MM-DD-<简短描述>.md`，模板见 `handoffs/TEMPLATE.md`。
