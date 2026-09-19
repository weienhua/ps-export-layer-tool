#!/bin/bash
# ============================================================
#  PS 图层导出工具 - macOS 自动卸载脚本
#  版本: __VERSION__
#  用法:
#    终端: bash 本文件  或  ./本文件
#    Finder: 双击 .command 副本（自动打开终端运行）
# ============================================================

set -u

EXTENSION_ID="com.ps.export.layer.tool"

# ---------- 输出辅助 ----------
info() { echo "[信息] $*"; }
ok()   { echo "[成功] $*"; }
warn() { echo "[警告] $*"; }
err()  { echo "[错误] $*" >&2; }

# ---------- 确定目标 ----------
if [ -z "${HOME:-}" ]; then
  err "无法确定 HOME 目录。"
  exit 1
fi
EXTENSIONS_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
TARGET_DIR="$EXTENSIONS_DIR/$EXTENSION_ID"

# ---------- 检查是否已安装 ----------
if [ ! -e "$TARGET_DIR" ] && [ ! -L "$TARGET_DIR" ]; then
  warn "未检测到已安装的 PS 图层导出工具插件"
  echo ""
  echo "按回车键退出..."
  if [ -t 0 ]; then
    read
  fi
  exit 0
fi

# ---------- 备份用户预设 ----------
# 布局与 Windows 卸载程序一致：${EXTENSION_ID}_user_files/presets/default.json
BACKUP_DIR="$EXTENSIONS_DIR/${EXTENSION_ID}_user_files"
if [ -d "$TARGET_DIR/dist/lib/presets" ]; then
  if mkdir -p "$BACKUP_DIR" && cp -R "$TARGET_DIR/dist/lib/presets" "$BACKUP_DIR/presets"; then
    ok "用户预设已备份到: $BACKUP_DIR"
  else
    err "备份用户预设失败，已中止卸载以保护数据。"
    exit 1
  fi
fi

# ---------- 删除插件 ----------
if [ -L "$TARGET_DIR" ]; then
  # 符号链接（开发安装）：只删除链接本身，不影响源目录
  if unlink "$TARGET_DIR"; then
    ok "目录链接已移除"
  else
    err "移除链接失败"
    exit 1
  fi
else
  if rm -rf "$TARGET_DIR"; then
    ok "插件文件已删除"
  else
    err "删除插件失败"
    exit 1
  fi
fi

# ---------- 完成 ----------
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║                卸载完成！                    ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  请重启 Photoshop 以使更改生效。             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "按回车键退出..."
if [ -t 0 ]; then
  read
fi
exit 0
