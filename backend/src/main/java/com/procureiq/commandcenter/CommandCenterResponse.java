package com.procureiq.commandcenter;

import java.time.Instant;
import java.util.List;

public record CommandCenterResponse(
        Instant generatedAt,
        int horizonDays,
        CommandCenterSummaryResponse summary,
        List<CommandCenterBreakdownResponse> breakdown,
        List<CommandCenterActionResponse> actions
) {
}
