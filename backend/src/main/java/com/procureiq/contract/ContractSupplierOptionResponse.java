package com.procureiq.contract;

import java.util.UUID;

public record ContractSupplierOptionResponse(
        UUID id,
        String supplierCode,
        String legalName
) {
}
