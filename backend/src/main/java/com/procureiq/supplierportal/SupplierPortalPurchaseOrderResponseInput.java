package com.procureiq.supplierportal;

import jakarta.validation.constraints.Size;

public record SupplierPortalPurchaseOrderResponseInput(

        @Size(max = 1000)
        String note
) {
}
