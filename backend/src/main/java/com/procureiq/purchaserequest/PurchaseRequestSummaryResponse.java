package com.procureiq.purchaserequest;

import java.math.BigDecimal;

public record PurchaseRequestSummaryResponse(
        long totalRequests,
        long draftRequests,
        long submittedRequests,
        long approvedRequests,
        long rejectedRequests,
        long cancelledRequests,
        BigDecimal totalSubmittedValue
) {
}
