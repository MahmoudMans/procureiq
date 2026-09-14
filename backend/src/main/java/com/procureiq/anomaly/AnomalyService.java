package com.procureiq.anomaly;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Transactional
public class AnomalyService {

    private final AnomalyRepository repository;

    private final AnomalyScoringService scoringService;

    private final AppUserRepository appUserRepository;

    public AnomalyService(
            AnomalyRepository repository,
            AnomalyScoringService scoringService,
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
    public AnomalyControlDashboardResponse dashboard(
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

        List<AnomalyRepository.FindingRow> findings =
                repository.findings(
                        normalizedCurrency
                );

        List<AnomalyRepository.RuleRow> rules =
                repository.rules();

        List<AnomalyRepository.FindingRow> active =
                findings.stream()
                        .filter(
                                this::isActiveFinding
                        )
                        .toList();

        AnomalyRepository.InvestigationStats investigationStats =
                repository
                        .investigationStats();

        return new AnomalyControlDashboardResponse(
                summary(
                        normalizedCurrency,
                        findings,
                        active,
                        investigationStats
                ),
                signalSummaries(
                        active
                ),
                findings.stream()
                        .map(
                                this::findingResponse
                        )
                        .toList(),
                rules.stream()
                        .map(
                                this::ruleResponse
                        )
                        .toList()
        );
    }

    public AnomalyScanResponse scan(
            UUID currentUserId,
            String currency
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        List<AnomalyRepository.RuleRow> rules =
                repository.rules();

        AtomicLong detected =
                new AtomicLong();

        AtomicLong created =
                new AtomicLong();

        AtomicLong refreshed =
                new AtomicLong();

        AtomicLong autoResolved =
                new AtomicLong(
                        repository
                                .autoResolveDisabledRuleFindings()
                );

        for (
                AnomalyRepository.RuleRow rule
                : rules
        ) {
            if (!rule.enabled()) {
                continue;
            }

            List<AnomalyRepository.AnomalyCandidate> candidates =
                    repository
                            .candidatesForRule(
                                    rule,
                                    normalizedCurrency
                            );

            detected.addAndGet(
                    candidates.size()
            );

            Set<String> currentKeys =
                    new HashSet<>();

            for (
                AnomalyRepository.AnomalyCandidate candidate
                : candidates
        ) {
                currentKeys.add(
                        candidate.findingKey()
                );

                AnomalyRepository.FindingRow existing =
                        repository
                                .findFindingByKey(
                                        candidate.findingKey()
                                );

                BigDecimal score =
                        scoringService
                                .score(
                                        rule.defaultSeverity(),
                                        rule.scoreWeight(),
                                        candidate.metricValue(),
                                        candidate.exposureValue()
                                );

                repository.upsertFinding(
                        existing == null
                                ? UUID.randomUUID()
                                : existing.id(),
                        rule.id(),
                        candidate,
                        score
                );

                if (existing == null) {
                    created.incrementAndGet();
                } else {
                    refreshed.incrementAndGet();
                }
            }

            for (
                    AnomalyRepository.FindingRow existing
                    : repository
                            .activeFindingsByRule(
                                    rule.id()
                            )
            ) {
                if (
                        !currentKeys.contains(
                                existing.findingKey()
                        )
                ) {
                    int changed =
                            repository
                                    .autoResolveFinding(
                                            existing.id()
                                    );

                    if (changed > 0) {
                        repository
                                .cancelActiveInvestigationsForFinding(
                                        existing.id(),
                                        "Automatically cancelled because the latest anomaly scan no longer detects the underlying signal."
                                );

                        autoResolved.incrementAndGet();
                    }
                }
            }
        }

        return new AnomalyScanResponse(
                detected.get(),
                created.get(),
                refreshed.get(),
                autoResolved.get()
        );
    }

    @Transactional(readOnly = true)
    public AnomalyFindingDetailResponse finding(
            UUID currentUserId,
            UUID findingId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        AnomalyRepository.FindingRow finding =
                requireFinding(
                        findingId
                );

        return new AnomalyFindingDetailResponse(
                findingResponse(
                        finding
                ),
                repository
                        .investigationsForFinding(
                                findingId
                        )
                        .stream()
                        .map(
                                this::investigationResponse
                        )
                        .toList()
        );
    }

    public InvestigationResponse createInvestigation(
            UUID currentUserId,
            UUID findingId,
            InvestigationCreateInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertInvestigationRole(
                currentUser.getRole()
        );

        AnomalyRepository.FindingRow finding =
                requireFinding(
                        findingId
                );

        if (
                finding.status()
                        != AnomalyFindingStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open anomaly findings can enter a new investigation."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireControlUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID investigationId =
                UUID.randomUUID();

        repository.createInvestigation(
                investigationId,
                nextInvestigationNumber(),
                findingId,
                ownerId,
                input
        );

        return investigationResponse(
                requireInvestigation(
                        investigationId
                )
        );
    }

    public InvestigationResponse startInvestigation(
            UUID currentUserId,
            UUID investigationId
    ) {
        assertInvestigationRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        AnomalyRepository.InvestigationRow investigation =
                requireInvestigation(
                        investigationId
                );

        if (
                investigation.status()
                        != InvestigationStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open investigations can be started."
            );
        }

        repository.startInvestigation(
                investigationId
        );

        return investigationResponse(
                requireInvestigation(
                        investigationId
                )
        );
    }

    public InvestigationEvidenceResponse addEvidence(
            UUID currentUserId,
            UUID investigationId,
            InvestigationEvidenceInput input
    ) {
        assertInvestigationRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        AnomalyRepository.InvestigationRow investigation =
                requireInvestigation(
                        investigationId
                );

        if (
                investigation.status()
                        == InvestigationStatus.CLOSED
                ||
                investigation.status()
                        == InvestigationStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Evidence cannot be added to a closed investigation."
            );
        }

        repository.addEvidence(
                investigationId,
                input,
                currentUserId
        );

        return repository
                .evidenceForInvestigation(
                        investigationId
                )
                .stream()
                .findFirst()
                .map(
                        this::evidenceResponse
                )
                .orElseThrow();
    }

