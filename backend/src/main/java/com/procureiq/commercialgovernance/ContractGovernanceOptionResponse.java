package com.procureiq.commercialgovernance;

import java.time.LocalDate;
import java.util.UUID;

public record ContractGovernanceOptionResponse(
        UUID contractId,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String contractStatus,
        LocalDate endDate,
        boolean governanceConfigured
) {
}
