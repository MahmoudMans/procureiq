package com.procureiq.risk;

import java.util.UUID;

public record RiskSupplierOptionResponse(
        UUID id,
        String supplierCode,
        String legalName
) {
}
