package com.procureiq.contract;

import java.time.LocalDate;
import java.util.UUID;

public record ContractAlertResponse(
        String alertType,
        String severity,
        UUID supplierId,
        String supplierName,
        UUID contractId,
        String contractNumber,
        String title,
        LocalDate dueDate,
        long daysRemaining,
        String href
) {
}
