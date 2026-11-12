#!/usr/bin/env bash
# author Bùi Trọng Hiếu
# email kevinbui210191@gmail.com
# create date 15/10/2026
# modify date 19/10/2026
# desc Đồng bộ dist VỎ SPA CỦA TA (đã brand-rename) vào profile để host phục vụ nó thay cho dist stock.
#      Gói host-frontend-static là THƯ VIỆN (không mount) nên không nằm trong profiles/node_modules.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_DIR="${GBH_HOME:-$HOME/.galaxy/blackhole}"
SRC="$REPO/packages/host/host-frontend-static/dist"
DST="$HOME_DIR/profiles/blackhole/dist"
if [ ! -f "$SRC/index.html" ]; then
  echo "[dist] KHONG thay dist cua ta ($SRC) — bo qua, host se dung dist stock"
  exit 0
fi
mkdir -p "$DST"
rm -rf "$DST"
cp -R "$SRC" "$DST"
echo "[dist] da dong bo dist cua ta -> $DST"
