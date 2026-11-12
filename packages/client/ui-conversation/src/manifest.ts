/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Manifest ban bien dich ui-conversation: thu tu ghep cac phan + bang thay the CSS (do build.ts doc)
 */

/**
 * Thu tu ghep cac phan cua ban bien dich, dung NGUYEN VAN thu tu vung cua bundle goc.
 * ⚠️ MOI phan trong mang nay la NGUYEN VAN 100% ban goc — khong mot dong viet tay nao.
 * Cong chong cai hai lan + bang tieng Viet nam o HANDWRITTEN_PARTS (lat viet tay rieng).
 * Nhan: khong.
 * Tra: mang duong dan tuong doi so voi src/.
 */
export const PART_FILES: readonly string[] = [
  "parts/01-requires.ts",
  "parts/02-rolldown-runtime.ts",
  "parts/03-cosmokit-lib-index.ts",
  "parts/04-schemastery-lib-index.ts",
  "parts/05-values-lib-index.ts",
  "parts/06-client-contract-request-inspection.ts",
  "parts/07-lib-types-surface.ts",
  "parts/08-client-contract-system-prompt.ts",
  "parts/09-client-contract-conversation.ts",
  "parts/10-client-conversation-group-store.ts",
  "parts/11-client-conversation-location-index.ts",
  "parts/12-client-conversation-assembler.ts",
  "parts/13-client-conversation-definition-registry.ts",
  "parts/14-client-conversation-event-registry.ts",
  "parts/15-crypto-lib-index.ts",
  "parts/16-client-conversation-historical-images.ts",
  "parts/17-client-conversation-view-registry.ts",
  "parts/18-client-conversation-group-registry.ts",
  "parts/19-client-conversation-user-text-document.ts",
  "parts/20-client-conversation-user-text-registry.ts",
  "parts/21-client-conversation-assembly.ts",
  "parts/22-css-UserText.ts",
  "parts/23-client-user-text-UserText.ts",
  "parts/24-client-user-text-session-reference-rule.ts",
  "parts/25-client-user-text-whitespace-rules.ts",
  "parts/26-types-client-draft.ts",
  "parts/27-types-client-stores.ts",
  "parts/28-lib-types-grammar.ts",
  "parts/29-workspace-path-lib-index.ts",
  "parts/30-types-client-service.ts",
  "parts/31-client-input-blocks.ts",
  "parts/32-client-input-machine.ts",
  "parts/33-lexical-dist-Lexical-proda.ts",
  "parts/34-lexical-dist-Lexical-prodb.ts",
  "parts/35-lexical-dist-Lexical-prodc.ts",
  "parts/36-lexical-dist-Lexical-prodd.ts",
  "parts/37-lexical-dist-Lexical-prode.ts",
  "parts/38-lexical-dist-Lexical-prodf.ts",
  "parts/39-lexical-dist-Lexical-prodg.ts",
  "parts/40-lexical-dist-Lexical-prodh.ts",
  "parts/41-lexical-dist-Lexical-prodi.ts",
  "parts/42-lexical-dist-Lexical-prodj.ts",
  "parts/43-lexical-dist-Lexical-prodk.ts",
  "parts/44-lexical-dist-Lexical-prodl.ts",
  "parts/45-lexical-dist-Lexical-prodm.ts",
  "parts/46-selection-dist-LexicalSelection-prod.ts",
  "parts/47-extension-dist-LexicalExtension-prod.ts",
  "parts/48-html-dist-LexicalHtml-prod.ts",
  "parts/49-clipboard-dist-LexicalClipboard-prod.ts",
  "parts/50-plain-text-dist-LexicalPlainText-prod.ts",
  "parts/51-history-dist-LexicalHistory-prod.ts",
  "parts/52-clsx-dist-clsx.ts",
  "parts/53-css-ReferenceChip.ts",
  "parts/54-css-composer-editor.ts",
  "parts/55-input-editor-ReferenceChip.ts",
  "parts/56-input-editor-chip-node.ts",
  "parts/57-text-dist-LexicalText-prod.ts",
  "parts/58-client-input-decorations.ts",
  "parts/59-input-editor-text-ref.ts",
  "parts/60-input-editor-reference-activation.ts",
  "parts/61-input-editor-CommandChip.ts",
  "parts/62-input-editor-command-chip-node.ts",
  "parts/63-input-editor-command-chip-selection.ts",
  "parts/64-input-editor-span-map.ts",
  "parts/65-input-editor-runtime.ts",
  "parts/66-client-input-facade.ts",
  "parts/67-client-input-submission-analytics.ts",
  "parts/68-client-input-hub.ts",
  "parts/69-lib-types-submission-settings.ts",
  "parts/70-client-input-submission-policy.ts",
  "parts/71-types-client-locales.ts",
  "parts/72-css-QueueDock.ts",
  "parts/73-client-queue-QueueDock.ts",
  "parts/74-css-EnterBehaviorRow.ts",
  "parts/75-client-settings-EnterBehaviorRow.ts",
  "parts/76-client-contract-snapshot.ts",
  "parts/77-css-ConversationRoot.ts",
  "parts/78-client-skeleton-ConversationWidthControls.ts",
  "parts/79-client-skeleton-ConversationMainPanel.ts",
  "parts/80-client-skeleton-ConversationRoot.ts",
  "parts/81-css-HeroShell.ts",
  "parts/82-client-skeleton-EmptyHero.ts",
  "parts/83-client-skeleton-ConversationContent.ts",
  "parts/84-client-skeleton-ConversationPanel.ts",
  "parts/85-client-skeleton-ConversationHeader.ts",
  "parts/86-client-skeleton-DefaultConversationViews.ts",
  "parts/87-client-skeleton-ConversationSession.ts",
  "parts/88-input-editor-ComposerContentEditable.ts",
  "parts/89-input-editor-DecoratorPortals.ts",
  "parts/90-input-editor-DraftEditor.ts",
  "parts/91-input-editor-keymap.ts",
  "parts/92-input-editor-view-binding.ts",
  "parts/93-types-client-image-labels.ts",
  "parts/94-types-client-context-occupancy.ts",
  "parts/95-css-ContextMeter.ts",
  "parts/96-client-skeleton-ContextMeter.ts",
  "parts/97-client-skeleton-control-row-layout.ts",
  "parts/98-css-InputBar.ts",
  "parts/99-client-skeleton-InputBar.ts",
  "parts/100-css-TodoPanel.ts",
  "parts/101-client-skeleton-TodoPanel.ts",
  "parts/102-types-client-stop-sequence.ts",
  "parts/103-types-client-stop-shortcut.ts",
  "parts/104-types-client-apply.ts",
];

