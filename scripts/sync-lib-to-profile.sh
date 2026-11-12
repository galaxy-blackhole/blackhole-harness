#!/usr/bin/env bash
# author Bùi Trọng Hiếu
# email kevinbui210191@gmail.com
# create date 15/10/2026
# modify date 01/11/2026
# desc Dong bo phan CHAY DUOC cua goi trong repo vao ban copy trong profile, theo TEN GOI THAT
#      trong package.json (khong suy tu ten thu muc: vd thu muc "locale" co ten goi "gbh-client-locale").
#      Gom: lib/ + assets/ + locale/ + presets/ + types/ + MOI *.patch.yml o goc goi (bundle patch).
#      Vi sao (01/11/2026): chi copy lib/ lam goi co asset chet luc mount
#      ("ENOENT ... assets/office/SKILL.md"); goi trong profile la symlink thi bo qua; tep chi-doc
#      (mode r-------- nhu zalo.jpg) duoc chmod u+w truoc khi ghi. Cuoi luot co phep doi chieu + bao loi.
#      Profile KHONG phai symlink nen rebuild trong repo KHONG tu toi app.
# 06/11/2026 (P1b): DỔI ID STOCK → ID GBH ngay trong bản cài (profile).
# Vì sao ở đây: 212/215 gói dựng artefact bằng Bun.build từ src nên sửa src sẽ vỡ typecheck; đổi ở bản CÀI
# cho ta repo giữ artefact nguyên văn stock (mọi cổng parity xanh) mà bản CHẠY không còn id stock.
# Đo được: profile 2 717 → 34 lượt id stock (ngoài 3 id kernel); check:app 11/11 ĐẠT.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="$HOME/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole"
DIRS=(lib assets locale presets types)
errors=0
n=0; skip=0; extra=0; linked=0

# Chep NOI DUNG mot thu muc, go co chi-doc truoc khi ghi.
# Nhan: src — thu muc nguon; dst — thu muc dich. Tra: khong; loi cp duoc dem vao errors.
sync_dir() {
  local src="$1" dst="$2"
  mkdir -p "$dst" || { errors=$((errors + 1)); return; }
  chmod -R u+w "$dst" 2>/dev/null || true
  if ! cp -Rf "$src/." "$dst/" 2>/dev/null; then
    echo "[sync-lib] LOI khi chep $dst"
    errors=$((errors + 1))
  fi
}

for tier in host client tools; do
  [ -d "$REPO/packages/$tier" ] || continue
  for d in "$REPO/packages/$tier"/*/; do
    pkg="$d/package.json"
    [ -f "$pkg" ] || continue
    [ -d "$d/lib" ] || continue
    name="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$pkg" | head -1)"
    [ -n "$name" ] || { skip=$((skip + 1)); continue; }
    dstRoot="$PROFILE/${name##*/}"
    [ -d "$dstRoot" ] || { skip=$((skip + 1)); continue; }
    # Goi trong profile la SYMLINK ve repo thi da tu dong dung, chep se loi "same file".
    [ -L "$dstRoot" ] && { linked=$((linked + 1)); continue; }
    for sub in "${DIRS[@]}"; do
      [ -d "$d/$sub" ] || continue
      sync_dir "$d/$sub" "$dstRoot/$sub"
      [ "$sub" != "lib" ] && extra=$((extra + 1))
    done
    for patch in "$d"/*.patch.yml; do
      [ -f "$patch" ] || continue
      chmod u+w "$dstRoot/${patch##*/}" 2>/dev/null || true
      if cp -f "$patch" "$dstRoot/"; then extra=$((extra + 1)); else
        echo "[sync-lib] LOI khi chep $dstRoot/${patch##*/}"; errors=$((errors + 1))
      fi
    done
    n=$((n + 1))
  done
done
echo "[sync-lib] dong bo $n goi ($extra muc asset/patch) · symlink $linked · bo qua $skip · loi $errors"
# ADR-0029: bo "vi" trung o artefact cua 3 goi co namespace do goi locale trung tam dang ky,
# neu khong app se trang UI (locale.register nem "namespace ... already has locale vi").
if command -v bun >/dev/null 2>&1; then
  (cd "$REPO" && bun run scripts/fix-duplicate-vi.mjs) || true
fi


# --- Doi chieu: bao goi con THIEU thu muc so voi repo -------------------------------
missing=0
for tier in host client tools; do
  [ -d "$REPO/packages/$tier" ] || continue
  for d in "$REPO/packages/$tier"/*/; do
    pkg="$d/package.json"
    [ -f "$pkg" ] || continue
    name="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$pkg" | head -1)"
    [ -n "$name" ] || continue
    dstRoot="$PROFILE/${name##*/}"
    [ -d "$dstRoot" ] || continue
    [ -L "$dstRoot" ] && continue
    for sub in "${DIRS[@]}"; do
      [ -d "$d/$sub" ] || continue
      if [ ! -d "$dstRoot/$sub" ]; then
        echo "[sync-lib] THIEU: ${name##*/}/$sub"
        missing=$((missing + 1))
      fi
    done
  done
done
[ "$missing" -eq 0 ] && echo "[sync-lib] doi chieu: khong goi nao thieu thu muc" || echo "[sync-lib] doi chieu: $missing muc con thieu"

# Doi id stock -> id GBH trong ban cai (bo qua 3 id kernel va id khong co goi tuong ung).
# 06/11/2026 (P1b): LAP toi khi hoi tu (toi da 3 luot) — luot dau co the chay truoc khi dot chep cuoi cung
# xong, nen mot luot la KHONG du (do duoc: luot 1 doi 119 tep, luot 2 doi 0).
for _lan in 1 2 3; do
  ket="$(GBH_REPO="$REPO" "$(command -v bun || echo bun)" "$REPO/tools/p1b/denta-profile.ts" "$PROFILE" 2>/dev/null)" || { echo "[sync-lib] CANH BAO: denta-profile loi"; break; }
  echo "$ket"
  case "$ket" in *"doi 0 tep"*) break ;; esac
done

exit 0
