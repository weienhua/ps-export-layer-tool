# 2026-09-19 — macOS 安装包改为自解压 shell 脚本（.sh / .command）

> 本 session 在 macOS（Darwin arm64 / Node v22.23.2）上完成；改动**尚未提交**，工作区仍是脏的。

## 完成的工作

- [x] **现状分析 + 方案确定**：确认 `npm run package` 过去用 `pkg` 产出 macOS 裸 Mach-O 二进制（x86_64、ad-hoc 签名、未公证），在 Apple Silicon 需 Rosetta、下载后被 Gatekeeper 拦截、双击体验差
- [x] **参照 `ps-layer-tool` 改用自解压 shell**：新增 `scripts/templates/install.sh.template`（bash 头部 + `__PAYLOAD_BELOW__` 标记行 + base64(tar.gz) 载荷，`awk` 定位标记 → `tail | base64 -d | tar xzf` 解到临时目录）与 `scripts/templates/uninstall.sh`（纯脚本，无载荷）
- [x] **`scripts/build-installer.js` 改造**：删除 `buildInstaller()` 里的 macOS pkg 分支（仅保留 Windows `.exe` 交叉编译）；新增 `buildMacShellInstaller()`（组装 `{CSXS,dist,doc}` → `tar czf` → base64 每行 76 字符 → 拼模板 → 写 `.sh`/`.command` 并 `chmod 0755`）；`main()` 增加历史产物清理（`*-installer-macos` / `*-uninstaller-macos`）
- [x] **CI 同步**：`.github/workflows/release.yml` macOS 上传清单换成 4 个脚本；两个 job 都注入 `VERSION: ${{ github.ref_name }}`（避免两平台 zip 文件名不一致 → 两个 release 资产）
- [x] **文档同步**：`README.md`、`doc/使用文档.md`（安装/卸载/Gatekeeper 提示/自动安装行为清单）、`CLAUDE.md`（打包产物、macOS 自解压机制、安装逻辑等价性说明、scripts 目录树）
- [x] **产物自检**：`file` 确认是 `Bourne-Again shell script text executable`（非 Mach-O）、`bash -n` 通过、marker 定位正确、载荷解出 `com.ps.export.layer.tool/{CSXS,dist,doc}` 共 24 条目、内置预设 22 个、`.sh` 与 `.command` 内容一致（`cmp`）
- [x] **隔离演练 15/15 通过**（假 `HOME` + PATH 垫片 `defaults`，不触碰真实系统）：全新安装 / 覆盖安装保留用户预设 / 符号链接安装（只删链接、源目录未受损、预设透链恢复）/ 卸载写备份 / 重装从 `_user_files` 恢复并清理备份 / 删 `presets/` 后内置预设回归 22 个 / 未安装时卸载幂等
- [x] **与 Node 脚本交叉验证 6/6 通过**：shell 卸载器写备份 → `node scripts/install.js` 恢复；`node scripts/uninstall.js` 写备份 → shell 安装器恢复（证明 `${EXTENSION_ID}_user_files/presets/` 布局双向互通）
- [x] **`npm run package` 全绿**：Windows `.exe` 重建成功 + 4 个 mac 脚本 + zip；旧 `-macos` 产物已被脚本自动清除

## 进行中的工作

- [ ] **未提交**：5 个修改文件 + 1 个未跟踪目录（`scripts/templates/`）仍在工作区，见「相关产物」
- [ ] **（未做）真实 Finder 双击验证**：我的演练是以 `bash xxx.sh` 方式跑脚本；`.command` 在 Finder 里的双击行为、Gatekeeper 首次拦截弹窗、下载后执行位丢失情况，需要在真实环境由你确认
- [ ] **（未做）CI 实跑**：workflow 改动未推送、未触发，`gh release upload` 的 4 个新文件名未在真实 release 中验证
- [ ] **（未做）签名 / 公证**：需 Apple Developer 账号，本轮明确不做，仅用文档写清右键打开 / `xattr -d com.apple.quarantine` 兜底

