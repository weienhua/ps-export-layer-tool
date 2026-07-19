# PS 图层导出工具

Photoshop CEP 面板插件，用于快速导出 PS 文档中的图层资源。基于 [photoshop-script-api](https://github.com/emptykid/photoshop-script-api) 构建，兼容 PS 2019（v20.0）及以上版本。

## 功能特性

- **图层导出**：支持将 PS 文档中的图层导出为独立图片文件
- **格式支持**：支持 PNG、JPEG、BMP 等常见图片格式导出
- **批量处理**：支持批量选择和导出多个图层
- **面板 UI**：Vue 3 构建的交互面板，操作直观
- **调试面板**：内置可收起的通信日志查看器（含耗时显示）
- **Toast 提示**：操作反馈动画提示
- **自动化脚本**：安装/卸载/打包/发布（`pkg` 生成独立可执行文件）
- **跨平台**：支持 Windows/macOS，PS 2019 (v20.0) 及以上

## 技术栈

- **面板侧**: Vue 3 SFC + TypeScript + webpack(vue-loader) → ES6
- **宿主侧**: TypeScript + photoshop-script-api + webpack → ES3 (ExtendScript)
- **通信**: CEP `evalScript` 桥接
- **CEP 版本**: 9.0+
- **兼容 Photoshop**: 2019 (v20.0) 及以上

## 项目结构

```
├── CSXS/
│   └── manifest.xml              # CEP 扩展清单
├── src/
│   ├── main.ts                   # Vue 入口
│   ├── App.vue                   # 根组件
│   ├── components/               # Vue SFC 组件
│   │   ├── DocInfo.vue           # 文档信息（通信链示例）
│   │   ├── StatusBar.vue         # 状态栏
│   │   ├── Toast.vue             # Toast 提示
│   │   └── DebugPanel.vue        # 调试面板
│   ├── composables/
│   │   └── useToast.ts           # Toast
│   ├── types/
│   │   ├── index.ts              # 共享类型
│   │   └── cep-panel.d.ts        # CEP 面板类型声明
│   ├── vue-shims.d.ts            # Vue SFC 类型声明
│   ├── jsx/
│   │   ├── hostscript.ts         # 宿主脚本入口
│   │   ├── modules/              # 宿主脚本模块
│   │   │   ├── types.d.ts        # ActionManager 类型
│   │   │   ├── utils.ts          # 工具函数
│   │   │   ├── document.ts       # 文档/图层查询
│   │   │   └── fileOps.ts        # 文件操作
│   │   └── ps-api/               # photoshop-script-api（vendored）
│   ├── lib/
│   │   └── CSInterface.js        # Adobe CEP 库（v9.4.0）
│   ├── bridge.ts                 # PS 通信桥接层
│   ├── index.html                # 面板 HTML 模板
│   └── style.css                 # 全局基础样式（暗色主题）
├── doc/
│   ├── Windows.png               # Windows 安装示意图
│   └── csxs.reg/                 # Windows 注册表文件（调试模式）
├── psdoc/                        # PS 脚本参考文档
│   ├── references/               # ActionManager API 文档 + 示例脚本
│   └── *.pdf                     # PS 脚本指南 PDF
├── dist/                         # 构建产物
├── scripts/
│   ├── install.js                # 自动安装脚本
│   ├── uninstall.js              # 卸载脚本
│   ├── build-installer.js        # 打包脚本
│   └── release.js                # 发布脚本
├── webpack.config.js             # 面板 webpack 配置
├── webpack.config.jsx.js         # 宿主脚本 webpack 配置
└── package.json
```

## 安装

### 方式一：自动安装（推荐）

下载安装程序，运行即可自动完成安装：

- **Windows**: 下载 `com.ps.export.layer.tool-installer.exe`，双击运行
- **macOS**: 下载 `com.ps.export.layer.tool-installer-macos`，右键选择"打开"或使用终端运行：
  ```bash
  chmod +x com.ps.export.layer.tool-installer-macos
  ./com.ps.export.layer.tool-installer-macos
  ```

安装程序会自动：
1. 检测已安装的 Photoshop 版本
2. 复制插件文件到 CEP 扩展目录
3. 开启调试模式

**卸载方法**：
- **Windows**: 双击运行 `com.ps.export.layer.tool-uninstaller.exe`
- **macOS**: 右键选择"打开"或使用终端运行：
  ```bash
  chmod +x com.ps.export.layer.tool-uninstaller-macos
  ./com.ps.export.layer.tool-uninstaller-macos
  ```

### 方式二：手动安装

#### 1. 构建项目

```bash
npm install
npm run build
```

#### 2. 安装到 Photoshop

**Windows (PowerShell 管理员)**:
```powershell
New-Item -ItemType Junction `
  -Path "$env:APPDATA\Adobe\CEP\extensions\com.ps.export.layer.tool" `
  -Target (Get-Location)
```

**macOS**:
```bash
ln -s $(pwd) ~/Library/Application\ Support/Adobe/CEP/extensions/com.ps.export.layer.tool
```

**删除链接**（仅移除链接，不影响源目录内容）：

```powershell
# Windows（PowerShell）
cmd /c rmdir "$env:APPDATA\Adobe\CEP\extensions\com.ps.export.layer.tool"
```
```bash
# macOS
unlink ~/Library/Application\ Support/Adobe/CEP/extensions/com.ps.export.layer.tool
```

**查看链接状态**：

```powershell
# Windows（PowerShell）
Get-Item "$env:APPDATA\Adobe\CEP\extensions\com.ps.export.layer.tool" | Select-Object Attributes, LinkType, Target
```
```bash
# macOS
ls -la ~/Library/Application\ Support/Adobe/CEP/extensions/ | grep export-layer
```

#### 3. 启用调试模式

**Windows (注册表)**:
```powershell
# CEP 9 (PS 2019)
New-Item -Path "HKCU:\Software\Adobe\CSXS.9" -Force
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.9" `
  -Name "PlayerDebugMode" -Value "1" -Type DWord

# CEP 10 (PS 2020-2021)
New-Item -Path "HKCU:\Software\Adobe\CSXS.10" -Force
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.10" `
  -Name "PlayerDebugMode" -Value "1" -Type DWord

# CEP 11 (PS 2022+)
New-Item -Path "HKCU:\Software\Adobe\CSXS.11" -Force
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" `
  -Name "PlayerDebugMode" -Value "1" -Type DWord
```

也可使用 `doc/csxs.reg/` 目录中的注册表文件直接导入。

**macOS**:
```bash
defaults write com.adobe.CSXS.9 PlayerDebugMode 1    # PS 2019
defaults write com.adobe.CSXS.10 PlayerDebugMode 1   # PS 2020-2021
defaults write com.adobe.CSXS.11 PlayerDebugMode 1   # PS 2022+
```

#### 4. 重启 Photoshop

在菜单中找到: **窗口 > 扩展功能 > PS 图层导出工具**

## 调试指南

### 面板侧调试 (Chromium DevTools)

1. **打开调试页面**：在 Chrome 浏览器中访问 `http://localhost:8088`
2. **查看控制台日志**：使用 `console.log` / `console.error`
3. **调试面板代码**：Chrome DevTools 中可看到 `bundle.js`，配合 Source Map 调试原始 TypeScript

### 宿主脚本调试

1. 使用 `$.writeln()` 输出日志（面板内置的调试面板也可查看通信日志）
2. 日志位置: `~/Library/Logs/Adobe/Photoshop/ScriptingListener.log` (macOS)

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `CSInterface is not defined` | CSInterface.js 未加载 | 检查 `dist/lib/CSInterface.js` 是否存在 |
| `EvalScript error` | 宿主脚本语法错误 | 检查 `dist/jsx/hostscript.js` 语法 |
| 面板白屏 | HTML/JS 加载失败 | 检查浏览器控制台错误信息 |
| 宿主脚本不生效 | PS 缓存旧脚本 | 重启 Photoshop 或重新加载扩展 |
| 修改代码后不更新 | 未重新构建 | 运行 `npm run build` 后重启 PS |

## 发布新版本

使用 `npm run release` 自动管理版本号：

```bash
npm run release patch   # 1.0.0 → 1.0.1（bug 修复）
npm run release minor   # 1.0.0 → 1.1.0（新功能）
npm run release major   # 1.0.0 → 2.0.0（破坏性变更）
npm run release 1.2.3   # 直接指定版本号
```

命令会自动：
1. 更新 `package.json` 版本号
2. 构建项目并生成安装包（zip + exe）
3. 提交代码并创建 git tag
4. 推送到 GitHub

## 开发

### 构建命令

```bash
npm run build              # 完整构建（开发模式，显示调试面板）
npm run build:jsx          # 仅构建宿主脚本
npm run build:panel        # 仅构建面板（开发模式）
npm run build:panel:prod   # 面板生产模式构建
npm run dev                # 同时启动面板 + 宿主 watch
npm run dev:panel          # 仅面板 watch
npm run dev:jsx            # 仅宿主 watch
npm run clean              # 清理 dist 和 installer
npm run package            # 生产模式构建 + 打包发布文件（zip + 安装程序）到 installer/
```

### 打包说明

`npm run package` 会生成以下文件：

| 文件 | 说明 | 平台 |
|------|------|------|
| `com.ps.export.layer.tool-vX.X.X.zip` | 手动安装包 | 跨平台 |
| `com.ps.export.layer.tool-installer.exe` | Windows 自动安装程序 | Windows |
| `com.ps.export.layer.tool-installer-macos` | macOS 自动安装程序 | macOS |
| `com.ps.export.layer.tool-uninstaller.exe` | Windows 卸载程序 | Windows |
| `com.ps.export.layer.tool-uninstaller-macos` | macOS 卸载程序 | macOS |

**跨平台打包**：`pkg` 支持交叉编译，可在 macOS 上同时生成 Windows 和 macOS 安装程序。

### 添加新功能

1. **宿主脚本** (`src/jsx/modules/`):
   ```typescript
   // 在对应模块文件中添加函数（如 modules/document.ts）
   export function myNewFunction(param: string): string {
     try {
       // PS ExtendScript 逻辑
       return JSON.stringify(result);
     } catch (e) {
       return "__ERROR__:" + e;
     }
   }
   // 在 hostscript.ts 中导入并注册
   import { myNewFunction } from "./modules/document";
   $.HostScript.myNewFunction = myNewFunction;
   ```

2. **桥接层** (`src/bridge.ts`):
   ```typescript
   async myNewFunction(param: string): Promise<PSResult<SomeType>> {
     var safe = this.escapeForSingleQuotedString(param);
     return this.evalScript<SomeType>("$.HostScript.myNewFunction('" + safe + "')");
   }
   ```

3. **Vue 组件** (`src/components/`):
   ```vue
   <script setup lang="ts">
   import { psBridge } from "../bridge";
   var result = await psBridge.myNewFunction('test');
   </script>
   ```

4. 重新构建: `npm run build`

## 许可证

MIT