    public InvestigationResponse closeInvestigation(
            UUID currentUserId,
            UUID investigationId,
            InvestigationCloseInput input
    ) {
        assertDispositionRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        AnomalyRepository.InvestigationRow investigation =
                requireInvestigation(
                        investigationId
                );

        if (
                investigation.status()
                        != InvestigationStatus.OPEN
                &&
                investigation.status()
                        != InvestigationStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active investigations can be closed."
            );
        }

        repository.closeInvestigation(
                investigationId,
                input.note()
        );

        repository.disposeFinding(
                investigation.findingId(),
                input.disposition(),
                currentUserId,
                input.note()
        );

        return investigationResponse(
                requireInvestigation(
                        investigationId
                )
        );
    }

    public InvestigationResponse cancelInvestigation(
            UUID currentUserId,
            UUID investigationId,
            InvestigationCloseInput input
    ) {
        assertDispositionRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        AnomalyRepository.InvestigationRow investigation =
                requireInvestigation(
                        investigationId
                );

        if (
                investigation.status()
                        != InvestigationStatus.OPEN
                &&
                investigation.status()
                        != InvestigationStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active investigations can be cancelled."
            );
        }

        repository.cancelInvestigation(
                investigationId,
                input.note()
        );

        repository.reopenFindingAfterCancelledInvestigation(
                investigation.findingId()
        );

        return investigationResponse(
                requireInvestigation(
                        investigationId
                )
        );
    }

    public AnomalyRuleResponse updateRule(
            UUID currentUserId,
            long ruleId,
            AnomalyRuleUpdateInput input
    ) {
        assertDispositionRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        AnomalyRepository.RuleRow rule =
                repository.findRule(
                        ruleId
                );

        if (rule == null) {
            throw new ResourceNotFoundException(
                    "Procurement anomaly rule not found: "
                            + ruleId
            );
        }

        repository.updateRule(
                ruleId,
                input
        );

        AnomalyRepository.RuleRow updated =
                repository.findRule(
                        ruleId
                );

        if (updated == null) {
            throw new IllegalStateException(
                    "Updated anomaly rule could not be reloaded."
            );
        }

        return ruleResponse(
                updated
        );
    }

    @Transactional(readOnly = true)
    public AnomalyContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new AnomalyContextResponse(
                repository.users()
        );
    }

    private AnomalyControlSummaryResponse summary(
            String currency,
            List<AnomalyRepository.FindingRow> findings,
            List<AnomalyRepository.FindingRow> active,
            AnomalyRepository.InvestigationStats investigationStats
    ) {
        long critical =
                active.stream()
                        .filter(
                                finding ->
                                        finding.severity()
                                                == AnomalySeverity.CRITICAL
                        )
                        .count();

        long underInvestigation =
                findings.stream()
                        .filter(
                                finding ->
                                        finding.status()
                                                == AnomalyFindingStatus.UNDER_INVESTIGATION
                        )
                        .count();

        long confirmed =
                findings.stream()
                        .filter(
                                finding ->
                                        finding.status()
                                                == AnomalyFindingStatus.CONFIRMED
                        )
                        .count();

        return new AnomalyControlSummaryResponse(
                currency,
                active.size(),
                critical,
                underInvestigation,
                confirmed,
                exposure(
                        active
                ),
                exposureForSignal(
                        active,
                        AnomalySignalType.INVOICE
                ),
                exposureForRule(
                        active,
                        "OPEN_COMMERCIAL_LEAKAGE"
                ),
                countRule(
                        active,
                        "DUPLICATE_SUPPLIER_INVOICE_REFERENCE"
                ),
                countRule(
                        active,
                        "REPEATED_INVOICE_VALUE_PATTERN"
                ),
                countRule(
                        active,
                        "SPLIT_PURCHASE_INDICATOR"
                ),
                countRule(
                        active,
                        "SUPPLIER_CATEGORY_CONCENTRATION"
                ),
                countRule(
                        active,
                        "OFF_CONTRACT_BUYING"
                ),
                investigationStats.activeCases(),
                investigationStats.overdueCases(),
                repository.lastScanAt()
        );
    }

    private List<AnomalySignalSummaryResponse> signalSummaries(
            List<AnomalyRepository.FindingRow> active
    ) {
        Map<
                AnomalySignalType,
                List<AnomalyRepository.FindingRow>
        > grouped =
                new EnumMap<>(
                        AnomalySignalType.class
                );

        for (
                AnomalySignalType type
                : AnomalySignalType.values()
        ) {
            grouped.put(
                    type,
                    new ArrayList<>()
            );
        }

        for (
                AnomalyRepository.FindingRow finding
                : active
        ) {
            grouped
                    .get(
                            finding.signalType()
                    )
                    .add(
                            finding
                    );
        }

        return grouped
                .entrySet()
                .stream()
                .map(
                        entry ->
                                new AnomalySignalSummaryResponse(
                                        entry.getKey(),
                                        entry.getValue()
                                                .size(),
                                        entry.getValue()
                                                .stream()
                                                .filter(
                                                        finding ->
                                                                finding.severity()
                                                                        == AnomalySeverity.CRITICAL
                                                )
                                                .count(),
                                        exposure(
                                                entry.getValue()
                                        )
                                )
                )
                .toList();
    }

    private BigDecimal exposure(
            List<AnomalyRepository.FindingRow> findings
    ) {
        return findings.stream()
                .map(
                        AnomalyRepository.FindingRow::
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

    private BigDecimal exposureForSignal(
            List<AnomalyRepository.FindingRow> findings,
            AnomalySignalType signalType
    ) {
        return exposure(
                findings.stream()
                        .filter(
                                finding ->
                                        finding.signalType()
                                                == signalType
                        )
                        .toList()
        );
    }

    private BigDecimal exposureForRule(
            List<AnomalyRepository.FindingRow> findings,
            String ruleCode
    ) {
        return exposure(
                findings.stream()
                        .filter(
                                finding ->
                                        finding.ruleCode()
                                                .equals(
                                                        ruleCode
                                                )
                        )
                        .toList()
        );
    }

    private long countRule(
            List<AnomalyRepository.FindingRow> findings,
            String ruleCode
    ) {
        return findings.stream()
                .filter(
                        finding ->
                                finding.ruleCode()
                                        .equals(
                                                ruleCode
                                        )
                )
                .count();
    }

    private AnomalyRuleResponse ruleResponse(
            AnomalyRepository.RuleRow row
    ) {
        return new AnomalyRuleResponse(
                row.id(),
                row.ruleCode(),
                row.signalType(),
                row.title(),
                row.description(),
                row.defaultSeverity(),
                decimal(
                        row.scoreWeight()
                ),
                decimal(
                        row.thresholdValue()
                ),
                row.lookbackDays(),
                row.enabled(),
                row.activeFindings()
        );
    }

    private AnomalyFindingResponse findingResponse(
            AnomalyRepository.FindingRow row
    ) {
        return new AnomalyFindingResponse(
                row.id(),
                row.findingKey(),
                row.ruleId(),
                row.ruleCode(),
                row.signalType(),
                row.ruleTitle(),
                row.severity(),
                row.entityType(),
                row.entityId(),
                row.relatedEntityId(),
                row.entityReference(),
                row.currency(),
                moneyNullable(
                        row.exposureValue()
                ),
                decimalNullable(
                        row.metricValue()
                ),
                decimal(
                        row.anomalyScore()
                ),
                row.details(),
                row.status(),
                row.activeInvestigations(),
                row.overdueInvestigations(),
                row.detectedAt(),
                row.lastSeenAt(),
                row.dispositionNote(),
                row.disposedAt(),
                row.disposedByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private InvestigationResponse investigationResponse(
            AnomalyRepository.InvestigationRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == InvestigationStatus.OPEN
                        ||
                        row.status()
                                == InvestigationStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new InvestigationResponse(
                row.id(),
                row.caseNumber(),
                row.findingId(),
                row.ownerUserId(),
                row.ownerName(),
                row.priority(),
                row.status(),
                row.dueDate(),
                overdue,
                row.conclusion(),
                row.closedAt(),
                repository
                        .evidenceForInvestigation(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::evidenceResponse
                        )
                        .toList(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private InvestigationEvidenceResponse evidenceResponse(
            AnomalyRepository.EvidenceRow row
    ) {
        return new InvestigationEvidenceResponse(
                row.id(),
                row.investigationId(),
                row.evidenceType(),
                row.referenceText(),
                row.addedByUserId(),
                row.addedByName(),
                row.createdAt()
        );
    }

    private boolean isActiveFinding(
            AnomalyRepository.FindingRow finding
    ) {
        return finding.status()
                        == AnomalyFindingStatus.OPEN
                ||
                finding.status()
                        == AnomalyFindingStatus.UNDER_INVESTIGATION;
    }

    private String nextInvestigationNumber() {
        Long sequence =
                repository
                        .nextInvestigationSequence();

        return String.format(
                "INVEST-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private AnomalyRepository.FindingRow requireFinding(
            UUID findingId
    ) {
        AnomalyRepository.FindingRow finding =
                repository.findFinding(
                        findingId
                );

        if (finding == null) {
            throw new ResourceNotFoundException(
                    "Procurement anomaly finding not found: "
                            + findingId
            );
        }

        return finding;
    }

    private AnomalyRepository.InvestigationRow requireInvestigation(
            UUID investigationId
    ) {
        AnomalyRepository.InvestigationRow investigation =
                repository.findInvestigation(
                        investigationId
                );

        if (investigation == null) {
            throw new ResourceNotFoundException(
                    "Procurement investigation not found: "
                            + investigationId
            );
        }

        return investigation;
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

    private BigDecimal decimal(
            BigDecimal value
    ) {
        return value.setScale(
                2,
                RoundingMode.HALF_UP
        );
    }

    private BigDecimal decimalNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : decimal(
                        value
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
                    "Anomaly-control currency must contain exactly three characters."
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

    private AppUserEntity requireControlUser(
            UUID userId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        userId
                );

        if (
                user.getRole()
                        == ProcurementRole.REQUESTER
        ) {
            throw new IllegalArgumentException(
                    "Anomaly investigation ownership requires a procurement-control role."
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
                    "Your ProcureIQ role cannot access anomaly-control intelligence."
            );
        }
    }

    private void assertWriteRole(
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
                    "Your ProcureIQ role cannot execute anomaly-control scans."
            );
        }
    }

    private void assertInvestigationRole(
            ProcurementRole role
    ) {
        assertWriteRole(
                role
        );
    }

    private void assertDispositionRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can configure rules or dispose investigations."
            );
        }
    }
}
