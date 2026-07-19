# AGENTS.md

## 兼容性

- **Photoshop 版本**: 2019 (v20.0) 及以上
- **CEP 版本**: 9.0+
- **CSInterface.js**: v9.4.0

## 构建命令

```bash
npm run build              # 完整构建（开发模式，显示调试面板）
npm run build:jsx          # 仅编译宿主脚本 (webpack --config webpack.config.jsx.js)
npm run build:panel        # 仅构建面板（开发模式）
npm run dev                # 同时启动面板 + 宿主 watch（concurrently）
npm run dev:panel          # 仅面板 watch 模式
npm run dev:jsx            # 仅宿主 watch 模式
npm run clean              # rimraf dist installer
npm run package            # 生产模式构建 + 打包发布文件（zip + 安装程序）到 installer/
```

## 项目架构

**面板(Chromium) 与 PS 宿主(ExtendScript) 完全隔离**，通过 `evalScript` 字符串通信。

- 面板侧: Vue 3 SFC 组件化架构
  - 入口: `src/main.ts` → `src/App.vue`
  - 组件: `src/components/*.vue`（`<script setup lang="ts">`），含 TabBar、BatchExportTab、SectionCollapsible、AnchorGrid 等
  - 组合式函数: `src/composables/*.ts`
  - 共享类型: `src/types/index.ts`（AnchorType, ExportFormat, SizeMode, TextLayerInfo, BatchExportConfig, BatchExportResult）
- 宿主侧: `src/jsx/hostscript.ts` + `src/jsx/modules/` → webpack(ts-loader, target: ES3) → `dist/jsx/hostscript.js`
  - 入口: `src/jsx/hostscript.ts`（import + $.HostScript 注册）
  - 模块: `src/jsx/modules/`（utils、document、fileOps、batchExport）
  - 共享类型: `src/jsx/modules/types.d.ts`（ActionManager API 声明）
- 宿主工具库: `src/jsx/ps-api/`（photoshop-script-api，vendored），所有类须从 `src/jsx/ps-api/src/index.ts` 统一导入，禁止从 `lib/` 子路径单独导入（会导致 webpack 模块冲突）
- 类型: `src/types/cep-panel.d.ts`（面板）/ `ps-extendscript-types`（宿主）
- 样式: `src/style.css`（全局基础样式）+ 各 `.vue` 组件 `<style scoped>`

## 宿主脚本约定 (关键)

所有函数必须是**全局函数**（挂在 `$.HostScript`），返回值只能是**字符串**：

- 正常 → 返回 JSON 字符串
- 无文档 → `"__NO_DOCUMENT__"`
- 操作成功 → `"__OK__"`
- 用户取消 → `"__CANCEL__"`
- 错误 → `"__ERROR__:<message>"`

```typescript
$.HostScript = {
  getDocumentInfo,      // 文档信息
  getDocumentPath,      // 文档路径（File.fsName）
  getTextLayerInfo,     // 选中文本图层字体/颜色/样式
  measureCharacters,    // 测量字符宽高
  batchExport,          // 完整批量导出
  selectFolderDialog,   // 文件夹选择对话框
};
```

### ES3 兼容性

- `target: ES3` + `extendscript-es5-shim`：语法降级由 TS 编译，ES5 API 由 shim 补充
- **避免三元运算符**：宿主脚本中改用 `if/else`（ExtendScript 兼容性问题）
- **hasKey 缓存**：`hasKey()` 等方法在 `if-else if` 结构中多次调用可能产生不可预期行为，**必须将结果缓存到变量**后再判断：
  ```typescript
  // ✗ 错误
  if (obj.hasKey(s2t("red"))) { ... }
  else if (obj.hasKey(s2t("redFloat"))) { ... }
  // ✓ 正确
  var hasRed = obj.hasKey(s2t("red"));
  var hasRedFloat = obj.hasKey(s2t("redFloat"));
  if (hasRed && !hasRedFloat) { ... }
  else if (!hasRed && hasRedFloat) { ... }
  ```
- 兼容性敏感逻辑优先使用保守写法，加 `try/catch` 兜底

### ps-api 优先

需要 PS 操作时优先查阅 `src/jsx/ps-api/API.md` → 无则查 `psdoc/references/` → 都无才从零编写 ActionManager 代码。

## 面板通信约定 (关键)

所有 PS 通信必须经过 `PSBridge`，禁止直接在组件中调用 `CSInterface`。

`parseResult` 自动处理返回值：`__ERROR__:` → 错误、`__NO_DOCUMENT__` → 无文档、`__OK__` → 空成功、`__CANCEL__` → 取消、JSON/其他 → 数据。`evalScript` 有 10 秒超时保护。

## Vue 组件约定

- 使用 `<script setup lang="ts">` 组合式 API
- 共享类型从 `src/types/index.ts` 导入，不从 `.vue` 文件导出类型
- 组件样式使用 `<style scoped>`，全局基础样式在 `style.css`
- 通过 `provide/inject` 传递 Toast 方法
- 模板中避免使用反引号模板字符串（与 Vue 模板 `{{ }}` 冲突），用字符串拼接代替
- CSS 避免使用 `gap`（CEP Chromium 兼容性差），改用 `margin` + 兄弟选择器：`.parent > * + * { margin-left: Npx; }`

## 添加新功能步骤

1. 如需新的共享类型，添加到 `src/types/index.ts`
2. 在 `src/jsx/modules/` 对应模块文件中添加函数并 `export` 导出 (ES3 兼容)
3. 在 `src/jsx/hostscript.ts` 中导入并在 `$.HostScript` 注册
4. `src/bridge.ts` 暴露异步方法
5. `src/components/` 创建或修改 Vue 组件
6. `npm run build`

## 调试

- 面板: `http://localhost:8088` → Chrome DevTools → console.log
- 宿主: `$.writeln()` → PS 脚本日志
- 面板内: 可收起的调试面板（通信日志实时查看器，含耗时显示）

## 常见问题

| 问题 | 原因 |
|------|------|
| `CSInterface is not defined` | `dist/lib/CSInterface.js` 缺失 |
| `EvalScript error`（所有调用均失败） | ps-api 类从 `lib/` 子路径导入导致 webpack 模块冲突，须统一从 `ps-api/src/index.ts` 导入 |
| JSX 修改不生效 | PS 缓存旧脚本，需重启 PS |

## 更多信息

详细架构说明见 `CLAUDE.md`。