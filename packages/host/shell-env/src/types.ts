/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu của gói shell-env: vật khai báo biến DSH_* mà plugin khác đăng ký, bản ghi liệt kê
 *      được, cấu hình, và LÁT CẮT của lượt thi hành tool mà sổ đăng ký thật sự đọc.
 */

/**
 * Mô tả một biến môi trường DSH_* do sổ đăng ký quản lý — phần mà model nhìn thấy.
 * Bản gốc dùng cùng hình dạng này (BashEnvVariable của @deepseek-ai/dsh-shell-env).
 */
export interface BashEnvVariable {
  /** Mô tả ngắn gọn sự thật môi trường mà biến đại diện. */
  description: string;
}

/**
 * Một đóng góp của plugin vào môi trường quản lý của MỖI lời gọi shell.
 * Khai trước tập khoá làm xung đột quyền sở hữu bị phát hiện TRƯỚC lệnh đầu tiên;
 * resolve chỉ tính những giá trị có được ở lượt thi hành hiện tại.
 */
export interface BashEnvContributor {
  /** Tên ổn định dùng trong chẩn đoán và phát hiện trùng. */
  name: string;
  /** Tập ĐẦY ĐỦ các khoá DSH_* mà đóng góp này có thể trả. */
  variables: Readonly<Record<string, BashEnvVariable>>;
  /**
   * Tính các giá trị khả dụng của đóng góp này cho một lượt thi hành tool.
   * Nhận: lượt thi hành shell (kèm agent gọi, nếu có).
   * Trả: bản đồ một phần chỉ chứa các khoá đã khai trong variables.
   */
  resolve(execution: ShellEnvExecution): Readonly<Partial<Record<string, string>>>;
}

/** Một khai báo liệt kê được mà ShellEnvRegistry.list trả về. */
export interface BashEnvVariableInfo extends BashEnvVariable {
  /** Đóng góp sở hữu biến. */
  contributor: string;
  /** Tên biến môi trường DSH_* đã khai. */
  key: string;
}

/**
 * Lát cắt của một lượt thi hành tool mà sổ đăng ký ĐỌC — chỉ agent.session.header.id.
 * Khai theo CẤU TRÚC để không phải kéo @deepseek-ai/dsh-tools thành peer: mọi ToolExecution
 * thật của kernel đều thoả hình dạng này, nên bên gọi không phải đổi gì.
 */
export interface ShellEnvExecution {
  /** Agent đang gọi tool; vắng mặt ở lời gọi không thuộc phiên nào. */
  readonly agent?: {
    /** Phiên của agent — nguồn của DSH_SESSION_ID. */
    readonly session: {
      /** Đầu mục phiên, nơi id phiên nằm. */
      readonly header: {
        /** Id phiên do kernel cấp. */
        readonly id: string;
      };
    };
  };
}
