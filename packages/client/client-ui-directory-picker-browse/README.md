<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README @galaxy-blackhole/gbh-client-ui-directory-picker-browse
-->

# @galaxy-blackhole/gbh-client-ui-directory-picker-browse

Port 1:1 `@deepseek-ai/dsh-client-ui-directory-picker-browse` — gói **THƯ VIỆN** (web-app khai ở `dependencies`), **KHÔNG có row trong dump oracle**.

## Đo 4 bước (§4f)
| phép đo | kết quả |
|---|---|
| artefact | `lib/index.js` **12 dòng** + `lib/client.js` **1.044 dòng** (6 lát) |
| id stock trong client | **3** lần, nhưng **CHỈ dòng 2 (loader)** là id module; dòng **27** (`const tagId = "…/DirectoryBrowser.module.css"`) và dòng **30** (`tag.dataset.plugin`) là **DỮ LIỆU** ⇒ GIỮ NGUYÊN |
| `dsh.client` gốc | `{ inject: [api-remotes, ui-renderer, ui-workspace, client-locale], platform: 'web' }` |
| row trong dump | **KHÔNG** |

## TRƯỚC → SAU
| hạng mục | TRƯỚC | SAU |
|---|---|---|
| lib/client.js | chỉ trong stock (49.675 B, sha `55af354b…`) | **49.680 B** sha `a179150d0773cb34…` (**+5 B**), 1 id ta + 2 id stock dữ liệu |
| lib/index.js | 523 B sha `a9e0d72e…` | **byte-identical** (2 lát) |

## Cạm bẫy đã ghi
- Cổng ownership dùng **đếm `số lần id ta === số chỗ đã đổi`** (`CLIENT_ID_REPLACEMENTS = 1`) chứ KHÔNG dùng luật 'không còn id stock' — vì 2 id stock trong thân là dữ liệu (bài học `api-remote-access`).
