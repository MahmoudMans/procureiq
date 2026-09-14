package com.procureiq.executive;

public record ExecutiveManagementActionResponse(
        ExecutiveWarningSeverity priority,
        String title,
        String details,
        long warningCount
) {
}
