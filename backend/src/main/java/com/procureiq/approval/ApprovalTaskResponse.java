package com.procureiq.approval;

import com.procureiq.user.ProcurementRole;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ApprovalTaskResponse(
        UUID id,
        UUID purchaseRequestId,
        String requestNumber,
        String requestTitle,
        String requesterName,
        String requesterEmail,
        String departmentName,
        String costCenter,
        String currency,
        BigDecimal estimatedTotalAmount,
        LocalDate desiredDeliveryDate,
        UUID policyId,
        String policyCode,
        String policyName,
        ProcurementRole requiredRole,
        ApprovalTaskStatus status,
        UUID decidedByUserId,
        String decidedByName,
        String decisionComment,
        Instant requestedAt,
        Instant decidedAt,
        long version
) {
}