## 下一步计划

1. 先 `code-review` 过一遍本轮改动（规范化 + 规格两个维度），再提交推送（`main` 与 `origin/main` 当前一致，HEAD=`9da4b8c`）
2. 在真实 macOS 上双击 `installer/com.ps.export.layer.tool-installer.command`，确认：终端自动打开 → 流程跑完 →「按回车键退出」→ 重启 PS 后面板可见；若被 Gatekeeper 拦截，验证右键「打开」与 `xattr -d com.apple.quarantine` 两条路都可用
3. 验证卸载：双击 `-uninstaller.command`，确认 `~/Library/Application Support/Adobe/CEP/extensions/com.ps.export.layer.tool_user_files/presets/` 生成，再安装确认恢复
4. 若要发布：打 tag 触发 workflow，确认 4 个 mac 脚本正确挂到 release（注意 release 资产下载后不保留执行位 → 文档已给 `bash` 兜底）
5. 可选后续：评估把 Windows 侧也移出已停更的 `pkg`（Node 22 SEA 或 `bun build --compile`），本轮未动 Windows

## 关键决策

- **macOS 弃用 pkg、改自解压 shell**：
  - 原因：pkg（vercel/pkg）2024-01 已归档停更、只到 node18 target、无 arm64；产物是 x86_64 裸 CLI（Apple Silicon 需 Rosetta）、ad-hoc 签名未公证 → 下载即被 Gatekeeper 拦、无法双击
  - 影响：`--targets node18-macos-x64` 两处调用被删除；mac 产物变成纯文本脚本（可读可审、不挑架构）；**仅在 macOS 上生成**（依赖 `tar`/`base64`/`awk`）
- **内置预设必须随包安装，不照抄参考项目的删除逻辑**（最重要的一条）：
  - 参考项目 `ps-layer-tool` 的模板里有 `HAD_PRESETS`：用户原先无 presets 就删掉安装包自带的默认 presets。本项目**不能**这么做 —— 面板 `src/composables/useExportPreset.ts` 的 `load()` 顺序是「文件 → localStorage → 空」，全新用户没有任何持久化数据，只能靠 `dist/lib/presets/default.json`（22 个内置预设）种子
  - 现有 `scripts/install.js` 里 `hadPresetsDir` 是**死变量**（只赋值不使用），本身就没有删除行为，shell 版保持一致
- **卸载器只备份整个 `presets/` 目录**：现有 `uninstall.js` 同时写 `_user_files/presets/default.json`（文件）与 `_user_files/presets/**`（目录），两者冗余；shell 版只写目录即可覆盖，布局与 `install.js` 的两条恢复路径都兼容（已用交叉测试证明）
- **`.sh` 与 `.command` 内容完全相同**：扩展名决定 Finder 能否双击；`.sh` 用于 `bash xxx.sh`（下载后丢失执行位时的兜底），与参考项目一致
- **脚本头部末尾必须有 `exit 0`**：否则 bash 会继续把 base64 载荷当命令执行（原型阶段已实测报警 `command not found`）
- **CI 两个 job 都设 `VERSION`**：只给 mac job 设会让 Windows 用 package.json 版本、mac 用 tag 版本，产生两个不同名的 zip 同时进 release；两个都设则一致
- **不做签名/公证**：需 Apple Developer 账号，超出本轮范围；用 `.command`（双击可跑）+ 文档写清 Gatekeeper 绕过

## 已知问题 / 注意事项

