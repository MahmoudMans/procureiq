package com.procureiq.demandconsolidation;

import java.util.List;

public record DemandConsolidationContextResponse(
        List<DemandConsolidationUserOptionResponse> users,
        List<DemandConsolidationRfqOptionResponse> rfqs
) {
}
