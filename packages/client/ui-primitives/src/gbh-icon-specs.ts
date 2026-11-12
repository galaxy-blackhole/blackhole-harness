/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang dac ta icon GBH: 189 icon + 12 entry ho tong hop (reference/permission), moi muc la mot entry cua GbhIcon (C7 P2)
 */

import type { GbhIconSpec } from "./artwork-types.ts";

/** Khoa icon GBH: kebab-case cua ten DSH, giu hau to -regular/-medium (C7 P2 — doi bo icon o MOT cho). */
export type GbhIconName =
  | "gbh:agent-preset-outline-medium"
  | "gbh:agent-preset-outline-regular"
  | "gbh:alarm-clock-outline-medium"
  | "gbh:alarm-clock-outline-regular"
  | "gbh:api-outline-medium"
  | "gbh:api-outline-regular"
  | "gbh:archive-check-outline-medium"
  | "gbh:archive-check-outline-regular"
  | "gbh:archive-off-outline-medium"
  | "gbh:archive-off-outline-regular"
  | "gbh:archive-outline-medium"
  | "gbh:archive-outline-regular"
  | "gbh:branch-outline-medium"
  | "gbh:branch-outline-regular"
  | "gbh:browse-outline-medium"
  | "gbh:browse-outline-regular"
  | "gbh:check-circle-fill-medium"
  | "gbh:check-circle-fill-regular"
  | "gbh:check-circle-outline-medium"
  | "gbh:check-circle-outline-regular"
  | "gbh:check-outline-medium"
  | "gbh:check-outline-regular"
  | "gbh:checklist-outline-medium"
  | "gbh:checklist-outline-regular"
  | "gbh:chevron-down-outline-medium"
  | "gbh:chevron-down-outline-regular"
  | "gbh:chevron-left-outline-medium"
  | "gbh:chevron-left-outline-regular"
  | "gbh:chevron-right-outline-medium"
  | "gbh:chevron-right-outline-regular"
  | "gbh:chevron-up-outline-medium"
  | "gbh:chevron-up-outline-regular"
  | "gbh:chevrons-up-down-outline-medium"
  | "gbh:chevrons-up-down-outline-regular"
  | "gbh:clock-outline-medium"
  | "gbh:clock-outline-regular"
  | "gbh:close-circle-fill-medium"
  | "gbh:close-circle-fill-regular"
  | "gbh:close-fill-medium"
  | "gbh:close-fill-regular"
  | "gbh:close-outline-medium"
  | "gbh:close-outline-regular"
  | "gbh:code-outline-medium"
  | "gbh:code-outline-regular"
  | "gbh:compact-outline-medium"
  | "gbh:compact-outline-regular"
  | "gbh:compare-split-outline-medium"
  | "gbh:compare-split-outline-regular"
  | "gbh:context-injection-outline-medium"
  | "gbh:context-injection-outline-regular"
  | "gbh:copy-outline-medium"
  | "gbh:copy-outline-regular"
  | "gbh:cordis-plugin-outline-medium"
  | "gbh:cordis-plugin-outline-regular"
  | "gbh:dark-outline-medium"
  | "gbh:dark-outline-regular"
  | "gbh:data-outline-medium"
  | "gbh:data-outline-regular"
  | "gbh:database-outline-medium"
  | "gbh:database-outline-regular"
  | "gbh:deliver-doc-medium"
  | "gbh:deliver-doc-regular"
  | "gbh:dislike-fill-medium"
  | "gbh:dislike-fill-regular"
  | "gbh:dislike-outline-medium"
  | "gbh:dislike-outline-regular"
  | "gbh:download-outline-medium"
  | "gbh:download-outline-regular"
  | "gbh:edit-outline-medium"
  | "gbh:edit-outline-regular"
  | "gbh:ellipsis-outline-medium"
  | "gbh:ellipsis-outline-regular"
  | "gbh:enhance-outline-medium"
  | "gbh:enhance-outline-regular"
  | "gbh:flat-list-outline-medium"
  | "gbh:flat-list-outline-regular"
  | "gbh:folder-close-medium"
  | "gbh:folder-close-regular"
  | "gbh:folder-open-medium"
  | "gbh:folder-open-outline-medium"
  | "gbh:folder-open-outline-regular"
  | "gbh:folder-open-regular"
  | "gbh:followsystem-outline-medium"
  | "gbh:followsystem-outline-regular"
  | "gbh:fullscreen-outline-medium"
  | "gbh:fullscreen-outline-regular"
  | "gbh:gauge-outline-medium"
  | "gbh:gauge-outline-regular"
  | "gbh:globe-outline-medium"
  | "gbh:globe-outline-regular"
  | "gbh:goal-outline-medium"
  | "gbh:goal-outline-regular"
  | "gbh:info-outline-medium"
  | "gbh:info-outline-regular"
  | "gbh:inspect-outline-medium"
  | "gbh:inspect-outline-regular"
  | "gbh:light-outline-medium"
  | "gbh:light-outline-regular"
  | "gbh:like-fill-medium"
  | "gbh:like-fill-regular"
  | "gbh:like-outline-medium"
  | "gbh:like-outline-regular"
  | "gbh:link-outline-medium"
  | "gbh:link-outline-regular"
  | "gbh:list-pen-outline-medium"
  | "gbh:list-pen-outline-regular"
  | "gbh:loading-outline-medium"
  | "gbh:loading-outline-regular"
  | "gbh:microphone-outline-medium"
  | "gbh:microphone-outline-regular"
  | "gbh:new-chat-outline-medium"
  | "gbh:new-chat-outline-regular"
  | "gbh:nowrap-fill-medium"
  | "gbh:nowrap-fill-regular"
  | "gbh:panel-left-outline-medium"
  | "gbh:panel-left-outline-regular"
  | "gbh:paper-plane-outline-medium"
  | "gbh:paper-plane-outline-regular"
  | "gbh:paperclip-outline-medium"
  | "gbh:paperclip-outline-regular"
  | "gbh:pause-outline-medium"
  | "gbh:pause-outline-regular"
  | "gbh:personalization-outline-medium"
  | "gbh:personalization-outline-regular"
  | "gbh:pin-fill-medium"
  | "gbh:pin-fill-regular"
  | "gbh:pin-outline-medium"
  | "gbh:pin-outline-regular"
  | "gbh:plan-outline-artwork"
  | "gbh:plan-outline-medium"
  | "gbh:plan-outline-regular"
  | "gbh:play-outline-medium"
  | "gbh:play-outline-regular"
  | "gbh:plugin-pinwheel-outline-medium"
  | "gbh:plugin-pinwheel-outline-regular"
  | "gbh:plus-outline-medium"
  | "gbh:plus-outline-regular"
  | "gbh:project-add-outline-medium"
  | "gbh:project-add-outline-regular"
  | "gbh:question-outline-medium"
  | "gbh:question-outline-regular"
  | "gbh:queue-outline-medium"
  | "gbh:queue-outline-regular"
  | "gbh:refresh-outline-medium"
  | "gbh:refresh-outline-regular"
  | "gbh:right-up-outline-medium"
  | "gbh:right-up-outline-regular"
  | "gbh:search-outline-medium"
  | "gbh:search-outline-regular"
  | "gbh:send-outline-medium"
  | "gbh:send-outline-regular"
  | "gbh:settings-outline-medium"
  | "gbh:settings-outline-regular"
  | "gbh:share-outline-medium"
  | "gbh:share-outline-regular"
  | "gbh:shield-outline-medium"
  | "gbh:shield-outline-regular"
  | "gbh:skill-outline-medium"
  | "gbh:skill-outline-regular"
  | "gbh:sliders-two-outline-medium"
  | "gbh:sliders-two-outline-regular"
  | "gbh:sparkle-medium"
  | "gbh:sparkle-regular"
  | "gbh:stop-fill-medium"
  | "gbh:stop-fill-regular"
  | "gbh:think-outline-medium"
  | "gbh:think-outline-regular"
  | "gbh:trash-outline-medium"
  | "gbh:trash-outline-regular"
  | "gbh:tree-corner-medium"
  | "gbh:tree-corner-regular"
  | "gbh:triangle-right-fill-medium"
  | "gbh:triangle-right-fill-regular"
  | "gbh:unarchive-outline-medium"
  | "gbh:unarchive-outline-regular"
  | "gbh:user-outline-medium"
  | "gbh:user-outline-regular"
  | "gbh:users-outline-medium"
  | "gbh:users-outline-regular"
  | "gbh:warning-outline-medium"
  | "gbh:warning-outline-regular"
  | "gbh:warning-triangle-outline-medium"
  | "gbh:warning-triangle-outline-regular"
  | "gbh:workspace-tree-outline-medium"
  | "gbh:workspace-tree-outline-regular"
  | "gbh:wrap-fill-medium"
  | "gbh:wrap-fill-regular"
  | "gbh:wrap-lines-outline-medium"
  | "gbh:wrap-lines-outline-regular"
  | "gbh:reference-session-regular"
  | "gbh:reference-session-medium"
  | "gbh:reference-file-regular"
  | "gbh:reference-file-medium"
  | "gbh:reference-folder-regular"
  | "gbh:reference-folder-medium"
  | "gbh:permission-read-only-regular"
  | "gbh:permission-read-only-medium"
  | "gbh:permission-workspace-write-regular"
  | "gbh:permission-workspace-write-medium"
  | "gbh:permission-full-access-regular"
  | "gbh:permission-full-access-medium";

