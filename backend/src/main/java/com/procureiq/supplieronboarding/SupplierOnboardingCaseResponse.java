package com.procureiq.supplieronboarding;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SupplierOnboardingCaseResponse(
        UUID id,
        String caseNumber,

        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierCategory,
        String supplierCountry,
        String supplierStatus,
        String supplierRiskLevel,

        SupplierOnboardingCaseType caseType,
        SupplierOnboardingStatus status,
        SupplierOnboardingRiskTier riskTier,

        UUID ownerUserId,
        String ownerName,

        boolean activationClearance,
        boolean activationEligible,

        List<String> activationGateReasons,

        int mandatoryQuestions,
        int answeredMandatoryQuestions,
        int nonCompliantMandatoryQuestions,

        int mandatoryEvidence,
        int validMandatoryEvidence,

        int requiredApprovals,
        int approvedRequiredApprovals,

        Instant slaDueAt,
        boolean slaOverdue,
        long daysOpen,

        Instant submittedAt,
        Instant decisionAt,

        LocalDate requalificationDueDate,
        boolean requalificationDueWithin30Days,
        boolean requalificationExpired,

        String decisionNote,
        String notes,

        List<QualificationQuestionResponse> questions,
        List<OnboardingEvidenceResponse> evidence,
        List<OnboardingApprovalResponse> approvals,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
