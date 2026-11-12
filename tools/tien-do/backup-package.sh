#!/usr/bin/env bash
# author Bùi Trọng Hiếu
# email kevinbui210191@gmail.com
# create date 15/10/2026
# modify date 08/11/2026
# desc Backup MỘT package đã xác thực + ghi sổ tiến độ (hash từng tệp).
#       Dùng: bash tools/tien-do/backup-package.sh <tầng>/<thư-mục> <chữ-ký>
set -uo pipefail
GOI=${1:?can ten goi dang <tang>/<thu-muc>}
KY=${2:?can chu ky}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SRC="$ROOT/packages/$GOI"
if [ ! -d "$SRC" ]; then echo "khong thay $SRC"; exit 2; fi
TEN=$(basename "$GOI")
TS=$(date +%Y%m%d-%H%M%S)
DICH=/tmp/gbh-pkg/"$TEN-$TS"
mkdir -p "$DICH"
rsync -a --exclude node_modules "$SRC/" "$DICH/"
cd "$DICH" || exit 2
find . -type f -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS
cd "$ROOT" || exit 2
SHA=$(shasum -a 256 "$DICH/SHA256SUMS" | cut -c1-16)
SO=$(find "$DICH" -type f | wc -l | tr -d ' ')
printf '| %s | %s | %s | %s | %s | %s |\n' "$GOI" "$KY" "$TS" "$SO" "$SHA" "$DICH" >> "$ROOT/docs/tien-do/SO-TIEN-DO.md"
echo "OK $GOI -> $DICH (tep=$SO sha=$SHA)"
