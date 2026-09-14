package com.procureiq.risk;

import java.util.UUID;

public record RiskContractOptionResponse(
        UUID id,
        String contractNumber,
        String title,
        UUID supplierId,
        String supplierName
) {
}
