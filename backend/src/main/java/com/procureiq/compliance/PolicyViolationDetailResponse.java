package com.procureiq.compliance;

import java.util.List;

public record PolicyViolationDetailResponse(
        PolicyViolationResponse violation,
        List<PolicyWaiverResponse> waivers,
        List<PolicyEvidenceResponse> evidence
) {
}
