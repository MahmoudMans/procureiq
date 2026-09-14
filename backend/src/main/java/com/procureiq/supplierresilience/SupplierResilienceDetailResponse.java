package com.procureiq.supplierresilience;

import java.util.List;

public record SupplierResilienceDetailResponse(
        SupplierResilienceIntelligenceResponse intelligence,
        List<SupplierAlternativeResponse> alternatives,
        List<ResilienceActionResponse> mitigationActions
) {
}
