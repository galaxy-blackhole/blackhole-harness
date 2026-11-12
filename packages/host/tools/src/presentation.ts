/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 presentation.js/.d.ts (bản gốc 7 dòng mã chạy): từ vựng RENDER-INTENT mà một tool khai
 *      qua `ToolDefinition.presentCall`/`presentResult` để nói một lời gọi của nó hiển thị thế nào
 *      trong UI (thẻ tool-call của editor, một dòng log CLI). Tệp CHỈ có kiểu ⇒ bản build ra là module rỗng.
 */

import type { ContentBlock } from "@deepseek-ai/dsh-llm";

/**
 * Phân loại một lời gọi tool để UI chọn biểu tượng/cách xử lý; từ vựng trung lập nhà cung cấp cho
 * phép tool tự mô tả mà không phụ thuộc một client cụ thể; `other` là mặc định.
 * Nhận: một trong tám nhãn cố định của union.
 * Trả: nhãn để UI quyết định biểu tượng; không có giá trị lúc chạy.
 */
export type ToolCallKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "fetch" | "other";

/**
 * Một vị trí TỆP mà tool đọc hoặc sửa, để UI đủ năng lực "đi theo" — tô sáng hoặc nhảy tới tệp (và
 * dòng) khi tool chạy. `path` là thứ tool đã tác động (đường dẫn phía model); `line` là dòng
 * 1-based tuỳ chọn để lấy nét (ví dụ `offset` của một lệnh read).
 * Nhận: `path` bắt buộc và `line` tuỳ chọn do tool khai trong presenter.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface FileLocation {
  /** Đường dẫn phía model mà tool đã tác động. */
  path: string;
  /** Dòng 1-based tuỳ chọn cần lấy nét. */
  line?: number;
}

/**
 * Một thay đổi trên MỘT tệp mà tool sắp thực hiện, cho UI render diff tại chỗ. `oldText` là `null`
 * khi tạo tệp mới (không có gì để so); một lần ghi đè cũng dùng `null` vì presenter lúc gọi không
 * có quyền đọc nội dung cũ của tệp.
 * Nhận: `path`, `oldText` (hoặc `null`) và `newText` của thay đổi.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface FileDiff {
  /** Đường dẫn phía model của tệp bị thay đổi. */
  path: string;
  /** Nội dung TRƯỚC, hoặc `null` cho tệp mới / lần ghi đè (không có nội dung cũ ở thời điểm gọi). */
  oldText: string | null;
  /** Nội dung SAU thay đổi. */
  newText: string;
}

/**
 * Trình bày một lời gọi ĐANG CHỜ, trung lập nhà cung cấp. Tool khai đúng MỘT intent có thẻ; cầu nối
 * UI ánh xạ intent đó mà không phải đặc cách theo tên tool.
 * Nhận: một trong ba biến thể `generic` · `terminal` · `diff`.
 * Trả: intent render cho trạng thái chờ; không có giá trị lúc chạy.
 */
export type ToolCallView = GenericCallView | TerminalCallView | DiffCallView;

/**
 * Thẻ MẶC ĐỊNH: một dòng tool-call có tiêu đề, biểu tượng phân loại tuỳ chọn, đầu vào thô đáng chú ý,
 * các content block bổ sung và vị trí tệp để đi theo. Mọi tool mà lời gọi không phải terminal hay
 * diff đều dùng thẻ này.
 * Nhận: `title` bắt buộc cùng `kind`/`rawInput`/`content`/`locations` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface GenericCallView {
  /** Thẻ phân loại của biến thể này. */
  card: "generic";
  /**
   * Nhãn người đọc được, LUÔN hiển thị, mô tả lời gọi NÀY làm gì. Giữ ngắn — UI hiển thị nó như
   * tiêu đề thẻ / một dòng log.
   */
  title: string;
  /** Phân loại cho biểu tượng/cách xử lý; mặc định `other` khi vắng. */
  kind?: ToolCallKind;
  /**
   * Đầu vào đáng chú ý để hiện ở chế độ chi tiết/mở rộng (ví dụ id một job nền). Vắng là không hiện
   * gì; chuỗi hiện nguyên văn, object hiện JSON đẹp. KHÔNG phải toàn bộ object args thô trừ khi đó
   * thật sự là thứ người đọc muốn.
   */
  rawInput?: unknown;
  /**
   * Các content block phía UI để hiện cạnh tiêu đề ở trạng thái chờ. Vắng là không hiện; UI ánh xạ
   * chúng sang content block của chính nó.
   */
  content?: ContentBlock[];
  /** Các tệp lời gọi này đọc/sửa, để editor đi theo. Vắng khi lời gọi không chạm tệp nào. */
  locations?: FileLocation[];
}

