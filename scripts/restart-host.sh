#!/usr/bin/env bash
# author Bùi Trọng Hiếu
# email kevinbui210191@gmail.com
# create date 15/10/2026
# modify date 17/10/2026
# desc Khoi dong lai host 5439 DUNG CACH — mot lenh duy nhat, khong the sai
#
# Vi sao can script nay thay vi mot dong trong tai lieu:
#   Ba su co lien tiep ngay 17/10/2026 deu do CHEP TAY lenh khoi dong tu tri nho:
#     (1) `bun` khong co trong PATH cua shell agent  => nohup: bun: No such file or directory
#     (2) `DSH_HOME=~/.galaxy/gbh` co san trong phien agent ro vao => host tim profile trong home CHI-DOC
#     (3) cong 5439 con bi tien trinh cu giu => exit code 3, app khong khoi dong
#   Moi lan app chet 6-10 phut va nguoi dung dang mo app. Mot script lam dung ca ba thi khong con cho de sai.
#
# Dung: scripts/restart-host.sh        (tu do bun, tu cho cong, tu xac minh)
set -u
cd "$(dirname "$0")/.."

BUN="${BUN:-$HOME/.bun/bin/bun}"
[ -x "$BUN" ] || { echo "khong thay bun tai $BUN — dat BUN=/duong/dan/bun"; exit 1; }

# ⚠️ 18/10/2026 — CHI lay tien trinh DANG LISTEN. Ban cu dung 'lsof -ti tcp:5439 | head -1' nen khi
#   có Chrome/check:app đang mở kết nối tới cổng, PID ĐẦU TIÊN là một KẾT NỐI chứ không phải host ⇒
#   script kill nhầm kết nối, còn host cũ vẫn giữ cổng ⇒ 'cong 5439 van bi chiem' ⇒ exit 3 (đo được
#   đúng lúc 18:31: lsof -ti trả '26967 30163 31303', listener là 30163).
P=$(lsof -ti tcp:5439 -sTCP:LISTEN 2>/dev/null | head -1 || true)
if [ -n "${P:-}" ]; then echo "[restart] tat tien trinh cu pid=$P"; kill "$P" 2>/dev/null || true; fi
for _ in $(seq 1 20); do lsof -ti tcp:5439 -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 1; done
lsof -ti tcp:5439 -sTCP:LISTEN >/dev/null 2>&1 && { echo "[restart] cong 5439 van bi chiem — dung lai, khong bam lieu"; exit 3; }

