package com.procureiq.categorymanagement;

import java.math.BigDecimal;
import java.util.UUID;

public record CategorySupplierLandscapeResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String country,
        BigDecimal spend,
        BigDecimal spendShare,
        BigDecimal continuousRiskScore,
        String continuousRiskBand
) {
}
