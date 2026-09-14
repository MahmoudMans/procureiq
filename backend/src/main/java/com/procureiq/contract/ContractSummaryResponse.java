package com.procureiq.contract;

import java.math.BigDecimal;

public record ContractSummaryResponse(
        long totalContracts,
        long activeContracts,
        long expiringSoonContracts,
        long expiredContracts,
        BigDecimal activeContractValue,
        long expiringComplianceDocuments,
        long expiredComplianceDocuments,
        long suppliersWithComplianceIssues
) {
}
