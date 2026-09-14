package com.procureiq.approval;

import java.math.BigDecimal;

public record ApprovalSummaryResponse(
        long visibleTasks,
        long pendingTasks,
        long approvedTasks,
        long rejectedTasks,
        long cancelledTasks,
        BigDecimal pendingValue
) {
}
