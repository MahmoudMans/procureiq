package com.procureiq.commercialgovernance;

import java.util.List;

public record CommercialGovernanceDetailResponse(
        CommercialGovernanceRecordResponse governance,
        List<ContractObligationResponse> obligations,
        List<CommercialLeakageFindingResponse> leakageFindings
) {
}
