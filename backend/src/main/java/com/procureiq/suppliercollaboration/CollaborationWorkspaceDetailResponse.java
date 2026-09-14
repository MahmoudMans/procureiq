package com.procureiq.suppliercollaboration;

import java.util.List;

public record CollaborationWorkspaceDetailResponse(
        CollaborationWorkspaceListResponse workspace,
        String resolutionNote,
        String notes,
        List<CollaborationMessageResponse> messages,
        List<CollaborationActionResponse> actions
) {
}
