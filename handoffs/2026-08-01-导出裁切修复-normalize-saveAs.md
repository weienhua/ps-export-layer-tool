# 2026-08-01 — 导出裁切修复：normalize + top-left resize + saveAs

## 完成的工作

- [x] **根因定位**：多图层/批量导出裁切有两个根因：
  1. `resizeCanvasWithAnchor` 使用 center 锚点缩小画布后，原点从 (0,0) 偏移到 `((workDocSize-finalW)/2, (workDocSize-finalH)/2)`，但 `calcAnchorOffsetX/Y` 和边界裁剪均假设原点在 (0,0)——坐标系偏移导致图层被移出可见区域
  2. `exportToWeb`（Save for Web 引擎）存在 PS 文本渲染 bug——文本抗锯齿像素超出 `bounds()` 报告范围，即使有 50px 边距也会裁切。栅格化后依然发生，说明是 Save for Web 引擎自身问题，非文本图层特有问题
- [x] **修复 layersExport.ts**：duplicate 后 normalize 图层到 (0,0) + resize 锚点从 `Cntr`→`Left`/`Top ` + `startIndex \|\| 1`→`!= null ? ... : 0`
- [x] **修复 batchExport.ts**：template duplicate 后 normalize 到 (0,0) + resize 锚点 `Cntr`→`Left`/`Top `
- [x] **exportToWeb → saveAs**：两个模块中全部替换为 `workDoc.saveAs(filePath, "PNGFormat"/"JPEG", true)`，使用 PS 主渲染引擎，绕过 Save for Web bug。使用字符串字面量而非 `DocumentFormat` 枚举（避免修改 ps-api）
- [x] **ps-api 未修改**：用户明确要求不修改 ps-api，已还原 `index.ts`
- [x] **CLAUDE.md 代码规范**：宿主脚本约定新增「导出禁止使用 exportToWeb」规范
- [x] **文档同步**：CLAUDE.md、AGENTS.md、doc/使用文档.md 均已更新模块列表、函数表、FAQ
- [x] **git push**：commit `6b2e11c`（多图层导出功能）+ 本 session 的修复待提交

## 进行中的工作

- 无

## 下一步计划

1. **在 PS 中验证修复**：测试多图层导出和批量导出，确认裁切问题已解决
2. **提交本 session 的修复**：`/git-push` 推送 normalize + saveAs 修复
3. 验证后如有残余问题，检查 `saveAs` PNG/JPG 参数是否符合预期（当前 ps-api 默认：PNG compression=6, method=quick；JPG extendedQuality=12）
4. `BatchExportConfig` 中 font 相关死字段仍可清理（fontName/colorHex 等导出时已不使用）

## 关键决策

- **决策**：duplicate 后 normalize 图层到 (0,0) + resize 改用 top-left 锚点
  - 原因：消除源文档绝对坐标影响 + 保证画布原点始终为 (0,0)，锚点数学无需修改
  - 影响：batchExport.ts 和 layersExport.ts 两处修改，`resizeCanvasWithAnchor` 的 `Left`/`Top ` charID 已通过 `toDescriptor.jsx` 和 ps-scripts.com 论坛验证正确

- **决策**：exportToWeb → saveAs（PS 主渲染引擎）
  - 原因：Save for Web 引擎（`exportDocument` + `ExportType.SAVEFORWEB`）有文本渲染 bug，栅格化后依然存在
  - 影响：`saveAs` 参数使用字符串字面量（`"PNGFormat"`/`"JPEG"`）+ `@ts-ignore`，不修改 ps-api

- **决策**：不修改 ps-api vendor 代码
  - 原因：用户明确要求
  - 影响：`DocumentFormat` 枚举不能从 index.ts 导入，改用字符串字面量

## 已知问题 / 注意事项

- `saveAs` 的 PNG/JPG 参数使用 ps-api 默认值，未暴露压缩率等配置
- `Left`/`Top ` 是 CnvS 的正确 charID（已验证），不要替换为 `AlLf`/`AlTp`（那是 Align action 的枚举值）
- `startIndex` 默认值改为 0（之前 `|| 1` 的 bug 已修复）
- 导出文件名路径拼接使用 `/`，PS ExtendScript 在 macOS 和 Windows 均支持

## 建议技能

- [ ] `/git-push` — 提交本 session 的 normalize + saveAs 修复
- [ ] `/code-review` — 新增代码 review