# XOA PROFILE COPY CU CUA NHUNG GOI VUA BUILD LAI.
# LY DO (do duoc 2 lan trong ngay 17/10/2026): profile la CACHE MOUNT — boot chi copy tu
# packages/<tier>/<pkg>/lib/ khi trong profile CHUA co. Neu profile con ban cu thi app phuc vu
# CODE CU ma khong ai biet:
#   - 19:13 goi file-upload: profile con ban scaffold => 'client bundle not found' => app trang.
#   - 21:4x goi client-modules: profile index.js 21:29 trong khi repo 21:36 => tran batch KHONG
#     chay => combo 55 bundle / 9,68 MB => response bi cat => 14-19 entry ket 'loading'.
# Phep kiem nay KHONG dung grep ten ham (bai hoc: 'logApply' grep ra 0 vi minify doi ten) — no so
# MOC THOI GIAN cua file moi nhat trong lib/ (repo) voi file moi nhat trong profile copy.
mtime_moi_nhat() { find "$1" -type f -exec stat -f '%m' {} + 2>/dev/null | sort -rn | head -1; }
PROFILE_ROOT="$HOME/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole"
if [ -d "$PROFILE_ROOT" ]; then
  da_xoa=0
  for pkgdir in packages/*/*; do
    lib="$pkgdir/lib"
    [ -d "$lib" ] || continue
    name=$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$pkgdir/package.json" 2>/dev/null | head -1)
    case "$name" in @galaxy-blackhole/*) ;; *) continue ;; esac
    copy="$PROFILE_ROOT/${name#@galaxy-blackhole/}"
    [ -d "$copy" ] || continue
    # ⚠️ 18/10/2026: ban copy THIEU artifact thi KHONG BAO GIO phuc vu duoc, du mtime noi gi.
    #   Ca that (ui-brand-official): profile copy chi co package.json (ghi luc staging, MOI HON ban
    #   build trong repo) con lib/ thi khong co ⇒ phep so mtime ket luan "con tuoi" ⇒ KHONG BAO GIO
    #   copy lib/ ⇒ goi ket vinh vien o trang thai khong co artifact ⇒ tang nap khong sinh entry,
    #   ma moi phep kiem khac deu xanh (patch ✓ profile co thu muc ✓ check:rows 0 chan).
    #   ⇒ Thieu lib/ thi XOA BAT KE mtime.
    if [ ! -d "$copy/lib" ]; then
      echo "[restart] profile copy THIEU lib/: $name — xoa de boot mount lai"
      rm -rf "$copy"
      da_xoa=$((da_xoa + 1))
      continue
    fi
    t_repo=$(mtime_moi_nhat "$lib")
    t_copy=$(mtime_moi_nhat "$copy")
    if [ -n "$t_repo" ] && [ -n "$t_copy" ] && [ "$t_repo" -gt "$t_copy" ]; then
      echo "[restart] profile copy CU hon ban build: $name — xoa de boot mount lai"
      rm -rf "$copy"
      da_xoa=$((da_xoa + 1))
    fi
  done
  [ "$da_xoa" -gt 0 ] && echo "[restart] da xoa $da_xoa profile copy cu (app se mount ban moi)"
fi

# BUILD LAI NHUNG GOI CO src/ MOI HON lib/ — mot khoang trong KHAC cua cung lop loi 'cache'.
# LY DO (do 17/10/2026): `check:rows` canh bao 'ban mount CU hon ma nguon' cho 6 goi, trong khi
# `check:app` (10) bao '54 file khop repo' — HAI CONG CU NOI NGUOC NHAU. Doc ky thi khong mau thuan:
#   - `check:app` hoi  'artifact da build co duoc mount khong?'   => CO (dung)
#   - `check:rows` hoi 'mount co moi hon MA NGUON khong?'         => KHONG voi 2 goi
#   (do lai: ui-secret-mask src 15:35 > lib 15:34 · client-hmr src 20:36 > lib 18:16)
# Buoc purge o tren chi lo 'profile cu hon lib'. Neu chinh lib CU HON src thi purge xong van cu
# => phai BUILD LAI. Bo qua buoc nay nghia la app phuc vu code cu ma moi phep kiem deu xanh.
da_build=0
for pkgdir in packages/*/*; do
  [ -d "$pkgdir/src" ] || continue
  [ -f "$pkgdir/build.ts" ] || continue
  # ⚠️ 19/10/2026 — CHI build goi DANG MOUNT (`gbh.row`) hoac dang dung co che row long (`gbh.nested`).
  #   Su co that: mot goi dang PORT DO (src moi hon lib, build loi) bi script build lai ⇒ hong luot boot
  #   cua app 5439 (client bundle khong duoc copy ⇒ #root 0). Goi chua mount thi KHONG duoc anh huong app.
  if ! grep -q '"row"[[:space:]]*:\|"nested"[[:space:]]*:' "$pkgdir/package.json"; then continue; fi
  t_src=$(mtime_moi_nhat "$pkgdir/src")
  t_lib=$(mtime_moi_nhat "$pkgdir/lib")
  if [ -n "$t_src" ] && [ -n "$t_lib" ] && [ "$t_src" -gt "$t_lib" ]; then
    echo "[restart] src moi hon lib: $(basename "$pkgdir") — build lai"
    ( cd "$pkgdir" && "$BUN" run build.ts >/dev/null 2>&1 ) || echo "[restart] CANH BAO: build loi o $(basename "$pkgdir")"
    da_build=$((da_build + 1))
  fi
done
[ "$da_build" -gt 0 ] && echo "[restart] da build lai $da_build goi co src moi hon lib"

# 19/10/2026: dong bo dist VO SPA CUA TA (da brand-rename) vao profile truoc khi bat host — host phuc vu dist
# cua ta thay vi dist stock (xem packages/host/web-runtime/src/dist.ts, ung vien thu 3).
if [ -x scripts/sync-frontend-dist.sh ]; then
  bash scripts/sync-frontend-dist.sh || echo "[restart] CANH BAO: dong bo dist that bai — se dung dist stock"
