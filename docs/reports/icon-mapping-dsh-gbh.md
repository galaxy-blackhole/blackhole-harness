<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bảng ánh xạ icon/asset DSH → GBH: 14 primitive thương hiệu + 89 icon đang dùng, kèm nguồn artwork 1:1 (task-9)
-->

# Bảng ánh xạ DSH-icon → GBH-icon

> Nguồn số: [`asset-inventory-dsh.md`](asset-inventory-dsh.md). Kế hoạch/phạm vi: [`asset-plan.md`](asset-plan.md).

## 1. Nguyên tắc ánh xạ (theo C7 + AGENTS §2)

| # | luật | hệ quả cho bảng này |
|---|---|---|
| P1 | **Icon parity giữ SVG gốc của DSH** (C7 §1.4) | 89 glyph chung: **giữ nguyên hình**, chỉ **đổi chủ sở hữu** sang `GbhIcon` + tên GBH; artwork sao 1:1 từ nguồn đọc được |
| P2 | **Icon mới của Blackhole bọc trong primitive `GbhIcon`** (C7 §1.5) | mọi entry trong bảng đều là một entry của registry `GbhIcon` — đổi bộ icon chỉ ở **một chỗ** |
| P3 | **Asset thương hiệu thì KHÔNG parity** — brand đổi sang Galaxy Blackhole | `FishLogo`/`BrandWordmark`/`FISH_LOGO_PATH` → logo hố đen + chữ "Galaxy Blackhole" |
| P4 | Không màu/số literal trong component (C7 §1.3) | artwork dùng `currentColor`; logo GBH có gradient **nằm trong asset SVG**, không nằm trong component |

## 2. Nguồn icon/asset GBH (đo 18/10/2026)

