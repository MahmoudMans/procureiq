package com.procureiq.supplierinsight;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

public record Supplier360SourcingResponse(
        UUID rfqId,
        String rfqNumber,
        String title,
        String rfqStatus,
        String invitationStatus,
        LocalDateTime responseDeadline,
        String quotationNumber,
        String quotationStatus,
        BigDecimal quotationTotal,
        Instant quotationSubmittedAt
) {
}
