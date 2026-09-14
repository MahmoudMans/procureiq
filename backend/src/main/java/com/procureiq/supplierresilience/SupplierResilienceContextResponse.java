package com.procureiq.supplierresilience;

import java.util.List;

public record SupplierResilienceContextResponse(
        List<ResilienceUserOptionResponse> users
) {
}
