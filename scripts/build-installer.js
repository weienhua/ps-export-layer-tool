#!/usr/bin/env node

/**
 * 打包脚本
 * 1. 构建项目（npm run build）
 * 2. 生成 zip 安装包到 installer/
 * 3. 生成独立安装程序到 installer/
 *    - Windows: pkg 打包的可执行文件（.exe）
 *    - macOS: 自解压 shell 脚本（.sh / .command，Finder 可双击）
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INSTALLER_DIR = path.join(ROOT, 'installer');
const EXTENSION_ID = 'com.ps.export.layer.tool';
const VERSION = (process.env.VERSION || require(path.join(ROOT, 'package.json')).version).replace(/^v/, '');

function log(msg) {
  console.log(`[打包] ${msg}`);
}

/**
 * 递归复制目录
 */
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 生成 zip 安装包
 */
function buildZip() {
  const zipName = `com.ps.export.layer.tool-v${VERSION}.zip`;
  const zipPath = path.join(INSTALLER_DIR, zipName);

  log(`生成 zip 安装包: ${zipName}`);

  // 创建临时目录结构
  const tempDir = path.join(ROOT, '.zip-temp');
  const pluginDir = path.join(tempDir, 'com.ps.export.layer.tool');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(pluginDir, { recursive: true });

  // 复制 CSXS、dist、doc 到临时目录
  copyDirSync(path.join(ROOT, 'CSXS'), path.join(pluginDir, 'CSXS'));
  copyDirSync(path.join(ROOT, 'dist'), path.join(pluginDir, 'dist'));
  copyDirSync(path.join(ROOT, 'doc'), path.join(pluginDir, 'doc'));

  // 根据平台选择压缩方式
  try {
    if (process.platform === 'win32') {
      // Windows: 使用 PowerShell
      execSync(
        `powershell -Command "Compress-Archive -Path '${pluginDir}' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
      );
    } else {
      // macOS/Linux: 使用 zip 命令
      execSync(
        `cd '${tempDir}' && zip -r '${zipPath}' 'com.ps.export.layer.tool'`,
        { stdio: 'inherit' }
      );
    }
    log(`zip 安装包已生成: ${zipPath}`);
  } catch (e) {
    console.error('[错误] zip 打包失败:', e.message);
  }

  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true, force: true });
}

/**
 * 生成 Windows 独立安装程序（pkg 打包，支持交叉编译）
 */
function buildInstaller() {
  log('正在打包 Windows 安装程序...');

  // 创建临时打包目录
  const tempDir = path.join(ROOT, '.installer-temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // 复制脚本到临时目录
  fs.copyFileSync(path.join(__dirname, 'install.js'), path.join(tempDir, 'install.js'));
  fs.copyFileSync(path.join(__dirname, 'uninstall.js'), path.join(tempDir, 'uninstall.js'));

  // 复制 CSXS、dist、doc 到临时目录（打包进可执行文件）
  copyDirSync(path.join(ROOT, 'CSXS'), path.join(tempDir, 'CSXS'));
  copyDirSync(path.join(ROOT, 'dist'), path.join(tempDir, 'dist'));
  copyDirSync(path.join(ROOT, 'doc'), path.join(tempDir, 'doc'));

  // 创建 package.json 给 pkg 用（安装程序）
  const pkgJsonInstaller = {
    name: 'layer-tool-installer',
    version: VERSION,
    bin: 'install.js',
    pkg: {
      assets: ['CSXS/**/*', 'dist/**/*', 'doc/**/*'],
    },
  };
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkgJsonInstaller, null, 2));

  // 打包 Windows 安装程序
  log('正在打包 Windows 安装程序...');
  try {
    execSync(
      `npx pkg . --targets node18-win-x64 --output ../installer/com.ps.export.layer.tool-installer.exe`,
      { cwd: tempDir, stdio: 'inherit' }
    );
    log('Windows 安装程序打包完成');
  } catch (e) {
    console.error('[错误] Windows 打包失败:', e.message);
  }

  // 创建 package.json 给 pkg 用（卸载程序）
  const pkgJsonUninstaller = {
    name: 'layer-tool-uninstaller',
    version: VERSION,
    bin: 'uninstall.js',
    pkg: {
      assets: ['CSXS/**/*', 'dist/**/*', 'doc/**/*'],
    },
  };
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkgJsonUninstaller, null, 2));

  // 打包 Windows 卸载程序
  log('正在打包 Windows 卸载程序...');
  try {
    execSync(
      `npx pkg . --targets node18-win-x64 --output ../installer/com.ps.export.layer.tool-uninstaller.exe`,
      { cwd: tempDir, stdio: 'inherit' }
    );
    log('Windows 卸载程序打包完成');
  } catch (e) {
    console.error('[错误] Windows 卸载打包失败:', e.message);
  }

  // macOS 安装/卸载不再使用 pkg 二进制（pkg 已停止维护、无 arm64 目标、
  // 未签名产物会被 Gatekeeper 拦截），改为自解压 shell 脚本，
  // 由 buildMacShellInstaller() 单独生成。

  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true, force: true });
}

/**
 * 生成 macOS 自解压 shell 安装/卸载脚本
 * - installer.sh / installer.command：bash 头部 + __PAYLOAD_BELOW__ 标记行 + base64(tar.gz) 载荷
 * - uninstaller.sh / uninstaller.command：纯脚本，无载荷
 * 仅在 macOS 上执行（依赖 tar / base64 / awk 命令）
 */
function buildMacShellInstaller() {
  log('正在打包 macOS shell 安装/卸载脚本...');

  const tempDir = path.join(ROOT, '.installer-temp');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // 组装与 zip 相同的目录结构：com.ps.export.layer.tool/{CSXS,dist,doc}
  const pluginDir = path.join(tempDir, EXTENSION_ID);
  fs.mkdirSync(pluginDir, { recursive: true });
  copyDirSync(path.join(ROOT, 'CSXS'), path.join(pluginDir, 'CSXS'));
  copyDirSync(path.join(ROOT, 'dist'), path.join(pluginDir, 'dist'));
  copyDirSync(path.join(ROOT, 'doc'), path.join(pluginDir, 'doc'));

  // tar.gz 载荷
  const payloadPath = path.join(tempDir, 'payload.tgz');
  execSync(`cd '${tempDir}' && tar czf payload.tgz '${EXTENSION_ID}'`, { stdio: 'inherit' });

  // base64 编码，每行 76 字符（与 awk/tail 自解压逻辑兼容）
  const b64 = fs.readFileSync(payloadPath).toString('base64');
  const lines = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  const payloadText = lines.join('\n') + '\n';

  const writeExecutable = (fileName, content) => {
    const filePath = path.join(INSTALLER_DIR, fileName);
    fs.writeFileSync(filePath, content);
    fs.chmodSync(filePath, 0o755);
    log(`已生成: ${fileName}`);
  };

  // 安装脚本 = 模板头部（含 __PAYLOAD_BELOW__ 标记）+ base64 载荷
  const installTemplate = fs.readFileSync(path.join(__dirname, 'templates', 'install.sh.template'), 'utf8');
  const installScript = installTemplate.replace(/__VERSION__/g, VERSION) + payloadText;
  writeExecutable(`${EXTENSION_ID}-installer.sh`, installScript);
  writeExecutable(`${EXTENSION_ID}-installer.command`, installScript);

  // 卸载脚本（无载荷）
  const uninstallTemplate = fs.readFileSync(path.join(__dirname, 'templates', 'uninstall.sh'), 'utf8');
  const uninstallScript = uninstallTemplate.replace(/__VERSION__/g, VERSION);
  writeExecutable(`${EXTENSION_ID}-uninstaller.sh`, uninstallScript);
  writeExecutable(`${EXTENSION_ID}-uninstaller.command`, uninstallScript);

  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║             打包发布文件                     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // 1. 检查 dist 目录（npm run build 已在 package.json 中先执行）
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('[错误] dist/ 目录不存在，请先运行 npm run build');
    process.exit(1);
  }

  // 2. 创建 installer 输出目录
  if (!fs.existsSync(INSTALLER_DIR)) {
    fs.mkdirSync(INSTALLER_DIR, { recursive: true });
  }

  // 2.1 清理历史 pkg 版 macOS 产物（已由自解压 shell 脚本替代）
  [ `${EXTENSION_ID}-installer-macos`, `${EXTENSION_ID}-uninstaller-macos` ].forEach((legacyName) => {
    const legacyPath = path.join(INSTALLER_DIR, legacyName);
    if (fs.existsSync(legacyPath)) {
      fs.rmSync(legacyPath, { force: true });
      log(`已移除历史产物: ${legacyName}`);
    }
  });

  // 3. 生成 zip 安装包
  buildZip();

  // 4. 生成 Windows 独立安装程序（pkg 交叉编译）
  buildInstaller();

  // 5. 生成 macOS 自解压 shell 安装/卸载脚本（需在 macOS 上执行）
  if (process.platform === 'darwin') {
    buildMacShellInstaller();
  } else {
    log(`当前为 ${process.platform} 系统，macOS shell 脚本需在 macOS 上打包`);
  }

  // 6. 输出结果
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║             打包完成！                       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  输出目录: installer/                        ║');
  console.log('║                                              ║');
  console.log('║  文件列表:                                   ║');

  if (fs.existsSync(INSTALLER_DIR)) {
    const files = fs.readdirSync(INSTALLER_DIR);
    files.forEach(f => {
      const stats = fs.statSync(path.join(INSTALLER_DIR, f));
      const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
      console.log(`║    ${f} (${sizeMB} MB)`);
    });
  }

  console.log('║                                              ║');
  console.log('║  使用说明:                                   ║');
  console.log('║    .zip - 手动解压到 CEP 扩展目录            ║');
  console.log('║    .exe - Windows 双击运行自动安装/卸载      ║');
  console.log('║    .command - macOS 双击运行自动安装/卸载    ║');
  console.log('║    .sh - macOS 终端运行 (bash 文件名)        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
}

main();
