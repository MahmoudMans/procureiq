package com.procureiq.supplieronboarding;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class SupplierOnboardingGateService {

    public List<OnboardingApprovalLevel> requiredApprovalLevels(
            SupplierOnboardingRiskTier riskTier
    ) {
        return switch (
                riskTier
        ) {
            case LOW ->
                    List.of(
                            OnboardingApprovalLevel.PROCUREMENT
                    );

            case MEDIUM ->
                    List.of(
                            OnboardingApprovalLevel.PROCUREMENT,
                            OnboardingApprovalLevel.COMPLIANCE
                    );

            case HIGH,
                 CRITICAL ->
                    List.of(
                            OnboardingApprovalLevel.PROCUREMENT,
                            OnboardingApprovalLevel.COMPLIANCE,
                            OnboardingApprovalLevel.RISK
                    );
        };
    }

    public int slaDays(
            SupplierOnboardingRiskTier riskTier
    ) {
        return switch (
                riskTier
        ) {
            case LOW -> 10;
            case MEDIUM -> 7;
            case HIGH -> 5;
            case CRITICAL -> 3;
        };
    }

    public int requalificationDays(
            SupplierOnboardingRiskTier riskTier
    ) {
        return switch (
                riskTier
        ) {
            case LOW -> 365;
            case MEDIUM -> 270;
            case HIGH -> 180;
            case CRITICAL -> 90;
        };
    }

    public OnboardingGateEvaluation evaluate(
            int mandatoryQuestions,
            int answeredMandatoryQuestions,
            int nonCompliantMandatoryQuestions,
            int mandatoryEvidence,
            int validMandatoryEvidence,
            int requiredApprovals,
            int approvedRequiredApprovals
    ) {
        List<String> reasons =
                new ArrayList<>();

        if (
                answeredMandatoryQuestions
                        <
                        mandatoryQuestions
        ) {
            reasons.add(
                    "Mandatory qualification questions remain unanswered."
            );
        }

        if (
                nonCompliantMandatoryQuestions
                        > 0
        ) {
            reasons.add(
                    nonCompliantMandatoryQuestions
                            + " mandatory qualification answers are non-compliant."
            );
        }

        if (
                validMandatoryEvidence
                        <
                        mandatoryEvidence
        ) {
            reasons.add(
                    "Mandatory evidence is missing, rejected, unvalidated or expired."
            );
        }

        if (
                approvedRequiredApprovals
                        <
                        requiredApprovals
        ) {
            reasons.add(
                    "Required onboarding approvals remain outstanding."
            );
        }

        return new OnboardingGateEvaluation(
                reasons.isEmpty(),
                List.copyOf(
                        reasons
                )
        );
    }
}