fi

# 20/10/2026 — VÁ LỖI THẬT: khối prune ở trên xoá profile copy "thieu lib/" để boot mount lại, nhưng bước
# staging của boot có thể dựng lại copy KHÔNG có lib/ (gặp với gbh-tool-subagent-control: entry sinh ra nhưng
# 'failed to import … lib/index.js' ⇒ (5)=1, (8) tụt 47.584 → 22.211 ký tự, 25/46 slot).
# ⇒ Sau khi staging xong: gói nào trong repo CÓ lib/ mà copy trong profile THIẾU thì copy lại từ repo.
if [ -d "$PROFILE_ROOT" ]; then
  for pkgdir in packages/*/*/; do
    [ -d "${pkgdir}lib" ] || continue
    name=$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${pkgdir}package.json" 2>/dev/null | head -1)
    case "$name" in @galaxy-blackhole/*) ;; *) continue ;; esac
    copy="$PROFILE_ROOT/${name#@galaxy-blackhole/}"
    [ -d "$copy" ] || continue
    if [ ! -d "$copy/lib" ]; then
      cp -R "${pkgdir}lib" "$copy/lib"
      echo "[restart] bu lib/ thieu cho $name (staging khong copy)"
    fi
  done
fi

if [ -x scripts/sync-lib-to-profile.sh ]; then
  bash scripts/sync-lib-to-profile.sh >/dev/null 2>&1 || echo "[restart] CANH BAO: dong bo lib vao profile that bai"
fi

echo "[restart] bat host (duong dan tuyet doi, go DSH_HOME/GBH_HOME cua phien agent)"
# Log host GHI VAO DUONG DAN CHUAN ma check:app doc (~/.galaxy/blackhole/host-5439.log) va TRUNCATE moi
# lan boot: truoc 18/10/2026 script ghi /tmp/host5439.log con check:app doc host-5439.log (mtime 17/10)
# => chi so (5) 'did not activate' doc LOG CU, khong phai bang chung cho luot boot hien tai (reviewer bat duoc).
HOST_LOG="$HOME/.galaxy/blackhole/host-5439.log"
mkdir -p "$(dirname "$HOST_LOG")"
: > "$HOST_LOG"
# 23/10/2026: chạy ở chế độ PTC (model chỉ gọi ĐƯỢC run_code) — đúng như bản DSH tham chiếu;
# trong patch, `tools.mode` đọc biến này. Bỏ biến ⇒ quay lại chế độ native.
nohup env -u DSH_HOME -u GBH_HOME DSH_TOOLS_MODE=ptc "$BUN" run dev:web >> "$HOST_LOG" 2>&1 &
disown 2>/dev/null || true

echo "[restart] cho host san sang (toi da 120s)..."
for _ in $(seq 1 24); do
  sleep 5
  if "$BUN" run check:app >/tmp/restart-check.txt 2>&1; then
    grep -E "KET LUAN" /tmp/restart-check.txt | head -1
    # 06/11/2026 (P1b): HỘI TỤ SAU BOOT. Lúc boot, mount chép artefact repo (id stock) vào profile rồi mới đổi id
# theo luật AN TOÀN (không đổi id trần của chính gói). Chạy lại đồng bộ ở đây để bản trên đĩa hội tụ về
# id GBH ngay sau mỗi lần restart — lần boot KẾ TIẾP sẽ nạp bản đã đổi tên.
if [ -x scripts/sync-lib-to-profile.sh ]; then bash scripts/sync-lib-to-profile.sh >/dev/null 2>&1 || true; fi

echo "[restart] XONG — URL: $(cat "$HOME/.galaxy/blackhole/ready-url.txt" 2>/dev/null | head -c 70)"
    exit 0
  fi
done
echo "[restart] host chua lanh sau 120s. 12 dong cuoi cua check:app:"
tail -12 /tmp/restart-check.txt
echo "[restart] 5 dong cuoi cua log host:"
tail -5 "$HOME/.galaxy/blackhole/host-5439.log"
exit 1