/**
 * Một lời gọi LÀ một lệnh shell chạy trong một thư mục làm việc: UI đủ năng lực render nó thành thẻ
 * terminal (đầu thẻ là cwd, tiêu đề là lệnh, đầu ra sống/sau khi chạy lấy từ
 * {@link TerminalResultView}); UI không đủ năng lực rơi về thẻ generic với thân là đầu ra lệnh trong
 * khối fenced. Do tool mà lời gọi là một lệnh foreground đặt (ví dụ `bash`).
 * Nhận: `title` bắt buộc cùng `description`/`cwd` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface TerminalCallView {
  /** Thẻ phân loại của biến thể này. */
  card: "terminal";
  /** Câu lệnh, hiện làm tiêu đề / dòng đầu của thẻ terminal. */
  title: string;
  /**
   * Tóm tắt một dòng, người đọc được, về việc câu lệnh làm gì; render PHÍA TRÊN thẻ terminal (thẻ
   * không có chỗ cho mô tả). Vắng là không có.
   */
  description?: string;
  /**
   * Thư mục làm việc câu lệnh chạy trong, hiện ở đầu thẻ terminal. Đường dẫn TUYỆT ĐỐI dùng nguyên
   * văn; đường dẫn TƯƠNG ĐỐI do cầu nối UI giải theo thư mục làm việc của phiên (presenter thuần
   * không thấy cwd của phiên). Vắng hoàn toàn để cầu nối dùng thư mục làm việc của phiên.
   */
  cwd?: string;
}

/**
 * Một lời gọi tạo hoặc sửa tệp, được UI đủ năng lực render thành thẻ diff tại chỗ. Do tool mà lời gọi
 * ghi/sửa một tệp đặt (ví dụ `write`, `edit`). Các diff suy từ THAM SỐ của lời gọi (`oldText` của
 * lần tạo là `null`); tool phát một {@link DiffResultView} riêng sau `execute` — thay đổi ĐÃ áp
 * (hunk sửa/ghi đè kèm ngữ cảnh, hoặc diff toàn tệp cho lần tạo).
 * Nhận: `title`, `diffs` bắt buộc và `locations` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface DiffCallView {
  /** Thẻ phân loại của biến thể này. */
  card: "diff";
  /** Đầu thẻ (ví dụ `Write foo.txt`). */
  title: string;
  /** Mỗi tệp lời gọi thay đổi một mục. */
  diffs: FileDiff[];
  /** Các tệp lời gọi này sửa, để editor đi theo (thường là đường dẫn trong `diffs`). */
  locations?: FileLocation[];
}

/**
 * Một dòng tệp có số thứ tự — đơn vị mà {@link ReadResultView} mang để UI đủ năng lực render khung
 * mã có tô sáng cú pháp và số dòng. `number` là số dòng 1-based trong tệp (một cửa sổ sau
 * `offset` giữ cách đánh số của chính tệp, không đếm lại từ 1); `text` là dòng không kèm newline
 * cuối, đã cắt theo trần mỗi dòng của tool read.
 * Nhận: `number` và `text` của một dòng tệp.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface ReadFileLine {
  /** Số dòng 1-based trong tệp. */
  number: number;
  /** Nội dung dòng, không kèm newline cuối. */
  text: string;
}