| # | nguồn | đường dẫn (workspace) | số đo / sha256 |
|---|---|---|---|
| 1 | **Logo hố đen (vector, chuẩn)** | `galaxy-blackhole/blackhole-desktop-electron/host/cli/web/brand/logo.svg` | 1.225 B · 128×128 · sha256 `d7fac4b4c9d2b4b876e0e354a6d650cea2249dddb84247179e94b58e564333d9` |
| 2 | **Favicon GBH (vector)** | `…/blackhole-desktop-electron/host/cli/web/brand/favicon.svg` | 602 B · 64×64 · sha256 `105ca4ce73ac1dc8707715b700dd16113fb6b8e7fa39af9251d3ca44749c4fc3` |
| 3 | Bản sao y hệt trong repo web đang chạy (oracle A) | `galaxy-blackhole/galaxy-code/web/brand/logo.svg` · `favicon.svg` | **cùng sha256** với #1/#2 ⇒ một nguồn, hai bản sao |
| 4 | Logo raster 128×128 (oracle dùng trong `<img>`) | `…/brand/logo.png` | 20.121 B |
| 5 | App icon 192/512 | `…/brand/app-icon-192.png` · `app-icon-512.png` | 15.651 B · 49.112 B |
| 6 | Icon app Tauri (bản cũ) | `galaxy-blackhole/blackhole-desktop-tauri/src-tauri/icons/icon.png` | sha256 **= `app-icon-512.png`** |
| 7 | Logo cũ của CLI `gbh` (khác thiết kế: hành tinh viền cyan + lấp lánh) | `galaxy-blackhole/gbh/brand/logo.png` | 3.191 B · 200×200 — **KHÔNG dùng** (oracle dùng #1) |

> **Không tồn tại "bộ icon UI" của Blackhole** trong workspace: quét toàn bộ `galaxy-blackhole/` + `galaxy-quasar/`
> (trừ `node_modules`/`.vscode-test`): chỉ có **4 asset thương hiệu** ở trên + 0 thư viện icon
> (0 khai báo `lucide-react`, 0 bộ SVG icon). ⇒ Với **glyph chung**, ánh xạ đúng là **P1: giữ nguyên hình, đổi chủ**.

## 3. Bảng A — asset thương hiệu (14 primitive, đổi sang GBH)

| # | DSH | GBH thay thế | nguồn GBH | ghi chú |
|---|---|---|---|---|
| A1 | `FishLogo` (props: `size=24`, `className`) | `GbhIcon name="gbh-logo"` (viewBox `0 0 128 128`, cao = size) | #1 logo.svg | logo cá → **logo hố đen**; slot `sidebar.brand.mark` |
| A2 | `BrandWordmark` (props: `size=24`, `includeMark`) | `GbhWordmark` (chữ "Galaxy Blackhole", 14px/600/0.01em/nowrap) | oracle `GbhBrandName` (`galaxy-code/web/brand/lib/client.js`) | slot `sidebar.brand.name`; **không** dùng font lạ |
| A3 | `FISH_LOGO_PATH` | `GBH_LOGO_ARTWORK` (cây SVG đầy đủ: defs + 2 circle + 2 ellipse; không có "một path" tương đương) | #1 logo.svg | ui-conversation dùng cho hero + SMIL; đổi ở **pha sau** (gói brand riêng) |
| A4 | `FISH_LOGO_VIEWBOX` (`23.16×17.04`) | `GBH_LOGO_VIEWBOX` (`0 0 128 128`) | #1 logo.svg | **vuông** ⇒ height = size (fish cao = size × 17.04/23.16) |
| A5 | `SHIELD_OUTLINE_PATH` | `gbh-icon:shield` (giữ nguyên path) | P1 | glyph chung — không phải thương hiệu |
| A6 | `FileTypeIcon` | `gbh-icon:file-type` (9 artwork loại tệp) | P1 | 8 gói dùng |
| A7 | `ReferenceIconRegular` | `gbh-icon:reference` | P1 | 3 gói dùng |
| A8 | `PermissionIconReadOnlyRegular` | `gbh-icon:permission-read-only` | P1 | ui-permission |
| A9 | `PluginArtworkDefault` | `gbh-icon:plugin-artwork-default` | P1 | ui-plugin-market |
| A10 | `PluginArtworkTerminal` | `gbh-icon:plugin-artwork-terminal` | P1 | ui-sidebar-terminal |
| A11 | `GuideArtworkBrowser` | `gbh-icon:guide-artwork-browser` | P1 | ui-sidebar-browser |
| A12 | `GuideArtworkFiles` | `gbh-icon:guide-artwork-files` | P1 | ui-sidebar-files |
| A13 | favicon vỏ (`favicon.svg` + `favicon-dark.svg`) | **favicon GBH** | #2 favicon.svg | lớp L3 — host phải đè `/favicon.svg` |
| A14 | manifest "DeepSeek Harness"/"DSH" + `<title>` | manifest GBH + `<title>Galaxy Blackhole</title>` | #1/#2 | lớp L3 |

## 4. Bảng B — 89 icon đang dùng lúc khảo sát (glyph chung, giữ hình theo P1)

> Bảng chụp **89 tên** tại thời điểm khảo sát 18/10/2026 20:45. Đo lại 21:30: **92 tên / 221 cặp / 32 gói**
> (thêm `IconDarkOutlineMedium`, `IconFollowsystemOutlineMedium`, `IconLightOutlineMedium` — đều đã có sẵn trong sổ GBH).
> Sổ GBH phủ **toàn bộ 189 icon** của nguồn, nên icon mới dùng thêm không cần sửa bảng này.

Quy ước tên GBH: bỏ tiền tố `Icon`, CamelCase → kebab-case, giữ hậu tố `-regular`/`-medium`
(vd `IconChevronDownOutlineRegular` → `gbh-icon:chevron-down-outline-regular`). Tên DSH **vẫn được giữ**
trong bảng `DSH_TO_GBH_ICON` của gói `ui-primitives` để mọi chỗ gọi cũ đổi được bằng một phép tra.

| # | icon DSH | icon GBH | viewBox | #path | gói đang dùng |
|---|---|---|---|---|---|
| 1 | `IconAgentPresetOutlineMedium` | `gbh-icon:agent-preset-outline-medium` | 0 0 16 16 | 4 | ui-settings-general |
| 2 | `IconAgentPresetOutlineRegular` | `gbh-icon:agent-preset-outline-regular` | 0 0 16 16 | 4 | ui-agent-preset, ui-chat, ui-tool |
| 3 | `IconApiOutlineRegular` | `gbh-icon:api-outline-regular` | 0 0 16 16 | 2 | ui-chat, ui-tool |
| 4 | `IconArchiveCheckOutlineRegular` | `gbh-icon:archive-check-outline-regular` | 0 0 16 16 | 2 | ui-workspace |
| 5 | `IconArchiveOffOutlineRegular` | `gbh-icon:archive-off-outline-regular` | - | 0 | ui-workspace |
| 6 | `IconArchiveOutlineMedium` | `gbh-icon:archive-outline-medium` | 0 0 16 16 | 3 | ui-settings-general |
| 7 | `IconArchiveOutlineRegular` | `gbh-icon:archive-outline-regular` | 0 0 16 16 | 3 | ui-workspace |
| 8 | `IconBranchOutlineRegular` | `gbh-icon:branch-outline-regular` | 0 0 16 16 | 2 | ui-chat, ui-tool, ui-workspace |
| 9 | `IconBrowseOutlineRegular` | `gbh-icon:browse-outline-regular` | 0 0 16 16 | 3 | ui-agent-preset, ui-chat, ui-tool |
| 10 | `IconCheckOutlineRegular` | `gbh-icon:check-outline-regular` | 0 0 16 16 | 1 | ui-chat, ui-commands, ui-conversation, ui-goal, ui-schedule, ui-settings-account, ui-tool, ui-trajectory |
| 11 | `IconChecklistOutlineRegular` | `gbh-icon:checklist-outline-regular` | 0 0 16 16 | 4 | ui-conversation, ui-tool |
| 12 | `IconChevronDownOutlineRegular` | `gbh-icon:chevron-down-outline-regular` | 0 0 16 16 | 1 | locale, ui-agent-preset, ui-chat, ui-conversation, ui-deliverables, ui-jobs, ui-open-in-app, ui-permission, ui-plugin-market, ui-schedule, ui-settings-models, ui-settings-plugin-inventory, ui-sidebar-documentpreview, ui-sidebar-terminal, ui-skill, ui-subagent, ui-tool |
| 13 | `IconChevronLeftOutlineRegular` | `gbh-icon:chevron-left-outline-regular` | 0 0 16 16 | 1 | ui-schedule, ui-settings-account, ui-sidebar-browser |
| 14 | `IconChevronRightOutlineRegular` | `gbh-icon:chevron-right-outline-regular` | 0 0 16 16 | 1 | ui-chat, ui-plan, ui-schedule, ui-settings-models, ui-sidebar-browser, ui-subagent, ui-tool, ui-trajectory, ui-workflow-run |
| 15 | `IconChevronUpOutlineRegular` | `gbh-icon:chevron-up-outline-regular` | 0 0 16 16 | 1 | ui-chat, ui-conversation, ui-deliverables, ui-schedule, ui-tool |
| 16 | `IconChevronsUpDownOutlineRegular` | `gbh-icon:chevrons-up-down-outline-regular` | 0 0 16 16 | 2 | ui-workspace |
| 17 | `IconClockOutlineRegular` | `gbh-icon:clock-outline-regular` | 0 0 16 16 | 2 | ui-chat, ui-schedule, ui-tool, ui-workspace |
| 18 | `IconCloseCircleFillRegular` | `gbh-icon:close-circle-fill-regular` | 0 0 16 16 | 1 | ui-plan |
| 19 | `IconCloseFillRegular` | `gbh-icon:close-fill-regular` | 0 0 16 16 | 2 | ui-workspace |
| 20 | `IconCloseOutlineRegular` | `gbh-icon:close-outline-regular` | 0 0 16 16 | 2 | ui-agent-preset, ui-conversation, ui-goal, ui-schedule, ui-settings-account, ui-settings-general, ui-shortcuts, ui-sidebar-documentpreview |
| 21 | `IconCodeOutlineRegular` | `gbh-icon:code-outline-regular` | 0 0 16 16 | 4 | ui-chat, ui-tool, ui-trajectory |
| 22 | `IconCompactOutlineRegular` | `gbh-icon:compact-outline-regular` | 0 0 16 16 | 2 | ui-commands |
| 23 | `IconCompareSplitOutlineRegular` | `gbh-icon:compare-split-outline-regular` | 0 0 16 16 | 2 | ui-deliverables |
| 24 | `IconContextInjectionOutlineRegular` | `gbh-icon:context-injection-outline-regular` | 0 0 16 16 | 4 | ui-chat |
| 25 | `IconCopyOutlineRegular` | `gbh-icon:copy-outline-regular` | 0 0 16 16 | 1 | ui-chat, ui-trajectory, ui-workspace |
| 26 | `IconCordisPluginOutlineRegular` | `gbh-icon:cordis-plugin-outline-regular` | 0 0 16 16 | 1 | ui-chat, ui-tool |
| 27 | `IconDataOutlineMedium` | `gbh-icon:data-outline-medium` | 0 0 16 16 | 2 | ui-settings-general |
| 28 | `IconDatabaseOutlineRegular` | `gbh-icon:database-outline-regular` | 0 0 16 16 | 5 | ui-chat |
| 29 | `IconDeliverDocRegular` | `gbh-icon:deliver-doc-regular` | 0 0 16 16 | 5 | ui-deliverables |
| 30 | `IconDislikeFillRegular` | `gbh-icon:dislike-fill-regular` | 0 0 16 16 | 1 | ui-message-feedback |
| 31 | `IconDislikeOutlineRegular` | `gbh-icon:dislike-outline-regular` | 0 0 16 16 | 1 | ui-message-feedback |
| 32 | `IconDownloadOutlineRegular` | `gbh-icon:download-outline-regular` | 0 0 16 16 | 3 | ui-commands |
| 33 | `IconEditOutlineRegular` | `gbh-icon:edit-outline-regular` | 0 0 16 16 | 2 | ui-chat, ui-conversation, ui-goal, ui-tool, ui-workspace |
| 34 | `IconEllipsisOutlineMedium` | `gbh-icon:ellipsis-outline-medium` | 0 0 16 16 | 3 | ui-settings-account |
| 35 | `IconEllipsisOutlineRegular` | `gbh-icon:ellipsis-outline-regular` | 0 0 16 16 | 3 | ui-schedule, ui-workspace |
| 36 | `IconFlatListOutlineRegular` | `gbh-icon:flat-list-outline-regular` | 0 0 16 16 | 2 | ui-workspace |
| 37 | `IconFolderCloseRegular` | `gbh-icon:folder-close-regular` | 0 0 16 16 | 2 | ui-conversation, ui-sidebar-files, ui-workspace |
| 38 | `IconFolderOpenOutlineRegular` | `gbh-icon:folder-open-outline-regular` | 0 0 16 16 | 2 | ui-open-in-app |
| 39 | `IconFolderOpenRegular` | `gbh-icon:folder-open-regular` | 0 0 16 16 | 3 | ui-conversation, ui-sidebar-files, ui-workspace |
| 40 | `IconGaugeOutlineRegular` | `gbh-icon:gauge-outline-regular` | 0 0 16 16 | 3 | ui-chat |
| 41 | `IconGlobeOutlineRegular` | `gbh-icon:globe-outline-regular` | 0 0 16 16 | 4 | ui-chat, ui-sidebar-browser, ui-tool |
| 42 | `IconGoalOutlineRegular` | `gbh-icon:goal-outline-regular` | 0 0 16 16 | 4 | ui-chat, ui-commands, ui-goal, ui-tool |
| 43 | `IconInfoOutlineRegular` | `gbh-icon:info-outline-regular` | 0 0 14 14 | 3 | ui-schedule |
| 44 | `IconInspectOutlineRegular` | `gbh-icon:inspect-outline-regular` | 0 0 16 16 | 3 | ui-deliverables, ui-skill, ui-tool |
| 45 | `IconLikeFillRegular` | `gbh-icon:like-fill-regular` | 0 0 16 16 | 1 | ui-message-feedback |
| 46 | `IconLikeOutlineRegular` | `gbh-icon:like-outline-regular` | 0 0 16 16 | 1 | ui-message-feedback |
| 47 | `IconLinkOutlineRegular` | `gbh-icon:link-outline-regular` | 0 0 16 16 | 2 | ui-sidebar-browser |
| 48 | `IconListPenOutlineRegular` | `gbh-icon:list-pen-outline-regular` | 0 0 16 16 | 5 | ui-agent-preset |
| 49 | `IconLoadingOutlineRegular` | `gbh-icon:loading-outline-regular` | 0 0 16 16 | 1 | ui-settings-account |
| 50 | `IconNewChatOutlineMedium` | `gbh-icon:new-chat-outline-medium` | 0 0 16 16 | 3 | ui-sidebar |
| 51 | `IconNewChatOutlineRegular` | `gbh-icon:new-chat-outline-regular` | 0 0 16 16 | 3 | ui-sidebar, ui-workspace |
| 52 | `IconNowrapFillRegular` | `gbh-icon:nowrap-fill-regular` | - | 0 | ui-deliverables, ui-sidebar-documentpreview |
| 53 | `IconPanelLeftOutlineRegular` | `gbh-icon:panel-left-outline-regular` | 0 0 16 16 | 2 | ui-sidebar-right, ui-sidebar |
| 54 | `IconPaperPlaneOutlineMedium` | `gbh-icon:paper-plane-outline-medium` | 0 0 16 16 | 2 | ui-settings-account |
| 55 | `IconPaperPlaneOutlineRegular` | `gbh-icon:paper-plane-outline-regular` | 0 0 16 16 | 2 | ui-chat, ui-commands |
| 56 | `IconPaperclipOutlineRegular` | `gbh-icon:paperclip-outline-regular` | 0 0 16 16 | 1 | ui-conversation |
| 57 | `IconPauseOutlineRegular` | `gbh-icon:pause-outline-regular` | 0 0 16 16 | 3 | ui-goal, ui-sidebar-documentpreview, ui-sidebar-files |
| 58 | `IconPersonalizationOutlineMedium` | `gbh-icon:personalization-outline-medium` | 0 0 16 16 | 3 | ui-settings-general |
| 59 | `IconPinFillRegular` | `gbh-icon:pin-fill-regular` | 0 0 16 16 | 2 | ui-workspace |
| 60 | `IconPinOutlineRegular` | `gbh-icon:pin-outline-regular` | 0 0 16 16 | 2 | ui-workspace |
| 61 | `IconPlanOutlineRegular` | `gbh-icon:plan-outline-regular` | - | 0 | ui-chat, ui-commands, ui-plan |
| 62 | `IconPlayOutlineRegular` | `gbh-icon:play-outline-regular` | 0 0 16 16 | 2 | ui-goal, ui-sidebar-documentpreview, ui-sidebar-files, ui-tool |
| 63 | `IconPlusOutlineMedium` | `gbh-icon:plus-outline-medium` | 0 0 16 16 | 2 | ui-conversation |
| 64 | `IconPlusOutlineRegular` | `gbh-icon:plus-outline-regular` | 0 0 16 16 | 2 | ui-agent-preset, ui-plugin-market, ui-schedule, ui-settings-models, ui-sidebar-documentpreview, ui-workspace |
| 65 | `IconProjectAddOutlineRegular` | `gbh-icon:project-add-outline-regular` | 0 0 16 16 | 3 | ui-workspace |
| 66 | `IconQuestionOutlineRegular` | `gbh-icon:question-outline-regular` | 0 0 16 16 | 3 | ui-chat, ui-tool |
| 67 | `IconQueueOutlineRegular` | `gbh-icon:queue-outline-regular` | - | 0 | ui-chat, ui-conversation, ui-workspace |
| 68 | `IconRefreshOutlineRegular` | `gbh-icon:refresh-outline-regular` | 0 0 16 16 | 2 | ui-plugin-market, ui-shortcuts, ui-sidebar-browser, ui-sidebar-documentpreview, ui-sidebar-files, ui-subagent |
| 69 | `IconRightUpOutlineRegular` | `gbh-icon:right-up-outline-regular` | 0 0 16 16 | 2 | ui-open-in-app, ui-settings-account, ui-sidebar-browser |
| 70 | `IconSearchOutlineRegular` | `gbh-icon:search-outline-regular` | 0 0 16 16 | 2 | ui-chat, ui-plugin-market, ui-schedule, ui-settings-plugin-inventory, ui-tool, ui-trajectory, ui-workspace |
| 71 | `IconSendOutlineRegular` | `gbh-icon:send-outline-regular` | 0 0 16 16 | 2 | ui-conversation |
| 72 | `IconSettingsOutlineMedium` | `gbh-icon:settings-outline-medium` | 0 0 16 16 | 2 | ui-settings-account, ui-settings-general |
| 73 | `IconSettingsOutlineRegular` | `gbh-icon:settings-outline-regular` | 0 0 16 16 | 2 | ui-trajectory |
| 74 | `IconSkillOutlineRegular` | `gbh-icon:skill-outline-regular` | 0 0 17 17 | 4 | ui-skill |
| 75 | `IconSlidersTwoOutlineRegular` | `gbh-icon:sliders-two-outline-regular` | 0 0 16 16 | 2 | ui-plugin-market, ui-workspace |
| 76 | `IconSparkleRegular` | `gbh-icon:sparkle-regular` | 0 0 16 16 | 3 | ui-chat, ui-tool, ui-trajectory |
| 77 | `IconStopFillRegular` | `gbh-icon:stop-fill-regular` | 0 0 16 16 | 1 | ui-jobs |
| 78 | `IconThinkOutlineRegular` | `gbh-icon:think-outline-regular` | 0 0 16 16 | 3 | ui-chat |
| 79 | `IconTrashOutlineRegular` | `gbh-icon:trash-outline-regular` | 0 0 16 16 | 5 | ui-conversation, ui-goal, ui-plugin-market, ui-schedule, ui-settings-models, ui-workspace |
| 80 | `IconTriangleRightFillRegular` | `gbh-icon:triangle-right-fill-regular` | 0 0 16 16 | 1 | ui-workspace |
| 81 | `IconUnarchiveOutlineRegular` | `gbh-icon:unarchive-outline-regular` | 0 0 20 20 | 2 | ui-workspace |
| 82 | `IconUserOutlineMedium` | `gbh-icon:user-outline-medium` | 0 0 16 16 | 2 | ui-settings-account, ui-settings-general |
| 83 | `IconUserOutlineRegular` | `gbh-icon:user-outline-regular` | 0 0 16 16 | 2 | ui-trajectory |
| 84 | `IconUsersOutlineRegular` | `gbh-icon:users-outline-regular` | 0 0 16 16 | 4 | ui-tool |
| 85 | `IconWarningOutlineRegular` | `gbh-icon:warning-outline-regular` | 0 0 16 16 | 3 | ui-agent-preset, ui-chat, ui-conversation, ui-message-feedback, ui-open-in-app, ui-plugin-market, ui-schedule, ui-settings-account, ui-workspace |
| 86 | `IconWarningTriangleOutlineRegular` | `gbh-icon:warning-triangle-outline-regular` | 0 0 16 16 | 2 | ui-sidebar-documentpreview |
| 87 | `IconWorkspaceTreeOutlineRegular` | `gbh-icon:workspace-tree-outline-regular` | 0 0 16 16 | 2 | ui-workspace |
| 88 | `IconWrapFillRegular` | `gbh-icon:wrap-fill-regular` | - | 0 | ui-deliverables, ui-sidebar-documentpreview |
| 89 | `IconWrapLinesOutlineRegular` | `gbh-icon:wrap-lines-outline-regular` | 0 0 16 16 | 5 | ui-trajectory |

## 4b. Trạng thái triển khai (18/10/2026)

| hạng mục | trạng thái |
|---|---|
| Bộ icon (`GBH_ICONS`: 189 icon + 12 entry họ tổ hợp) | **ĐÃ CÓ** trong `packages/client/ui-primitives` — chưa mount |
| Artwork (`GBH_ARTWORKS`: 100 tĩnh + 3 động + 2 alias) | **ĐÃ CÓ**, 1:1 với vỏ (153/153 chuỗi path byte-identical) |
| A1/A2 (brand slot sidebar) | **ĐÃ ĐỔI** trong `ui-brand-official` — đo lab: logo hố đen + chữ "Galaxy Blackhole" |
| A3/A4 (hero/fish path) | **CHƯA ĐỔI** — thuộc `ui-conversation` (bundle nguyên văn); cần gói brand riêng |
| A5–A12 (Shield/FileType/Reference/Permission/Plugin/Guide artwork) | port **shield + reference + permission + plugin/guide artwork** vào sổ; `FileTypeIcon`/`CodeFileIcon` là **hành vi** → pha L2 |
| A13/A14 (favicon/manifest/title) | **CHƯA ĐỔI** — kế hoạch: `docs/reports/shell-identity-plan.md` |

## 5. Ghi chú parity & rủi ro của phép ánh xạ

1. **Giữ hình = giữ pixel** (P1): 153/153 chuỗi path của nguồn đọc được có mặt byte-identical trong vỏ đang chạy
   (§1b của báo cáo kiểm kê) ⇒ port 1:1 **không đổi giao diện**; đây là điều kiện để L2 không cần ảnh A/B cho từng icon.
2. **Ngoại lệ có đổi hình**: chỉ A1–A4 (thương hiệu). Phải có **cặp ảnh TRƯỚC → SAU** + 3 số (`#root`, lỗi console,
   `did not activate`) + ảnh brand.
3. **Sai lệch đã biết**: `FishLogo` cao = `size × 17.04/23.16` (tỉ lệ ngang); logo GBH **vuông** ⇒
   `GbhIcon` phải dùng `height = size` để không méo.
4. **Không đổi tên export cũ trong bundle hiện tại** khi chưa có bảng module thay thế: 53 bundle đang
   `require("@deepseek-ai/dsh-client-ui-primitives")`; đổi tên trước khi có module của ta = app trắng.
5. **Bản quyền**: artwork DSH là MIT (repo public, LICENSE trong `vendor/dsh-client-ui-primitives/LICENSE`),
   ta giữ nguyên hình theo C7 và ghi nguồn trong JSDoc từng file registry (G4: đối chiếu được về nguồn).
