package com.procureiq.compliance;

public record PolicyEvaluationResponse(
        long policiesEvaluated,
        long candidatesEvaluated,
        long createdViolations,
        long refreshedViolations
) {
}