/**
 * Khong co dong exports nao o day: muoi lam dong `exports.*` cua ban goc nam trong lat cuoi
 * (parts/104-types-client-apply.ts) va van la NGUYEN VAN — chi dong tra module.exports duoc tach ra
 * CLIENT_TAIL_LINES de chen khoi viet tay truoc no.
 */
export const CLIENT_EXPORT_LINES: readonly string[] = [];

/**
 * Cac lat VIET TAY cua goi — moi thu KHONG co trong bundle goc nam o day, va chi o day.
 * Thu tu ghep: PART_FILES (nguyen van) → CLIENT_EXPORT_LINES → HANDWRITTEN_PARTS → CLIENT_TAIL_LINES.
 * Test parity doi chung bo dung van ban cac lat nay theo VI TRI MANIFEST (khong do chuoi noi dung)
 * de khang dinh phan con lai la NGUYEN VAN ban goc.
 */
export const HANDWRITTEN_PARTS: readonly string[] = [
  "parts/plugin-surface.ts",
];

/**
 * Dong cuoi cung cua than bundle goc — NGUYEN VAN, dat SAU khoi viet tay.
 * Factory tra ve dung the module ma ban goc tra ve.
 */
export const CLIENT_TAIL_LINES: readonly string[] = [
  "\t\treturn module.exports;",
];

/** Mot cho thay the CSS trong ban bien dich. */
export interface CssReplacement {
  /** Dinh danh xuat hien trong phan ma (build.ts thay bang chuoi CSS da ma hoa). */
  placeholder: string;
  /** Duong dan file .module.css tuong doi so voi src/ — nguon su that cua CSS. */
  file: string;
}

/**
 * Bang thay the CSS: moi dinh danh trong phan ma ung voi dung mot file .module.css.
 * Nhan: khong.
 * Tra: mang cac cap dinh danh ↔ file CSS, theo thu tu xuat hien.
 */
export const CSS_REPLACEMENTS: readonly CssReplacement[] = [
  { placeholder: "__GBH_UI_CONVERSATION_CSS_UserText__", file: "styles/UserText.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_ReferenceChip__", file: "styles/ReferenceChip.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_composer_editor__", file: "styles/composer-editor.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_QueueDock__", file: "styles/QueueDock.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_EnterBehaviorRow__", file: "styles/EnterBehaviorRow.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_ConversationRoot__", file: "styles/ConversationRoot.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_HeroShell__", file: "styles/HeroShell.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_ContextMeter__", file: "styles/ContextMeter.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_InputBar__", file: "styles/InputBar.module.css" },
  { placeholder: "__GBH_UI_CONVERSATION_CSS_TodoPanel__", file: "styles/TodoPanel.module.css" },
];
