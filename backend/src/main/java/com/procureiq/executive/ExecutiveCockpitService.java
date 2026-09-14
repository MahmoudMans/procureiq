package com.procureiq.executive;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class ExecutiveCockpitService {

    private final ExecutiveCockpitRepository repository;

    private final ExecutiveWarningScoringService scoringService;

    private final AppUserRepository appUserRepository;

    public ExecutiveCockpitService(
            ExecutiveCockpitRepository repository,
            ExecutiveWarningScoringService scoringService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.scoringService =
                scoringService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public ExecutiveCockpitResponse cockpit(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        List<ExecutiveCockpitRepository.RuleRow> rules =
                repository.rules();

        Map<
                String,
                ExecutiveCockpitRepository.AcknowledgementRow
        > acknowledgements =
                repository.acknowledgements();

        List<ExecutiveWarningResponse> warnings =
                generateWarnings(
                        rules,
                        acknowledgements,
                        normalizedCurrency
                );

        return new ExecutiveCockpitResponse(
                summary(
                        warnings,
                        normalizedCurrency
                ),
                portfolioSignals(
                        warnings
                ),
                warnings,
                managementActions(
                        warnings
                ),
                rules.stream()
                        .map(
                                this::ruleResponse
                        )
                        .toList(),
                Instant.now()
        );
    }

    public ExecutiveWarningResponse acknowledgeWarning(
            UUID currentUserId,
            String warningKey,
            ExecutiveWarningAcknowledgeInput input,
            String currency
    ) {
        assertActionRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ExecutiveCockpitResponse cockpit =
                cockpit(
                        currentUserId,
                        currency
                );

        ExecutiveWarningResponse warning =
                cockpit.warnings()
                        .stream()
                        .filter(
                                item ->
                                        item.warningKey()
                                                .equals(
                                                        warningKey
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Executive warning is no longer active: "
                                                        + warningKey
                                        )
                        );

        repository.acknowledge(
                warningKey,
                warning.ruleId(),
                currentUserId,
                input.note()
        );

        return cockpit(
                currentUserId,
                currency
        )
                .warnings()
                .stream()
                .filter(
                        item ->
                                item.warningKey()
                                        .equals(
                                                warningKey
                                        )
                )
                .findFirst()
                .orElseThrow();
    }

    public void unacknowledgeWarning(
            UUID currentUserId,
            String warningKey
    ) {
        assertActionRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        repository.unacknowledge(
                warningKey
        );
    }

    public ExecutiveRuleResponse updateRule(
            UUID currentUserId,
            long ruleId,
            ExecutiveRuleUpdateInput input
    ) {
        assertRuleRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ExecutiveCockpitRepository.RuleRow existing =
                repository.findRule(
                        ruleId
                );

        if (existing == null) {
            throw new ResourceNotFoundException(
                    "Executive early-warning rule not found: "
                            + ruleId
            );
        }

        repository.updateRule(
                ruleId,
                input
        );

        ExecutiveCockpitRepository.RuleRow updated =
                repository.findRule(
                        ruleId
                );

        if (updated == null) {
            throw new IllegalStateException(
                    "Updated executive rule could not be reloaded."
            );
        }

        return ruleResponse(
                updated
        );
    }

    private List<ExecutiveWarningResponse> generateWarnings(
            List<ExecutiveCockpitRepository.RuleRow> rules,
            Map<
                    String,
                    ExecutiveCockpitRepository.AcknowledgementRow
            > acknowledgements,
            String currency
    ) {
        List<ExecutiveWarningResponse> warnings =
                new ArrayList<>();

        for (
                ExecutiveCockpitRepository.RuleRow rule
                : rules
        ) {
            if (!rule.enabled()) {
                continue;
            }

            List<ExecutiveCockpitRepository.SignalCandidate> candidates =
                    candidates(
                            rule,
                            currency
                    );

            for (
                    ExecutiveCockpitRepository.SignalCandidate candidate
                    : candidates
            ) {
                if (
                        candidate.exposureValue()
                                != null
                        &&
                        rule.thresholdValue()
                                .compareTo(
                                        BigDecimal.ZERO
                                ) > 0
                        &&
                        rule.ruleCode()
                                .equals(
                                        "COMMERCIAL_LEAKAGE"
                                )
                        &&
                        candidate.exposureValue()
                                .compareTo(
                                        rule.thresholdValue()
                                ) < 0
                ) {
                    continue;
                }

                warnings.add(
                        warningResponse(
                                rule,
                                candidate,
                                acknowledgements
                        )
                );
            }
        }

        warnings.sort(
                Comparator
                        .comparing(
                                ExecutiveWarningResponse::
                                        acknowledged
                        )
                        .thenComparing(
                                ExecutiveWarningResponse::
                                        priorityScore,
                                Comparator.reverseOrder()
                        )
                        .thenComparing(
                                ExecutiveWarningResponse::
                                        dueAt,
                                Comparator.nullsLast(
                                        Comparator.naturalOrder()
                                )
                        )
        );

        return List.copyOf(
                warnings
        );
    }

    private List<ExecutiveCockpitRepository.SignalCandidate> candidates(
            ExecutiveCockpitRepository.RuleRow rule,
            String currency
    ) {
        return switch (
                rule.ruleCode()
        ) {
            case "PROCESS_STAGE_SLA_BREACH" ->
                    repository.processBottlenecks(
                            rule.thresholdValue()
                    );

            case "INVOICE_OVERDUE" ->
                    repository.overdueInvoices(
                            currency
                    );

            case "INVOICE_PAYMENT_HOLD" ->
                    repository.paymentHoldInvoices(
                            currency
                    );

            case "CRITICAL_INVOICE_EXCEPTION" ->
                    repository.criticalInvoiceExceptions(
                            currency
                    );

            case "COMMERCIAL_LEAKAGE" ->
                    repository.commercialLeakage(
                            currency
                    );

            case "CONTRACT_NOTICE_DEADLINE" ->
                    repository.renewalDeadlines(
                            currency,
                            rule.lookaheadDays()
                    );

            case "CRITICAL_OBLIGATION_OVERDUE" ->
                    repository.overdueCriticalObligations(
                            currency
                    );

            case "SUPPLIER_CAPACITY_AT_RISK" ->
                    repository.supplierCapacityRisk(
                            currency
                    );

            case "SINGLE_SOURCE_CRITICAL_SUPPLIER" ->
                    repository.criticalSingleSourceSuppliers(
                            currency
                    );

            case "NEGOTIATION_TARGET_MISS" ->
                    repository.negotiationTargetMisses(
                            currency
                    );

            case "DEMAND_SOURCING_DELAY" ->
                    repository.delayedDemandBundles(
                            currency
                    );

            case "DEMAND_SAVINGS_OPPORTUNITY" ->
                    repository.demandSavingsOpportunities(
                            currency,
                            rule.thresholdValue()
                    );

            default ->
                    List.of();
        };
    }

    private ExecutiveWarningResponse warningResponse(
            ExecutiveCockpitRepository.RuleRow rule,
            ExecutiveCockpitRepository.SignalCandidate candidate,
            Map<
                    String,
                    ExecutiveCockpitRepository.AcknowledgementRow
            > acknowledgements
    ) {
        String warningKey =
                rule.ruleCode()
                        + ":"
                        + candidate.referenceId();

        ExecutiveCockpitRepository.AcknowledgementRow acknowledgement =
                acknowledgements.get(
                        warningKey
                );

        ExecutiveWarningSeverity severity =
                severity(
                        rule,
                        candidate
                );

        return new ExecutiveWarningResponse(
                warningKey,
                rule.id(),
                rule.ruleCode(),
                rule.signalType(),
                rule.nature(),
                severity,
                rule.title(),
                candidate.details(),
                rule.recommendation(),
                candidate.referenceType(),
                candidate.referenceId(),
                candidate.referenceLabel(),
                candidate.currency(),
                moneyNullable(
                        candidate.exposureValue()
                ),
                metricNullable(
                        candidate.metricValue()
                ),
                candidate.dueAt(),
                scoringService
                        .priorityScore(
                                severity,
                                candidate.metricValue(),
                                candidate.exposureValue()
                        ),
                acknowledgement
                        != null,
                acknowledgement == null
                        ? null
                        : acknowledgement
                                .acknowledgedAt(),
                acknowledgement == null
                        ? null
                        : acknowledgement
                                .acknowledgedByName(),
                acknowledgement == null
                        ? null
                        : acknowledgement
                                .note()
        );
    }

    private ExecutiveWarningSeverity severity(
            ExecutiveCockpitRepository.RuleRow rule,
            ExecutiveCockpitRepository.SignalCandidate candidate
    ) {
        if (
                candidate.severityHint()
                        != null
        ) {
            return candidate
                    .severityHint();
        }

        if (
                rule.ruleCode()
                        .equals(
                                "PROCESS_STAGE_SLA_BREACH"
                        )
                &&
                candidate.metricValue()
                        != null
                &&
                candidate.metricValue()
                        .compareTo(
                                new BigDecimal(
                                        "2.00"
                                )
                        ) >= 0
        ) {
            return ExecutiveWarningSeverity.CRITICAL;
        }

        if (
                rule.ruleCode()
                        .equals(
                                "INVOICE_OVERDUE"
                        )
                &&
                candidate.metricValue()
                        != null
        ) {
            if (
                    candidate.metricValue()
                            .compareTo(
                                    new BigDecimal(
                                            "30"
                                    )
                            ) >= 0
            ) {
                return ExecutiveWarningSeverity.CRITICAL;
            }

            if (
                    candidate.metricValue()
                            .compareTo(
                                    new BigDecimal(
                                            "7"
                                    )
                            ) >= 0
            ) {
                return ExecutiveWarningSeverity.HIGH;
            }
        }

        return rule.defaultSeverity();
    }

    private ExecutiveCockpitSummaryResponse summary(
            List<ExecutiveWarningResponse> warnings,
            String currency
    ) {
        List<ExecutiveWarningResponse> unacknowledged =
                warnings.stream()
                        .filter(
                                warning ->
                                        !warning.acknowledged()
                        )
                        .toList();

        long critical =
                unacknowledged.stream()
                        .filter(
                                warning ->
                                        warning.severity()
                                                == ExecutiveWarningSeverity.CRITICAL
                        )
                        .count();

        long high =
                unacknowledged.stream()
                        .filter(
                                warning ->
                                        warning.severity()
                                                == ExecutiveWarningSeverity.HIGH
                        )
                        .count();

        BigDecimal riskExposure =
                distinctExposure(
                        unacknowledged.stream()
                                .filter(
                                        warning ->
                                                warning.nature()
                                                        == ExecutiveSignalNature.RISK
                                )
                                .toList()
                );

        BigDecimal opportunityValue =
                distinctExposure(
                        unacknowledged.stream()
                                .filter(
                                        warning ->
                                                warning.nature()
                                                        == ExecutiveSignalNature.OPPORTUNITY
                                )
                                .toList()
                );

        BigDecimal overdueInvoices =
                exposureForRule(
                        unacknowledged,
                        "INVOICE_OVERDUE"
                );

        BigDecimal paymentHolds =
                exposureForRule(
                        unacknowledged,
                        "INVOICE_PAYMENT_HOLD"
                );

        BigDecimal leakage =
                exposureForRule(
                        unacknowledged,
                        "COMMERCIAL_LEAKAGE"
                );

        BigDecimal demandOpportunity =
                exposureForRule(
                        unacknowledged,
                        "DEMAND_SAVINGS_OPPORTUNITY"
                );

        long supplierSignals =
                unacknowledged.stream()
                        .filter(
                                warning ->
                                        warning.signalType()
                                                == ExecutiveSignalType.SUPPLIER
                                        &&
                                        warning.severity()
                                                == ExecutiveWarningSeverity.CRITICAL
                        )
                        .count();

        long processBottlenecks =
                unacknowledged.stream()
                        .filter(
                                warning ->
                                        warning.ruleCode()
                                                .equals(
                                                        "PROCESS_STAGE_SLA_BREACH"
                                                )
                        )
                        .count();

        return new ExecutiveCockpitSummaryResponse(
                currency,
                warnings.size(),
                unacknowledged.size(),
                critical,
                high,
                riskExposure,
                opportunityValue,
                overdueInvoices,
                paymentHolds,
                leakage,
                demandOpportunity,
                supplierSignals,
                processBottlenecks
        );
    }

    private List<ExecutivePortfolioSignalResponse> portfolioSignals(
            List<ExecutiveWarningResponse> warnings
    ) {
        Map<
                ExecutiveSignalType,
                List<ExecutiveWarningResponse>
        > grouped =
                new EnumMap<>(
                        ExecutiveSignalType.class
                );

        for (
                ExecutiveSignalType type
                : ExecutiveSignalType.values()
        ) {
            grouped.put(
                    type,
                    new ArrayList<>()
            );
        }

        warnings.stream()
                .filter(
                        warning ->
                                !warning.acknowledged()
                )
                .forEach(
                        warning ->
                                grouped
                                        .get(
                                                warning.signalType()
                                        )
                                        .add(
                                                warning
                                        )
                );

        List<ExecutivePortfolioSignalResponse> result =
                new ArrayList<>();

        for (
                Map.Entry<
                        ExecutiveSignalType,
                        List<ExecutiveWarningResponse>
                > entry
                : grouped.entrySet()
        ) {
            List<ExecutiveWarningResponse> values =
                    entry.getValue();

            result.add(
                    new ExecutivePortfolioSignalResponse(
                            entry.getKey(),
                            values.size(),
                            values.stream()
                                    .filter(
                                            warning ->
                                                    warning.severity()
                                                            == ExecutiveWarningSeverity.CRITICAL
                                    )
                                    .count(),
                            distinctExposure(
                                    values.stream()
                                            .filter(
                                                    warning ->
                                                            warning.nature()
                                                                    == ExecutiveSignalNature.RISK
                                            )
                                            .toList()
                            ),
                            distinctExposure(
                                    values.stream()
                                            .filter(
                                                    warning ->
                                                            warning.nature()
                                                                    == ExecutiveSignalNature.OPPORTUNITY
                                            )
                                            .toList()
                            )
                    )
            );
        }

        result.sort(
                Comparator.comparingLong(
                        ExecutivePortfolioSignalResponse::
                                criticalCount
                )
                        .thenComparingLong(
                                ExecutivePortfolioSignalResponse::
                                        warningCount
                        )
                        .reversed()
        );

        return List.copyOf(
                result
        );
    }

    private List<ExecutiveManagementActionResponse> managementActions(
            List<ExecutiveWarningResponse> warnings
    ) {
        record MutableAction(
                ExecutiveWarningSeverity severity,
                String details,
                long count
        ) {
        }

        Map<
                String,
                MutableAction
        > actions =
                new LinkedHashMap<>();

        warnings.stream()
                .filter(
                        warning ->
                                !warning.acknowledged()
                )
                .forEach(
                        warning -> {
                            MutableAction existing =
                                    actions.get(
                                            warning.title()
                                    );

                            if (existing == null) {
                                actions.put(
                                        warning.title(),
                                        new MutableAction(
                                                warning.severity(),
                                                warning.recommendation(),
                                                1
                                        )
                                );
                            } else {
                                ExecutiveWarningSeverity priority =
                                        severityRank(
                                                warning.severity()
                                        )
                                                >
                                                severityRank(
                                                        existing.severity()
                                                )
                                                ? warning.severity()
                                                : existing.severity();

                                actions.put(
                                        warning.title(),
                                        new MutableAction(
                                                priority,
                                                existing.details(),
                                                existing.count()
                                                        + 1
                                        )
                                );
                            }
                        }
                );

        return actions
                .entrySet()
                .stream()
                .map(
                        entry ->
                                new ExecutiveManagementActionResponse(
                                        entry.getValue()
                                                .severity(),
                                        entry.getKey(),
                                        entry.getValue()
                                                .details(),
                                        entry.getValue()
                                                .count()
                                )
                )
                .sorted(
                        Comparator
                                .comparingInt(
                                        (
                                                ExecutiveManagementActionResponse action
                                        ) ->
                                                severityRank(
                                                        action.priority()
                                                )
                                )
                                .reversed()
                                .thenComparingLong(
                                        ExecutiveManagementActionResponse::
                                                warningCount
                                )
                                .reversed()
                )
                .limit(
                        12
                )
                .toList();
    }

    private BigDecimal distinctExposure(
            List<ExecutiveWarningResponse> warnings
    ) {
        Map<
                String,
                BigDecimal
        > exposureByReference =
                new LinkedHashMap<>();

        for (
                ExecutiveWarningResponse warning
                : warnings
        ) {
            if (
                    warning.exposureValue()
                            == null
                    ||
                    warning.exposureValue()
                            .compareTo(
                                    BigDecimal.ZERO
                            ) <= 0
            ) {
                continue;
            }

            String key =
                    warning.referenceType()
                            + ":"
                            + warning.referenceId();

            exposureByReference.merge(
                    key,
                    warning.exposureValue(),
                    BigDecimal::max
            );
        }

        return exposureByReference
                .values()
                .stream()
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal exposureForRule(
            List<ExecutiveWarningResponse> warnings,
            String ruleCode
    ) {
        return warnings.stream()
                .filter(
                        warning ->
                                warning.ruleCode()
                                        .equals(
                                                ruleCode
                                        )
                )
                .map(
                        ExecutiveWarningResponse::
                                exposureValue
                )
                .filter(
                        java.util.Objects::nonNull
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private ExecutiveRuleResponse ruleResponse(
            ExecutiveCockpitRepository.RuleRow row
    ) {
        return new ExecutiveRuleResponse(
                row.id(),
                row.ruleCode(),
                row.signalType(),
                row.nature(),
                row.title(),
                row.description(),
                row.recommendation(),
                row.defaultSeverity(),
                row.thresholdValue()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                row.lookaheadDays(),
                row.enabled(),
                row.priority()
        );
    }

    private int severityRank(
            ExecutiveWarningSeverity severity
    ) {
        return switch (
                severity
        ) {
            case INFO -> 1;
            case LOW -> 2;
            case MEDIUM -> 3;
            case HIGH -> 4;
            case CRITICAL -> 5;
        };
    }

    private BigDecimal moneyNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : value.setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal metricNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : value.setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private String normalizeCurrency(
            String currency
    ) {
        if (
                currency == null
                ||
                currency.trim()
                        .length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Executive cockpit currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private AppUserEntity findCurrentUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                userId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Authenticated ProcureIQ user not found."
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "The authenticated ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private void assertReadRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access the executive cockpit."
            );
        }
    }

    private void assertActionRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot acknowledge executive warnings."
            );
        }
    }

    private void assertRuleRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can configure executive warning rules."
            );
        }
    }
}
