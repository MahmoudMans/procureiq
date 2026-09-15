package com.procureiq.interventionexecution;

import java.util.List;

public record InterventionExecutionCaseDetailResponse(
        InterventionExecutionCaseResponse executionCase,
        List<InterventionExecutionUserOptionResponse> users,
        InterventionExecutionAcknowledgementResponse acknowledgement,
        List<InterventionExecutionEvidenceResponse> evidence,
        List<InterventionExecutionVerificationResponse> verifications
) {
}
