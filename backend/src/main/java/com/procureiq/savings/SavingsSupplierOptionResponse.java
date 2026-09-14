package com.procureiq.savings;

import java.util.UUID;

public record SavingsSupplierOptionResponse(
        UUID id,
        String supplierCode,
        String legalName,
        String category
) {
}