/**
 * Cách tool muốn hiển thị lời gọi ĐÃ XONG — trạng thái KẾT QUẢ, sau khi `execute` trả về. Một union
 * có thẻ `card` soi gương {@link ToolCallView}: UI chuyển nhánh theo `card`. Cho phép tool định dạng
 * lại kết quả cho UI khác với văn bản phía model mà `execute` trả. Do
 * `ToolDefinition.presentResult` trả; vắng phương thức này thì giữ tiêu đề trạng thái chờ và render
 * content thô của kết quả.
 * Nhận: một trong sáu biến thể `generic` · `terminal` · `diff` · `search` · `read` · `web`.
 * Trả: intent render cho trạng thái xong; không có giá trị lúc chạy.
 */
export type ToolResultView =
  | GenericResultView
  | TerminalResultView
  | DiffResultView
  | SearchResultView
  | ReadResultView
  | WebResultView;

/**
 * Thẻ hoàn tất MẶC ĐỊNH: tiêu đề thay thế tuỳ chọn và content đã định dạng lại. Vắng một trường là
 * giữ tiêu đề trạng thái chờ / render content thô của kết quả.
 * Nhận: `title` và `content` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface GenericResultView {
  /** Thẻ phân loại của biến thể này. */
  card: "generic";
  /** Tiêu đề thay thế cho lời gọi đã xong. Vắng là giữ tiêu đề trạng thái chờ. */
  title?: string;
  /**
   * Content phía UI (các {@link ContentBlock} của harness), định dạng lại từ kết quả phía model.
   * Vắng là để UI render content thô của kết quả.
   */
  content?: ContentBlock[];
}

/**
 * Trạng thái hoàn tất của một {@link TerminalCallView}: đầu ra đã bắt và trạng thái thoát. UI đủ
 * năng lực render `output` trong thẻ terminal và hiện một pill trạng thái thoát; UI không đủ năng
 * lực nhận khối fenced ```console do CẦU NỐI suy từ `output` (tool không mã hoá hai lần).
 * Nhận: `title`/`output`/`exitCode`/`signal` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface TerminalResultView {
  /** Thẻ phân loại của biến thể này. */
  card: "terminal";
  /** Tiêu đề thay thế cho lời gọi đã xong. Vắng là giữ tiêu đề trạng thái chờ. */
  title?: string;
  /** Đầu ra đã bắt của câu lệnh (stdout+stderr theo cách tool chọn gộp). */
  output?: string;
  /**
   * Mã thoát của tiến trình, khi lần chạy kết thúc bằng việc thoát (không phải bằng tín hiệu). Cho
   * UI đủ năng lực hiện pill trạng thái thoát. Vắng khi bị tín hiệu giết hoặc không rõ.
   */
  exitCode?: number;
  /** Tên tín hiệu đã giết tiến trình (ví dụ `SIGTERM`). Loại trừ lẫn nhau với `exitCode`. */
  signal?: string;
}

/**
 * Một lần sửa tệp đã xong, render thành thẻ diff tại chỗ — bản tương ứng ở thời điểm kết quả của
 * {@link DiffCallView}. Vì một lần cập nhật UI đã xong sẽ THAY content của thẻ chờ, tool sửa tệp vẫn
 * trả về kiểu này kể cả khi nó lặp lại diff lúc gọi; nếu không, văn bản kết quả thô sẽ thay mất diff.
 * Nhận: `title` tuỳ chọn và `diffs` bắt buộc.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface DiffResultView {
  /** Thẻ phân loại của biến thể này. */
  card: "diff";
  /** Tiêu đề thay thế cho lời gọi đã xong. Vắng là giữ tiêu đề trạng thái chờ. */
  title?: string;
  /** Thay đổi cần hiện, theo thứ tự tệp — các hunk ngữ cảnh đã áp, hoặc diff toàn tệp khi không có ảnh trước. */
  diffs: FileDiff[];
}

/** Một dòng khớp bên trong một nhóm {@link SearchFileMatches}: số dòng 1-based và nội dung dòng. */
export interface SearchLineMatch {
  /** Số dòng 1-based của lần khớp trong tệp của nó. */
  lineNumber: number;
  /** Nội dung dòng đã khớp, đúng như tool đưa ra (trần xem trước mỗi dòng đã áp). */
  line: string;
}

