package com.procureiq.guidedbuying;

import com.procureiq.compliance.ProcurementPolicyType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Component
public class GuidedBuyingRecommendationEngine {

    public Recommendation recommend(
            BigDecimal estimatedAmount,
            String currency,
            String supplierRiskLevel,
            List<PolicyRule> rules
    ) {
        List<String> signals =
                new ArrayList<>();

        boolean competitive =
                false;

        boolean poControl =
                false;

        boolean contractControl =
                false;

        boolean riskReview =
                false;

        for (
                PolicyRule rule
                : rules
        ) {
            boolean currencyMatches =
                    rule.currency() == null
                    ||
                    rule.currency()
                            .equalsIgnoreCase(
                                    currency
                            );

            if (!currencyMatches) {
                continue;
            }

            switch (
                    rule.policyType()
            ) {
                case COMPETITIVE_SOURCING_THRESHOLD -> {
                    if (
                            thresholdReached(
                                    estimatedAmount,
                                    rule.thresholdAmount()
                            )
                    ) {
                        competitive =
                                true;

                        signals.add(
                                rule.policyCode()
                                        + ": competitive sourcing is required at or above "
                                        + rule.thresholdAmount()
                                        + " "
                                        + (
                                                rule.currency()
                                                        == null
                                                        ? currency
                                                        : rule.currency()
                                        )
                                        + "."
                        );
                    }
                }

                case PURCHASE_ORDER_REQUIRED_THRESHOLD -> {
                    if (
                            thresholdReached(
                                    estimatedAmount,
                                    rule.thresholdAmount()
                            )
                    ) {
                        poControl =
                                true;

                        signals.add(
                                rule.policyCode()
                                        + ": a formal purchase order is required."
                        );
                    }
                }

                case CONTRACT_REQUIRED_THRESHOLD -> {
                    if (
                            thresholdReached(
                                    estimatedAmount,
                                    rule.thresholdAmount()
                            )
                    ) {
                        contractControl =
                                true;

                        signals.add(
                                rule.policyCode()
                                        + ": validate active supplier contract coverage before commitment."
                        );
                    }
                }

                case HIGH_RISK_SUPPLIER_RESTRICTION -> {
                    if (
                            "HIGH".equalsIgnoreCase(
                                    supplierRiskLevel
                            )
                            ||
                            "CRITICAL".equalsIgnoreCase(
                                    supplierRiskLevel
                            )
                    ) {
                        riskReview =
                                true;

                        signals.add(
                                rule.policyCode()
                                        + ": selected supplier requires elevated risk review."
                        );
                    }
                }
            }
        }

        int controls =
                (
                        competitive
                                ? 1
                                : 0
                )
                +
                (
                        poControl
                                ? 1
                                : 0
                )
                +
                (
                        contractControl
                                ? 1
                                : 0
                )
                +
                (
                        riskReview
                                ? 1
                                : 0
                );

        GuidedBuyingRoute route;

        if (controls == 0) {
            route =
                    GuidedBuyingRoute.DIRECT_BUY;

            signals.add(
                    "No active procurement policy currently requires an escalated buying route."
            );
        } else if (controls > 1) {
            route =
                    GuidedBuyingRoute.MULTI_CONTROL;
        } else if (riskReview) {
            route =
                    GuidedBuyingRoute.RISK_REVIEW;
        } else if (competitive) {
            route =
                    GuidedBuyingRoute.COMPETITIVE_SOURCING;
        } else if (contractControl) {
            route =
                    GuidedBuyingRoute.CONTRACT_CONTROL;
        } else {
            route =
                    GuidedBuyingRoute.PURCHASE_ORDER_CONTROL;
        }

        String summary =
                summary(
                        route,
                        controls
                );

        return new Recommendation(
                route,
                summary,
                List.copyOf(
                        signals
                )
        );
    }

    private boolean thresholdReached(
            BigDecimal amount,
            BigDecimal threshold
    ) {
        return threshold != null
                &&
                amount.compareTo(
                        threshold
                ) >= 0;
    }

    private String summary(
            GuidedBuyingRoute route,
            int controlCount
    ) {
        return switch (
                route
        ) {
            case DIRECT_BUY ->
                    "The intake is currently eligible for the standard direct-buy path, subject to normal approval and budget controls.";

            case COMPETITIVE_SOURCING ->
                    "Competitive sourcing is required before commitment. Create or link an RFQ after the purchase request is approved.";

            case PURCHASE_ORDER_CONTROL ->
                    "The anticipated value requires formal purchase-order control before supplier commitment.";

            case CONTRACT_CONTROL ->
                    "Contract coverage should be confirmed before this purchase proceeds to commitment.";

            case RISK_REVIEW ->
                    "The selected supplier requires elevated supplier-risk review before procurement proceeds.";

            case MULTI_CONTROL ->
                    "Multiple procurement controls apply to this intake ("
                            + controlCount
                            + " active controls). Follow the policy signals before supplier commitment.";
        };
    }

    public record PolicyRule(
            String policyCode,
            ProcurementPolicyType policyType,
            BigDecimal thresholdAmount,
            String currency
    ) {
    }

    public record Recommendation(
            GuidedBuyingRoute route,
            String summary,
            List<String> signals
    ) {
    }
}