/** Bang dac ta: ten GBH -> artwork + do dam net + kich thuoc mac dinh. */
export const GBH_ICONS: Record<string, GbhIconSpec> = {
  "gbh:agent-preset-outline-medium": { artwork: "IconAgentPresetOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:agent-preset-outline-regular": { artwork: "IconAgentPresetOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:alarm-clock-outline-medium": { artwork: "IconAlarmClockOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:alarm-clock-outline-regular": { artwork: "IconAlarmClockOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:api-outline-medium": { artwork: "IconApiOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:api-outline-regular": { artwork: "IconApiOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:archive-check-outline-medium": { artwork: "IconArchiveCheckOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:archive-check-outline-regular": { artwork: "IconArchiveCheckOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:archive-off-outline-medium": { artwork: "IconArchiveOffOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:archive-off-outline-regular": { artwork: "IconArchiveOffOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:archive-outline-medium": { artwork: "IconArchiveOutlineArtwork", size: 20, strokeWidth: 1.3 },
  "gbh:archive-outline-regular": { artwork: "IconArchiveOutlineArtwork", size: 20, strokeWidth: 1 },
  "gbh:branch-outline-medium": { artwork: "IconBranchOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:branch-outline-regular": { artwork: "IconBranchOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:browse-outline-medium": { artwork: "BrowseOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:browse-outline-regular": { artwork: "BrowseOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:check-circle-fill-medium": { artwork: "IconCheckCircleFillArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:check-circle-fill-regular": { artwork: "IconCheckCircleFillArtwork", size: 16, strokeWidth: 1 },
  "gbh:check-circle-outline-medium": { artwork: "IconCheckCircleOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:check-circle-outline-regular": { artwork: "IconCheckCircleOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:check-outline-medium": { artwork: "IconCheckOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:check-outline-regular": { artwork: "IconCheckOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:checklist-outline-medium": { artwork: "IconChecklistOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:checklist-outline-regular": { artwork: "IconChecklistOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:chevron-down-outline-medium": { artwork: "IconChevronDownOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:chevron-down-outline-regular": { artwork: "IconChevronDownOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:chevron-left-outline-medium": { artwork: "IconChevronLeftOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:chevron-left-outline-regular": { artwork: "IconChevronLeftOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:chevron-right-outline-medium": { artwork: "IconChevronRightOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:chevron-right-outline-regular": { artwork: "IconChevronRightOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:chevron-up-outline-medium": { artwork: "IconChevronUpOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:chevron-up-outline-regular": { artwork: "IconChevronUpOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:chevrons-up-down-outline-medium": { artwork: "IconChevronsUpDownOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:chevrons-up-down-outline-regular": { artwork: "IconChevronsUpDownOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:clock-outline-medium": { artwork: "IconClockOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:clock-outline-regular": { artwork: "IconClockOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:close-circle-fill-medium": { artwork: "IconCloseCircleFillArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:close-circle-fill-regular": { artwork: "IconCloseCircleFillArtwork", size: 16, strokeWidth: 1 },
  "gbh:close-fill-medium": { artwork: "IconCloseFillArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:close-fill-regular": { artwork: "IconCloseFillArtwork", size: 14, strokeWidth: 1 },
  "gbh:close-outline-medium": { artwork: "IconCloseOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:close-outline-regular": { artwork: "IconCloseOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:code-outline-medium": { artwork: "IconCodeOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:code-outline-regular": { artwork: "IconCodeOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:compact-outline-medium": { artwork: "IconCompactOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:compact-outline-regular": { artwork: "IconCompactOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:compare-split-outline-medium": { artwork: "IconCompareSplitOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:compare-split-outline-regular": { artwork: "IconCompareSplitOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:context-injection-outline-medium": { artwork: "IconContextInjectionOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:context-injection-outline-regular": { artwork: "IconContextInjectionOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:copy-outline-medium": { artwork: "IconCopyOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:copy-outline-regular": { artwork: "IconCopyOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:cordis-plugin-outline-medium": { artwork: "IconCordisPluginOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:cordis-plugin-outline-regular": { artwork: "IconCordisPluginOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:dark-outline-medium": { artwork: "IconDarkOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:dark-outline-regular": { artwork: "IconDarkOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:data-outline-medium": { artwork: "IconDataOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:data-outline-regular": { artwork: "IconDataOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:database-outline-medium": { artwork: "IconDatabaseOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:database-outline-regular": { artwork: "IconDatabaseOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:deliver-doc-medium": { artwork: "IconDeliverDocArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:deliver-doc-regular": { artwork: "IconDeliverDocArtwork", size: 16, strokeWidth: 1 },
  "gbh:dislike-fill-medium": { artwork: "IconDislikeFillArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:dislike-fill-regular": { artwork: "IconDislikeFillArtwork", size: 16, strokeWidth: 1 },
  "gbh:dislike-outline-medium": { artwork: "IconDislikeOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:dislike-outline-regular": { artwork: "IconDislikeOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:download-outline-medium": { artwork: "IconDownloadOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:download-outline-regular": { artwork: "IconDownloadOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:edit-outline-medium": { artwork: "IconEditOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:edit-outline-regular": { artwork: "IconEditOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:ellipsis-outline-medium": { artwork: "IconEllipsisOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:ellipsis-outline-regular": { artwork: "IconEllipsisOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:enhance-outline-medium": { artwork: "IconEnhanceOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:enhance-outline-regular": { artwork: "IconEnhanceOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:flat-list-outline-medium": { artwork: "IconFlatListOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:flat-list-outline-regular": { artwork: "IconFlatListOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:folder-close-medium": { artwork: "FolderCloseArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:folder-close-regular": { artwork: "FolderCloseArtwork", size: 16, strokeWidth: 1 },
  "gbh:folder-open-medium": { artwork: "IconFolderOpenArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:folder-open-outline-medium": { artwork: "IconFolderOpenOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:folder-open-outline-regular": { artwork: "IconFolderOpenOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:folder-open-regular": { artwork: "IconFolderOpenArtwork", size: 16, strokeWidth: 1 },
  "gbh:followsystem-outline-medium": { artwork: "IconFollowsystemOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:followsystem-outline-regular": { artwork: "IconFollowsystemOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:fullscreen-outline-medium": { artwork: "IconFullscreenOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:fullscreen-outline-regular": { artwork: "IconFullscreenOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:gauge-outline-medium": { artwork: "IconGaugeOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:gauge-outline-regular": { artwork: "IconGaugeOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:globe-outline-medium": { artwork: "GlobeOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:globe-outline-regular": { artwork: "GlobeOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:goal-outline-medium": { artwork: "IconGoalOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:goal-outline-regular": { artwork: "IconGoalOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:info-outline-medium": { artwork: "IconInfoOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:info-outline-regular": { artwork: "IconInfoOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:inspect-outline-medium": { artwork: "CodeBracketsArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:inspect-outline-regular": { artwork: "CodeBracketsArtwork", size: 14, strokeWidth: 1 },
  "gbh:light-outline-medium": { artwork: "IconLightOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:light-outline-regular": { artwork: "IconLightOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:like-fill-medium": { artwork: "IconLikeFillArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:like-fill-regular": { artwork: "IconLikeFillArtwork", size: 16, strokeWidth: 1 },
  "gbh:like-outline-medium": { artwork: "IconLikeOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:like-outline-regular": { artwork: "IconLikeOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:link-outline-medium": { artwork: "IconLinkOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:link-outline-regular": { artwork: "IconLinkOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:list-pen-outline-medium": { artwork: "IconListPenOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:list-pen-outline-regular": { artwork: "IconListPenOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:loading-outline-medium": { artwork: "IconLoadingOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:loading-outline-regular": { artwork: "IconLoadingOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:microphone-outline-medium": { artwork: "IconMicrophoneOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:microphone-outline-regular": { artwork: "IconMicrophoneOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:new-chat-outline-medium": { artwork: "NewChatOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:new-chat-outline-regular": { artwork: "NewChatOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:nowrap-fill-medium": { artwork: "IconNowrapFillArtwork", size: 16 },
  "gbh:nowrap-fill-regular": { artwork: "IconNowrapFillArtwork", size: 16 },
  "gbh:panel-left-outline-medium": { artwork: "IconPanelLeftOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:panel-left-outline-regular": { artwork: "IconPanelLeftOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:paper-plane-outline-medium": { artwork: "IconPaperPlaneOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:paper-plane-outline-regular": { artwork: "IconPaperPlaneOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:paperclip-outline-medium": { artwork: "IconPaperclipOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:paperclip-outline-regular": { artwork: "IconPaperclipOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:pause-outline-medium": { artwork: "IconPauseOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:pause-outline-regular": { artwork: "IconPauseOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:personalization-outline-medium": { artwork: "IconPersonalizationOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:personalization-outline-regular": { artwork: "IconPersonalizationOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:pin-fill-medium": { artwork: "IconPinFillArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:pin-fill-regular": { artwork: "IconPinFillArtwork", size: 16, strokeWidth: 1 },
  "gbh:pin-outline-medium": { artwork: "IconPinOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:pin-outline-regular": { artwork: "IconPinOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:plan-outline-artwork": { artwork: "IconListPenOutlineArtwork", size: 16 },
  "gbh:plan-outline-medium": { artwork: "IconPlanOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:plan-outline-regular": { artwork: "IconPlanOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:play-outline-medium": { artwork: "IconPlayOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:play-outline-regular": { artwork: "IconPlayOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:plugin-pinwheel-outline-medium": { artwork: "IconPluginPinwheelOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:plugin-pinwheel-outline-regular": { artwork: "IconPluginPinwheelOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:plus-outline-medium": { artwork: "IconPlusOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:plus-outline-regular": { artwork: "IconPlusOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:project-add-outline-medium": { artwork: "IconProjectAddOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:project-add-outline-regular": { artwork: "IconProjectAddOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:question-outline-medium": { artwork: "IconQuestionOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:question-outline-regular": { artwork: "IconQuestionOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:queue-outline-medium": { artwork: "IconQueueOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:queue-outline-regular": { artwork: "IconQueueOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:refresh-outline-medium": { artwork: "IconRefreshOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:refresh-outline-regular": { artwork: "IconRefreshOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:right-up-outline-medium": { artwork: "IconRightUpOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:right-up-outline-regular": { artwork: "IconRightUpOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:search-outline-medium": { artwork: "IconSearchOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:search-outline-regular": { artwork: "IconSearchOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:send-outline-medium": { artwork: "IconSendOutlineArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:send-outline-regular": { artwork: "IconSendOutlineArtwork", size: 14, strokeWidth: 1 },
  "gbh:settings-outline-medium": { artwork: "IconSettingsOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:settings-outline-regular": { artwork: "IconSettingsOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:share-outline-medium": { artwork: "IconShareOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:share-outline-regular": { artwork: "IconShareOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:shield-outline-medium": { artwork: "IconShieldOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:shield-outline-regular": { artwork: "IconShieldOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:skill-outline-medium": { artwork: "IconSkillOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:skill-outline-regular": { artwork: "IconSkillOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:sliders-two-outline-medium": { artwork: "IconSlidersTwoOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:sliders-two-outline-regular": { artwork: "IconSlidersTwoOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:sparkle-medium": { artwork: "IconSparkleArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:sparkle-regular": { artwork: "IconSparkleArtwork", size: 16, strokeWidth: 1 },
  "gbh:stop-fill-medium": { artwork: "IconStopFillArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:stop-fill-regular": { artwork: "IconStopFillArtwork", size: 16, strokeWidth: 1 },
  "gbh:think-outline-medium": { artwork: "IconThinkOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:think-outline-regular": { artwork: "IconThinkOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:trash-outline-medium": { artwork: "IconTrashOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:trash-outline-regular": { artwork: "IconTrashOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:tree-corner-medium": { artwork: "IconTreeCornerArtwork", size: 10, strokeWidth: 1.3 },
  "gbh:tree-corner-regular": { artwork: "IconTreeCornerArtwork", size: 10, strokeWidth: 1 },
  "gbh:triangle-right-fill-medium": { artwork: "IconTriangleRightFillArtwork", size: 14, strokeWidth: 1.3 },
  "gbh:triangle-right-fill-regular": { artwork: "IconTriangleRightFillArtwork", size: 14, strokeWidth: 1 },
  "gbh:unarchive-outline-medium": { artwork: "IconUnarchiveOutlineArtwork", size: 20, strokeWidth: 1.3 },
  "gbh:unarchive-outline-regular": { artwork: "IconUnarchiveOutlineArtwork", size: 20, strokeWidth: 1 },
  "gbh:user-outline-medium": { artwork: "IconUserOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:user-outline-regular": { artwork: "IconUserOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:users-outline-medium": { artwork: "IconUsersOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:users-outline-regular": { artwork: "IconUsersOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:warning-outline-medium": { artwork: "IconWarningOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:warning-outline-regular": { artwork: "IconWarningOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:warning-triangle-outline-medium": { artwork: "IconWarningTriangleOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:warning-triangle-outline-regular": { artwork: "IconWarningTriangleOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:workspace-tree-outline-medium": { artwork: "IconWorkspaceTreeOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:workspace-tree-outline-regular": { artwork: "IconWorkspaceTreeOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:wrap-fill-medium": { artwork: "IconWrapFillArtwork", size: 16 },
  "gbh:wrap-fill-regular": { artwork: "IconWrapFillArtwork", size: 16 },
  "gbh:wrap-lines-outline-medium": { artwork: "IconWrapLinesOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:wrap-lines-outline-regular": { artwork: "IconWrapLinesOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:reference-session-regular": { artwork: "ChatLinesOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:reference-session-medium": { artwork: "ChatLinesOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:reference-file-regular": { artwork: "BrowseOutlineArtwork", size: 16, strokeWidth: 1 },
  "gbh:reference-file-medium": { artwork: "BrowseOutlineArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:reference-folder-regular": { artwork: "FolderCloseArtwork", size: 16, strokeWidth: 1 },
  "gbh:reference-folder-medium": { artwork: "FolderCloseArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:permission-read-only-regular": { artwork: "ReadOnlyArtwork", size: 16, strokeWidth: 1 },
  "gbh:permission-read-only-medium": { artwork: "ReadOnlyArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:permission-workspace-write-regular": { artwork: "WorkspaceWriteArtwork", size: 16, strokeWidth: 1 },
  "gbh:permission-workspace-write-medium": { artwork: "WorkspaceWriteArtwork", size: 16, strokeWidth: 1.3 },
  "gbh:permission-full-access-regular": { artwork: "FullAccessArtwork", size: 16, strokeWidth: 1 },
  "gbh:permission-full-access-medium": { artwork: "FullAccessArtwork", size: 16, strokeWidth: 1.3 },
};

/** Bang tra ten CU cua DSH -> ten GBH cho 189 icon 1-1 (doi 53 goi bang mot phep tra). */
export const DSH_TO_GBH_ICON: Record<string, string> = {
  "IconAgentPresetOutlineMedium": "gbh:agent-preset-outline-medium",
  "IconAgentPresetOutlineRegular": "gbh:agent-preset-outline-regular",
  "IconAlarmClockOutlineMedium": "gbh:alarm-clock-outline-medium",
  "IconAlarmClockOutlineRegular": "gbh:alarm-clock-outline-regular",
  "IconApiOutlineMedium": "gbh:api-outline-medium",
  "IconApiOutlineRegular": "gbh:api-outline-regular",
  "IconArchiveCheckOutlineMedium": "gbh:archive-check-outline-medium",
  "IconArchiveCheckOutlineRegular": "gbh:archive-check-outline-regular",
  "IconArchiveOffOutlineMedium": "gbh:archive-off-outline-medium",
  "IconArchiveOffOutlineRegular": "gbh:archive-off-outline-regular",
  "IconArchiveOutlineMedium": "gbh:archive-outline-medium",
  "IconArchiveOutlineRegular": "gbh:archive-outline-regular",
  "IconBranchOutlineMedium": "gbh:branch-outline-medium",
  "IconBranchOutlineRegular": "gbh:branch-outline-regular",
  "IconBrowseOutlineMedium": "gbh:browse-outline-medium",
  "IconBrowseOutlineRegular": "gbh:browse-outline-regular",
  "IconCheckCircleFillMedium": "gbh:check-circle-fill-medium",
  "IconCheckCircleFillRegular": "gbh:check-circle-fill-regular",
  "IconCheckCircleOutlineMedium": "gbh:check-circle-outline-medium",
  "IconCheckCircleOutlineRegular": "gbh:check-circle-outline-regular",
  "IconCheckOutlineMedium": "gbh:check-outline-medium",
  "IconCheckOutlineRegular": "gbh:check-outline-regular",
  "IconChecklistOutlineMedium": "gbh:checklist-outline-medium",
  "IconChecklistOutlineRegular": "gbh:checklist-outline-regular",
  "IconChevronDownOutlineMedium": "gbh:chevron-down-outline-medium",
  "IconChevronDownOutlineRegular": "gbh:chevron-down-outline-regular",
  "IconChevronLeftOutlineMedium": "gbh:chevron-left-outline-medium",
  "IconChevronLeftOutlineRegular": "gbh:chevron-left-outline-regular",
  "IconChevronRightOutlineMedium": "gbh:chevron-right-outline-medium",
  "IconChevronRightOutlineRegular": "gbh:chevron-right-outline-regular",
  "IconChevronUpOutlineMedium": "gbh:chevron-up-outline-medium",
  "IconChevronUpOutlineRegular": "gbh:chevron-up-outline-regular",
  "IconChevronsUpDownOutlineMedium": "gbh:chevrons-up-down-outline-medium",
  "IconChevronsUpDownOutlineRegular": "gbh:chevrons-up-down-outline-regular",
  "IconClockOutlineMedium": "gbh:clock-outline-medium",
  "IconClockOutlineRegular": "gbh:clock-outline-regular",
  "IconCloseCircleFillMedium": "gbh:close-circle-fill-medium",
  "IconCloseCircleFillRegular": "gbh:close-circle-fill-regular",
  "IconCloseFillMedium": "gbh:close-fill-medium",
  "IconCloseFillRegular": "gbh:close-fill-regular",
  "IconCloseOutlineMedium": "gbh:close-outline-medium",
  "IconCloseOutlineRegular": "gbh:close-outline-regular",
  "IconCodeOutlineMedium": "gbh:code-outline-medium",
  "IconCodeOutlineRegular": "gbh:code-outline-regular",
  "IconCompactOutlineMedium": "gbh:compact-outline-medium",
  "IconCompactOutlineRegular": "gbh:compact-outline-regular",
  "IconCompareSplitOutlineMedium": "gbh:compare-split-outline-medium",
  "IconCompareSplitOutlineRegular": "gbh:compare-split-outline-regular",
  "IconContextInjectionOutlineMedium": "gbh:context-injection-outline-medium",
  "IconContextInjectionOutlineRegular": "gbh:context-injection-outline-regular",
  "IconCopyOutlineMedium": "gbh:copy-outline-medium",
  "IconCopyOutlineRegular": "gbh:copy-outline-regular",
  "IconCordisPluginOutlineMedium": "gbh:cordis-plugin-outline-medium",
  "IconCordisPluginOutlineRegular": "gbh:cordis-plugin-outline-regular",
  "IconDarkOutlineMedium": "gbh:dark-outline-medium",
  "IconDarkOutlineRegular": "gbh:dark-outline-regular",
  "IconDataOutlineMedium": "gbh:data-outline-medium",
  "IconDataOutlineRegular": "gbh:data-outline-regular",
  "IconDatabaseOutlineMedium": "gbh:database-outline-medium",
  "IconDatabaseOutlineRegular": "gbh:database-outline-regular",
  "IconDeliverDocMedium": "gbh:deliver-doc-medium",
  "IconDeliverDocRegular": "gbh:deliver-doc-regular",
  "IconDislikeFillMedium": "gbh:dislike-fill-medium",
  "IconDislikeFillRegular": "gbh:dislike-fill-regular",
  "IconDislikeOutlineMedium": "gbh:dislike-outline-medium",
  "IconDislikeOutlineRegular": "gbh:dislike-outline-regular",
  "IconDownloadOutlineMedium": "gbh:download-outline-medium",
  "IconDownloadOutlineRegular": "gbh:download-outline-regular",
  "IconEditOutlineMedium": "gbh:edit-outline-medium",
  "IconEditOutlineRegular": "gbh:edit-outline-regular",
  "IconEllipsisOutlineMedium": "gbh:ellipsis-outline-medium",
  "IconEllipsisOutlineRegular": "gbh:ellipsis-outline-regular",
  "IconEnhanceOutlineMedium": "gbh:enhance-outline-medium",
  "IconEnhanceOutlineRegular": "gbh:enhance-outline-regular",
  "IconFlatListOutlineMedium": "gbh:flat-list-outline-medium",
  "IconFlatListOutlineRegular": "gbh:flat-list-outline-regular",
  "IconFolderCloseMedium": "gbh:folder-close-medium",
  "IconFolderCloseRegular": "gbh:folder-close-regular",
  "IconFolderOpenMedium": "gbh:folder-open-medium",
  "IconFolderOpenOutlineMedium": "gbh:folder-open-outline-medium",
  "IconFolderOpenOutlineRegular": "gbh:folder-open-outline-regular",
  "IconFolderOpenRegular": "gbh:folder-open-regular",
  "IconFollowsystemOutlineMedium": "gbh:followsystem-outline-medium",
  "IconFollowsystemOutlineRegular": "gbh:followsystem-outline-regular",
  "IconFullscreenOutlineMedium": "gbh:fullscreen-outline-medium",
  "IconFullscreenOutlineRegular": "gbh:fullscreen-outline-regular",
  "IconGaugeOutlineMedium": "gbh:gauge-outline-medium",
  "IconGaugeOutlineRegular": "gbh:gauge-outline-regular",
  "IconGlobeOutlineMedium": "gbh:globe-outline-medium",
  "IconGlobeOutlineRegular": "gbh:globe-outline-regular",
  "IconGoalOutlineMedium": "gbh:goal-outline-medium",
  "IconGoalOutlineRegular": "gbh:goal-outline-regular",
  "IconInfoOutlineMedium": "gbh:info-outline-medium",
  "IconInfoOutlineRegular": "gbh:info-outline-regular",
  "IconInspectOutlineMedium": "gbh:inspect-outline-medium",
  "IconInspectOutlineRegular": "gbh:inspect-outline-regular",
  "IconLightOutlineMedium": "gbh:light-outline-medium",
  "IconLightOutlineRegular": "gbh:light-outline-regular",
  "IconLikeFillMedium": "gbh:like-fill-medium",
  "IconLikeFillRegular": "gbh:like-fill-regular",
  "IconLikeOutlineMedium": "gbh:like-outline-medium",
  "IconLikeOutlineRegular": "gbh:like-outline-regular",
  "IconLinkOutlineMedium": "gbh:link-outline-medium",
  "IconLinkOutlineRegular": "gbh:link-outline-regular",
  "IconListPenOutlineMedium": "gbh:list-pen-outline-medium",
  "IconListPenOutlineRegular": "gbh:list-pen-outline-regular",
  "IconLoadingOutlineMedium": "gbh:loading-outline-medium",
  "IconLoadingOutlineRegular": "gbh:loading-outline-regular",
  "IconMicrophoneOutlineMedium": "gbh:microphone-outline-medium",
  "IconMicrophoneOutlineRegular": "gbh:microphone-outline-regular",
  "IconNewChatOutlineMedium": "gbh:new-chat-outline-medium",
  "IconNewChatOutlineRegular": "gbh:new-chat-outline-regular",
  "IconNowrapFillMedium": "gbh:nowrap-fill-medium",
  "IconNowrapFillRegular": "gbh:nowrap-fill-regular",
  "IconPanelLeftOutlineMedium": "gbh:panel-left-outline-medium",
  "IconPanelLeftOutlineRegular": "gbh:panel-left-outline-regular",
  "IconPaperPlaneOutlineMedium": "gbh:paper-plane-outline-medium",
  "IconPaperPlaneOutlineRegular": "gbh:paper-plane-outline-regular",
  "IconPaperclipOutlineMedium": "gbh:paperclip-outline-medium",
  "IconPaperclipOutlineRegular": "gbh:paperclip-outline-regular",
  "IconPauseOutlineMedium": "gbh:pause-outline-medium",
  "IconPauseOutlineRegular": "gbh:pause-outline-regular",
  "IconPersonalizationOutlineMedium": "gbh:personalization-outline-medium",
  "IconPersonalizationOutlineRegular": "gbh:personalization-outline-regular",
  "IconPinFillMedium": "gbh:pin-fill-medium",
  "IconPinFillRegular": "gbh:pin-fill-regular",
  "IconPinOutlineMedium": "gbh:pin-outline-medium",
  "IconPinOutlineRegular": "gbh:pin-outline-regular",
  "IconPlanOutlineArtwork": "gbh:plan-outline-artwork",
  "IconPlanOutlineMedium": "gbh:plan-outline-medium",
  "IconPlanOutlineRegular": "gbh:plan-outline-regular",
  "IconPlayOutlineMedium": "gbh:play-outline-medium",
  "IconPlayOutlineRegular": "gbh:play-outline-regular",
  "IconPluginPinwheelOutlineMedium": "gbh:plugin-pinwheel-outline-medium",
  "IconPluginPinwheelOutlineRegular": "gbh:plugin-pinwheel-outline-regular",
  "IconPlusOutlineMedium": "gbh:plus-outline-medium",
  "IconPlusOutlineRegular": "gbh:plus-outline-regular",
  "IconProjectAddOutlineMedium": "gbh:project-add-outline-medium",
  "IconProjectAddOutlineRegular": "gbh:project-add-outline-regular",
  "IconQuestionOutlineMedium": "gbh:question-outline-medium",
  "IconQuestionOutlineRegular": "gbh:question-outline-regular",
  "IconQueueOutlineMedium": "gbh:queue-outline-medium",
  "IconQueueOutlineRegular": "gbh:queue-outline-regular",
  "IconRefreshOutlineMedium": "gbh:refresh-outline-medium",
  "IconRefreshOutlineRegular": "gbh:refresh-outline-regular",
  "IconRightUpOutlineMedium": "gbh:right-up-outline-medium",
  "IconRightUpOutlineRegular": "gbh:right-up-outline-regular",
  "IconSearchOutlineMedium": "gbh:search-outline-medium",
  "IconSearchOutlineRegular": "gbh:search-outline-regular",
  "IconSendOutlineMedium": "gbh:send-outline-medium",
  "IconSendOutlineRegular": "gbh:send-outline-regular",
  "IconSettingsOutlineMedium": "gbh:settings-outline-medium",
  "IconSettingsOutlineRegular": "gbh:settings-outline-regular",
  "IconShareOutlineMedium": "gbh:share-outline-medium",
  "IconShareOutlineRegular": "gbh:share-outline-regular",
  "IconShieldOutlineMedium": "gbh:shield-outline-medium",
  "IconShieldOutlineRegular": "gbh:shield-outline-regular",
  "IconSkillOutlineMedium": "gbh:skill-outline-medium",
  "IconSkillOutlineRegular": "gbh:skill-outline-regular",
  "IconSlidersTwoOutlineMedium": "gbh:sliders-two-outline-medium",
  "IconSlidersTwoOutlineRegular": "gbh:sliders-two-outline-regular",
  "IconSparkleMedium": "gbh:sparkle-medium",
  "IconSparkleRegular": "gbh:sparkle-regular",
  "IconStopFillMedium": "gbh:stop-fill-medium",
  "IconStopFillRegular": "gbh:stop-fill-regular",
  "IconThinkOutlineMedium": "gbh:think-outline-medium",
  "IconThinkOutlineRegular": "gbh:think-outline-regular",
  "IconTrashOutlineMedium": "gbh:trash-outline-medium",
  "IconTrashOutlineRegular": "gbh:trash-outline-regular",
  "IconTreeCornerMedium": "gbh:tree-corner-medium",
  "IconTreeCornerRegular": "gbh:tree-corner-regular",
  "IconTriangleRightFillMedium": "gbh:triangle-right-fill-medium",
  "IconTriangleRightFillRegular": "gbh:triangle-right-fill-regular",
  "IconUnarchiveOutlineMedium": "gbh:unarchive-outline-medium",
  "IconUnarchiveOutlineRegular": "gbh:unarchive-outline-regular",
  "IconUserOutlineMedium": "gbh:user-outline-medium",
  "IconUserOutlineRegular": "gbh:user-outline-regular",
  "IconUsersOutlineMedium": "gbh:users-outline-medium",
  "IconUsersOutlineRegular": "gbh:users-outline-regular",
  "IconWarningOutlineMedium": "gbh:warning-outline-medium",
  "IconWarningOutlineRegular": "gbh:warning-outline-regular",
  "IconWarningTriangleOutlineMedium": "gbh:warning-triangle-outline-medium",
  "IconWarningTriangleOutlineRegular": "gbh:warning-triangle-outline-regular",
  "IconWorkspaceTreeOutlineMedium": "gbh:workspace-tree-outline-medium",
  "IconWorkspaceTreeOutlineRegular": "gbh:workspace-tree-outline-regular",
  "IconWrapFillMedium": "gbh:wrap-fill-medium",
  "IconWrapFillRegular": "gbh:wrap-fill-regular",
  "IconWrapLinesOutlineMedium": "gbh:wrap-lines-outline-medium",
  "IconWrapLinesOutlineRegular": "gbh:wrap-lines-outline-regular",
};

/** Ten DSH cua ho icon tham chieu (ReferenceIcon) theo do dam net — ten DSH trung nhau giua cac bien the. */
export const REFERENCE_ICON_DSH_WEIGHTS = Object.freeze({
  regular: "ReferenceIconRegular",
  medium: "ReferenceIconMedium",
} as const);

/** Ten DSH cua ho icon quyen (PermissionIcon) theo do dam net. */
export const PERMISSION_ICON_DSH_WEIGHTS = Object.freeze({
  regular: "PermissionIcon",
  medium: "PermissionIcon",
} as const);

/** Khoi khien dung chung cua bo icon (nguyen van tu nguon DSH: khien + stroke). */
export const SHIELD_OUTLINE_PATH = "M6.80132 2.14853C7.70663 1.80917 8.70422 1.80919 9.60952 2.14859L14.1296 3.84317V7.11961C14.1296 11.6089 10.7615 13.5975 8.20543 14.5779C5.64931 13.5975 2.28052 11.6089 2.28052 7.11961V3.84317L6.80132 2.14853Z";