/** Các dòng khớp của MỘT tệp cho một {@link SearchMatchesResultView}, theo thứ tự tệp gặp lần đầu. */
export interface SearchFileMatches {
  /** Tệp mà các lần khớp thuộc về (đường dẫn hiển thị phía model). */
  path: string;
  /** Các dòng khớp của tệp, theo thứ tự đầu ra. */
  matches: SearchLineMatch[];
}

/**
 * Một lần tìm nội dung (`grep`) đã xong, render thành thẻ search với các lần khớp NHÓM THEO TỆP, để
 * UI đủ năng lực liệt kê mỗi tệp thành một nhóm mở rộng được của các dòng khớp.
 * `shape: 'matches'` phân biệt biến thể này với biến thể đường dẫn ({@link SearchPathsResultView})
 * trong {@link SearchResultView}. Dấu phân biệt là `shape`, không phải `kind`, nên nó không bao giờ
 * đụng {@link ToolCallKind} `kind` mà một cầu nối chọn biểu tượng đọc trên view lời gọi.
 * Nhận: `files`, `truncated`, `total` bắt buộc và `title` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface SearchMatchesResultView {
  /** Thẻ phân loại của biến thể này. */
  card: "search";
  /** Dấu phân biệt biến thể nhóm-theo-tệp. */
  shape: "matches";
  /** Tiêu đề thay thế cho lời gọi đã xong. Vắng là giữ tiêu đề trạng thái chờ. */
  title?: string;
  /** Các dòng khớp nhóm theo tệp, theo thứ tự tệp gặp lần đầu. */
  files: SearchFileMatches[];
  /**
   * Tool có cắt kết quả tại chỗ hay không: `files` chỉ mang các lần khớp được giữ, không phải mọi
   * lần khớp mà lần tìm đã thấy. UI hiện dấu hiệu "đã cắt" để không trình bày một nhóm thiếu như
   * nhóm đầy đủ.
   */
  truncated: boolean;
  /** Tổng số lần khớp lần tìm đã thấy trước khi cắt (bằng số được giữ khi không `truncated`). */
  total: number;
}

/**
 * Một lần tìm ĐƯỜNG DẪN (`glob`) đã xong, render thành thẻ search với kết quả là một danh sách
 * đường dẫn phẳng. `shape: 'paths'` phân biệt biến thể này với biến thể nhóm-theo-tệp
 * ({@link SearchMatchesResultView}) trong {@link SearchResultView}.
 * Nhận: `paths`, `truncated`, `total` bắt buộc và `title` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface SearchPathsResultView {
  /** Thẻ phân loại của biến thể này. */
  card: "search";
  /** Dấu phân biệt biến thể danh sách đường dẫn. */
  shape: "paths";
  /** Tiêu đề thay thế cho lời gọi đã xong. Vắng là giữ tiêu đề trạng thái chờ. */
  title?: string;
  /** Các đường dẫn tìm được, theo thứ tự kết quả của tool (trang được giữ khi `truncated`). */
  paths: string[];
  /**
   * Tool có cắt kết quả tại chỗ hay không: `paths` chỉ mang trang được giữ, không phải mọi đường dẫn
   * mà lần tìm đã thấy. UI hiện dấu hiệu "đã cắt" để không trình bày một danh sách thiếu như đầy đủ.
   */
  truncated: boolean;
  /** Tổng số đường dẫn lần tìm đã thấy trước khi cắt (bằng `paths.length` khi không `truncated`). */
  total: number;
}