- **沙箱里 `npm run package` 会在 Windows pkg 步骤报 EPERM**：`pkg` 会 `remove()` 并重建 `~/.pkg-cache/v3.4/fetched-v18.5.0-macos-x64-signed`（bytecode 分支的 ad-hoc 签名副本），该路径在工作区外 → 沙箱拒绝写入。**不是代码问题**，正常终端无此限制。沙箱内的绕过方式（本次用过，验证后已删除）：
  ```bash
  mkdir -p .pkg-cache/v3.4
  ln -sf ~/.pkg-cache/v3.4/fetched-v18.5.0-win-x64 .pkg-cache/v3.4/
  ln -sf ~/.pkg-cache/v3.4/fetched-v18.5.0-macos-x64 .pkg-cache/v3.4/
  ln -sf ~/.pkg-cache/v3.4/fetched-v18.5.0-macos-x64-signed .pkg-cache/v3.4/
  PKG_CACHE_PATH="$PWD/.pkg-cache" npm run package
  ```
  （`PKG_CACHE_PATH` 命中后 pkg 会在工作区内生成约 49MB 的文件，记得 `rm -rf .pkg-cache`）
- **`defaults write` 不受假 HOME 影响**：演练时必须在 `PATH` 前置一个 `#!/bin/bash\nexit 0` 的 `defaults` 垫片，否则会真去写用户域
- **`installer/com.ps.export.layer.tool-v1.0.0.zip` 是历史遗留**（8月2日），构建脚本只增不清 zip；要干净产物用 `npm run clean`（会连 `dist/` 一起删）
- **`file` 检查很值得保留**：`-macos` 二进制与 shell 脚本的差别用 `file` 一眼可见（`Mach-O 64-bit executable x86_64` vs `Bourne-Again shell script text executable`），回归时优先用这条
- **演练断言里最容易退化的三项**：① 覆盖安装后用户预设仍在；② 符号链接安装后**源目录未被删**；③ 从 `_user_files` 恢复后备份目录被删除。改模板后务必重跑这三项
- **`.command` 下载后可能丢执行位**：GitHub release 走 HTTP 下载，权限位不保证；文档已给 `bash xxx.sh` 兜底，这条别在文档里删掉
- 提交前记得 `git status` 里 `?? scripts/templates/` 要一并 `git add`（模板文件不进版本库会让其他人构建直接失败）

## 建议技能

- [ ] `code-review` — 本轮改动跨构建脚本 / CI / 文档，提交前值得按标准 + 规格两维度过一遍（仓库内 `.agents/skills/code-review`）
- [ ] `/sync-docs` — 本轮文档是手工同步的；若后续再改 `build-installer.js` 或产物清单，用它重跑一次
- [ ] 无特定技能用于真实双击验证，属于人工确认步骤

## 相关产物

- 改动文件（未提交）：
  - 新增 `scripts/templates/install.sh.template`、`scripts/templates/uninstall.sh`
  - 修改 `scripts/build-installer.js`（+84/−51）、`.github/workflows/release.yml`、`README.md`、`doc/使用文档.md`、`CLAUDE.md`
- 构建产物：`installer/com.ps.export.layer.tool-installer.sh` / `.command`（≈973KB）、`-uninstaller.sh` / `.command`（≈2.6KB）、两个 `.exe`、`com.ps.export.layer.tool-v1.1.0.zip`
- 参考实现（同一台机器上的兄弟项目）：`/Users/lxy/Desktop/project/ps-layer-tool/scripts/build-installer.js` + `scripts/templates/install.sh.template`、`scripts/templates/uninstall.sh`
- 关键对照代码：`scripts/install.js`（第 16-22 行保留清单、第 408-511 行备份/恢复与注释）、`scripts/uninstall.js`（第 216-231 行写备份）、`src/composables/useExportPreset.ts`（第 13-14 行路径常量、第 80-126 行 `load()` 优先级）
- 上一份交接：`handoffs/2026-09-17-003分轴统一裁剪与空白图修复.md`（注意：其中「PowerShell / git 推送环境」等条目来自 Windows 机器，与本轮 macOS 环境无关）
- Git：分支 `main`，HEAD `9da4b8c`（handoff），与 `origin/main` 一致；本轮改动**尚未 commit**