/**
 * Một lần tìm đã xong, render thành thẻ search — view thời-điểm-kết-quả mà một tool khám phá
 * (`grep`, `glob`) trả từ `presentResult`. Một view `card: 'search'` với hai biến thể phân biệt
 * bằng `shape`: các lần khớp nội dung nhóm theo tệp ({@link SearchMatchesResultView}) và một danh
 * sách đường dẫn phẳng ({@link SearchPathsResultView}). Cả hai mang tín hiệu `truncated`/`total` để
 * UI không bao giờ trình bày kết quả đã cắt như kết quả đầy đủ. View không mang văn bản kết quả: UI
 * không có thẻ search rơi về content `tool/result` thô. Không có bản tương ứng lúc gọi: một lời gọi
 * tìm kiếm vẫn là {@link GenericCallView} (`kind: 'search'`) vì trạng thái chờ chưa có lần khớp hay
 * đường dẫn nào để hiện — hình dạng có cấu trúc chỉ tồn tại sau `execute`.
 * Nhận: một trong hai biến thể `shape` ở trên.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export type SearchResultView = SearchMatchesResultView | SearchPathsResultView;

/**
 * Một lần đọc TỆP đã xong, render thành khung mã có số dòng (và tuỳ chọn tô sáng cú pháp) bởi UI đủ
 * năng lực. Do tool mà lời gọi đọc văn bản tệp đặt (ví dụ `read`); trạng thái chờ vẫn là
 * {@link GenericCallView} (`kind: 'read'`) vì một lời gọi chưa có nội dung cho tới khi `execute`
 * trả về. Các trường có cấu trúc `lines`/`path`/`lang`/`totalLines` không thể dựng lại chỉ từ văn
 * bản kết quả phía model, nên tool read chiếu chúng qua `output.presentationMeta` (được lưu cùng log
 * phiên) và `presentResult` thu hẹp metadata đó trở lại view này trên cả đường trực tiếp lẫn phát
 * lại. UI không có năng lực đọc rơi về `content` (văn bản phía model đã bóc phong bì), nên view này
 * suy giảm thành thẻ văn bản generic.
 * Nhận: `path`, `offset`, `lines`, `totalLines` bắt buộc cùng `title`/`lang`/`content` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface ReadResultView {
  /** Thẻ phân loại của biến thể này. */
  card: "read";
  /** Tiêu đề thay thế cho lời gọi đã xong. Vắng là giữ tiêu đề trạng thái chờ. */
  title?: string;
  /** Đường dẫn tệp đã đọc (đường dẫn phía model; cầu nối làm nó thành tương đối). */
  path: string;
  /**
   * Dòng đầu 1-based mà cửa sổ yêu cầu, được GIỮ kể cả khi `lines` rỗng (một trần byte dưới dòng
   * đầu được chọn cho cửa sổ rỗng) để UI biết cửa sổ bắt đầu ở đâu và lần đọc tiếp nối từ đâu.
   */
  offset: number;
  /** Các dòng của cửa sổ đã trả, theo thứ tự tệp, mỗi dòng giữ số dòng của chính tệp. */
  lines: ReadFileLine[];
  /** Tổng số dòng CHÍNH XÁC của tệp, để UI hiện được "đang hiện N trên M". */
  totalLines: number;
  /**
   * Gợi ý ngôn ngữ cho tô sáng cú pháp, suy từ phần mở rộng tệp (ví dụ `ts`, `py`); vắng khi phần mở
   * rộng không ánh xạ tới ngôn ngữ nào đã biết để UI render các dòng như văn bản thường.
   */
  lang?: string;
  /**
   * Content kết quả phía model đã bóc phong bì, cho UI không có năng lực đọc. Vắng là để UI như vậy
   * render content thô của kết quả.
   */
  content?: ContentBlock[];
}

/**
 * Một nguồn có thể trích dẫn trong một {@link WebSearchResultView} đã xong — phép chiếu trung thực
 * của một nguồn web-search. Đây là phép chiếu trình bày của `WebSearchSource` bên `dsh-web`: kiểu
 * của Service Definition đó là nguồn chuẩn (lõi không phụ thuộc được vào Service Definition của web,
 * nên hai bên khai riêng và PHẢI tiến hoá cùng nhau). Một tool web chiếu hình dạng này qua
 * `output.presentationMeta` vì văn bản render không mang được nó một cách vô tổn (xem Agent Note
 * web-result-card); `presentResult` của nó đọc lại.
 * Nhận: `url` bắt buộc cùng `title`/`snippet`/`publishedAt` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface WebSource {
  /** URL của nguồn. */
  url: string;
  /** Tiêu đề nguồn, khi nhà cung cấp có trả. */
  title?: string;
  /** Một đoạn trích hoặc tóm tắt ngắn, khi nhà cung cấp có trả. */
  snippet?: string;
  /** Dấu thời gian công bố/thu thập dạng chuỗi ISO-8601 do nhà cung cấp đưa, khi có. */
  publishedAt?: string;
}

/**
 * Một lần lấy dữ liệu web đã xong, render thành thẻ có cấu trúc bởi UI đủ năng lực. Do một tool web
 * mà lời gọi lấy từ web đặt (`web_search`, `web_fetch`). Một union có thẻ `kind` mang cả hai hình
 * dạng vì cả hai đều là lấy dữ liệu web và UI render chúng bằng một họ component; UI chuyển nhánh
 * theo `kind`. UI không đủ năng lực rơi về content `tool/result` thô (view này không có bản sao
 * `content` — xem Agent Note web-result-card). Đây là bản tương ứng ở thời điểm kết quả của các view
 * lời gọi generic của `web_search`/`web_fetch` (`kind: 'search'`/`'fetch'`); các tool đó giữ thẻ chờ
 * generic của mình và chỉ thêm thẻ hoàn tất này.
 *
 * Trường `kind` ở đây là dấu phân biệt của CHÍNH union này, KHÔNG phải một {@link ToolCallKind}: hai
 * giá trị cố ý trùng `ToolCallKind` lúc chờ của các tool (`'search'`/`'fetch'`) để một lời gọi và kết
 * quả của nó đọc như cùng một loại, nhưng một nhánh mới là một lần sửa union cộng một nhánh người
 * tiêu thụ, không phải một giá trị `ToolCallKind` tuỳ ý.
 * Nhận: một trong hai biến thể `kind` `search`/`fetch`.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export type WebResultView = WebSearchResultView | WebFetchResultView;

/**
 * Trạng thái hoàn tất của một lời gọi `web_search`: các nguồn có cấu trúc mà model đã trích dẫn, câu
 * trả lời tuỳ chọn của nhà cung cấp, và việc danh sách nguồn có bị cắt theo trần kết quả hay không.
 * UI đủ năng lực render các nguồn thành danh sách trích dẫn; UI không có năng lực `web` rơi về
 * content `tool/result` thô.
 * Nhận: `sources`, `truncated` bắt buộc cùng `title`/`answer` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface WebSearchResultView {
  /** Thẻ phân loại của biến thể này. */
  card: "web";
  /** Dấu phân biệt: đây là kết quả của `web_search`. */
  kind: "search";
  /** Tiêu đề thay thế cho lời gọi đã xong. Vắng là giữ tiêu đề trạng thái chờ. */
  title?: string;
  /** Các nguồn TRUNG THỰC, có cấu trúc — trường mà văn bản render không mang được vô tổn. */
  sources: WebSource[];
  /** Văn bản trả lời do nhà cung cấp sinh, khi có. */
  answer?: string;
  /** True khi service web đã cắt danh sách nguồn để giữ trần kết quả. */
  truncated: boolean;
}

/**
 * Trạng thái hoàn tất của một lời gọi `web_fetch`: URL đã lấy, trạng thái HTTP của nó, và việc nội
 * dung có bị cắt hay không. Thân nội dung đã là markdown trong content `tool/result` thô, nên thẻ này
 * chỉ mang bản tóm tắt lần lấy và một UI không có năng lực `web` rơi về content đó.
 * Nhận: `url`, `statusCode`, `truncated` bắt buộc cùng `title` tuỳ chọn.
 * Trả: hình dạng dữ liệu UI đọc; không có giá trị lúc chạy.
 */
export interface WebFetchResultView {
  /** Thẻ phân loại của biến thể này. */
  card: "web";
  /** Dấu phân biệt: đây là kết quả của `web_fetch`. */
  kind: "fetch";
  /** Tiêu đề thay thế cho lời gọi đã xong. Vắng là giữ tiêu đề trạng thái chờ. */
  title?: string;
  /** URL CUỐI sau các chuyển hướng được phép. */
  url: string;
  /** Mã trạng thái HTTP của phản hồi đã lấy. */
  statusCode: number;
  /**
   * True khi nhà cung cấp cắt thân đã giải mã, hoặc khi trần đầu ra hay một lần cắt từ nguồn trước
   * chuyển đổi đã tỉa văn bản đã render (mức cắt hiệu dụng mà văn bản phía model cũng phản ánh).
   */
  truncated: boolean;
}
