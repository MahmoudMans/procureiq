package com.procureiq.dataquality;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Transactional
public class DataQualityService {

    private final DataQualityRepository repository;

    private final DataQualityScoringService scoringService;

    private final AppUserRepository appUserRepository;

    public DataQualityService(
            DataQualityRepository repository,
            DataQualityScoringService scoringService,
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
    public DataQualityDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<DataQualityRepository.RuleRow> rules =
                repository.rules();

        List<DataQualityRepository.FindingRow> findings =
                repository.findings();

        List<DataQualityDomainScoreResponse> domainScores =
                domainScores(
                        rules,
                        findings
                );

        DataQualityRepository.RemediationStats remediationStats =
                repository
                        .remediationStats();

        List<DataQualityRepository.FindingRow> activeFindings =
                findings.stream()
                        .filter(
                                this::isActiveFinding
                        )
                        .toList();

        long critical =
                activeFindings.stream()
                        .filter(
                                finding ->
                                        finding.severity()
                                                == DataQualitySeverity.CRITICAL
                        )
                        .count();

        long duplicates =
                activeFindings.stream()
                        .filter(
                                finding ->
                                        finding.ruleCode()
                                                .equals(
                                                        "SUPPLIER_DUPLICATE_NAME"
                                                )
                        )
                        .count();

        long inProgress =
                activeFindings.stream()
                        .filter(
                                finding ->
                                        finding.status()
                                                == DataQualityFindingStatus.REMEDIATION_IN_PROGRESS
                        )
                        .count();

        BigDecimal overallScore =
                scoringService
                        .overallScore(
                                domainScores
                                        .stream()
                                        .map(
                                                DataQualityDomainScoreResponse::
                                                        score
                                        )
                                        .toList()
                        );

        return new DataQualityDashboardResponse(
                new DataQualitySummaryResponse(
                        overallScore,
                        activeFindings.size(),
                        critical,
                        duplicates,
                        inProgress,
                        remediationStats.activeTasks(),
                        remediationStats.overdueTasks(),
                        repository.lastScanAt()
                ),
                domainScores,
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

    public DataQualityScanResponse scan(
            UUID currentUserId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<DataQualityRepository.RuleRow> rules =
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
                DataQualityRepository.RuleRow rule
                : rules
        ) {
            if (!rule.enabled()) {
                continue;
            }

            List<DataQualityRepository.FindingCandidate> candidates =
                    repository
                            .candidatesForRule(
                                    rule.ruleCode()
                            );

            detected.addAndGet(
                    candidates.size()
            );

            Set<String> currentKeys =
                    new HashSet<>();

            for (
                    DataQualityRepository.FindingCandidate candidate
                    : candidates
            ) {
                currentKeys.add(
                        candidate.findingKey()
                );

                DataQualityRepository.FindingRow existing =
                        repository
                                .findFindingByKey(
                                        candidate.findingKey()
                                );

                repository.upsertFinding(
                        existing == null
                                ? UUID.randomUUID()
                                : existing.id(),
                        rule.id(),
                        candidate
                );

                if (existing == null) {
                    created.incrementAndGet();
                } else {
                    refreshed.incrementAndGet();
                }
            }

            for (
                    DataQualityRepository.FindingRow existing
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
                    autoResolved.addAndGet(
                            repository
                                    .autoResolveFinding(
                                            existing.id(),
                                            "Automatically resolved because the latest data-quality scan no longer detects this defect."
                                    )
                    );
                }
            }
        }

        return new DataQualityScanResponse(
                detected.get(),
                created.get(),
                refreshed.get(),
                autoResolved.get()
        );
    }

    @Transactional(readOnly = true)
    public DataQualityFindingDetailResponse finding(
            UUID currentUserId,
            UUID findingId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        DataQualityRepository.FindingRow finding =
                requireFinding(
                        findingId
                );

        return new DataQualityFindingDetailResponse(
                findingResponse(
                        finding
                ),
                repository
                        .remediationsForFinding(
                                findingId
                        )
                        .stream()
                        .map(
                                this::remediationResponse
                        )
                        .toList()
        );
    }

    public DataQualityFindingResponse resolveFinding(
            UUID currentUserId,
            UUID findingId,
            DataQualityFindingDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        DataQualityRepository.FindingRow finding =
                requireFinding(
                        findingId
                );

        if (!isActiveFinding(
                finding
        )) {
            throw new IllegalArgumentException(
                    "Only open or in-progress data-quality findings can be resolved."
            );
        }

        repository.decideFinding(
                findingId,
                currentUserId,
                input.note(),
                DataQualityFindingStatus.RESOLVED
        );

        repository.cancelActiveRemediationTasks(
                findingId
        );

        return findingResponse(
                requireFinding(
                        findingId
                )
        );
    }

    public DataQualityFindingResponse dismissFinding(
            UUID currentUserId,
            UUID findingId,
            DataQualityFindingDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        DataQualityRepository.FindingRow finding =
                requireFinding(
                        findingId
                );

        if (!isActiveFinding(
                finding
        )) {
            throw new IllegalArgumentException(
                    "Only open or in-progress data-quality findings can be dismissed."
            );
        }

        repository.decideFinding(
                findingId,
                currentUserId,
                input.note(),
                DataQualityFindingStatus.DISMISSED
        );

        repository.cancelActiveRemediationTasks(
                findingId
        );

        return findingResponse(
                requireFinding(
                        findingId
                )
        );
    }

    public DataQualityRemediationResponse createRemediation(
            UUID currentUserId,
            UUID findingId,
            DataQualityRemediationInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        DataQualityRepository.FindingRow finding =
                requireFinding(
                        findingId
                );

        if (!isActiveFinding(
                finding
        )) {
            throw new IllegalArgumentException(
                    "Remediation tasks require an active data-quality finding."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireGovernanceUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID taskId =
                UUID.randomUUID();

        repository.createRemediation(
                taskId,
                findingId,
                input,
                ownerId
        );

        return remediationResponse(
                requireRemediation(
                        taskId
                )
        );
    }

    public DataQualityRemediationResponse startRemediation(
            UUID currentUserId,
            UUID taskId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        DataQualityRepository.RemediationRow task =
                requireRemediation(
                        taskId
                );

        if (
                task.status()
                        != DataQualityRemediationStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open remediation tasks can be started."
            );
        }

        repository.startRemediation(
                taskId
        );

        return remediationResponse(
                requireRemediation(
                        taskId
                )
        );
    }

    public DataQualityRemediationResponse completeRemediation(
            UUID currentUserId,
            UUID taskId,
            DataQualityRemediationCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        DataQualityRepository.RemediationRow task =
                requireRemediation(
                        taskId
                );

        if (
                task.status()
                        != DataQualityRemediationStatus.OPEN
                &&
                task.status()
                        != DataQualityRemediationStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only open or in-progress remediation tasks can be completed."
            );
        }

        repository.completeRemediation(
                taskId,
                input.note()
        );

        return remediationResponse(
                requireRemediation(
                        taskId
                )
        );
    }

    public DataQualityRemediationResponse cancelRemediation(
            UUID currentUserId,
            UUID taskId
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        DataQualityRepository.RemediationRow task =
                requireRemediation(
                        taskId
                );

        if (
                task.status()
                        == DataQualityRemediationStatus.COMPLETED
        ) {
            throw new IllegalArgumentException(
                    "Completed remediation tasks cannot be cancelled."
            );
        }

        repository.cancelRemediation(
                taskId
        );

        repository.reopenFindingWhenNoActiveTask(
                task.findingId()
        );

        return remediationResponse(
                requireRemediation(
                        taskId
                )
        );
    }

    public DataQualityRuleResponse updateRule(
            UUID currentUserId,
            long ruleId,
            DataQualityRuleUpdateInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        DataQualityRepository.RuleRow existing =
                repository
                        .findRule(
                                ruleId
                        );

        if (existing == null) {
            throw new ResourceNotFoundException(
                    "Data-quality rule not found: "
                            + ruleId
            );
        }

        repository.updateRule(
                ruleId,
                input
        );

        DataQualityRepository.RuleRow updated =
                repository
                        .findRule(
                                ruleId
                        );

        if (updated == null) {
            throw new IllegalStateException(
                    "Updated data-quality rule could not be reloaded."
            );
        }

        return ruleResponse(
                updated
        );
    }

    @Transactional(readOnly = true)
    public DataQualityContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new DataQualityContextResponse(
                repository.users()
        );
    }

    private List<DataQualityDomainScoreResponse> domainScores(
            List<DataQualityRepository.RuleRow> rules,
            List<DataQualityRepository.FindingRow> findings
    ) {
        Map<
                DataQualityDomain,
                BigDecimal
        > enabledWeight =
                new EnumMap<>(
                        DataQualityDomain.class
                );

        Map<
                DataQualityDomain,
                BigDecimal
        > affectedWeight =
                new EnumMap<>(
                        DataQualityDomain.class
                );

        Map<
                DataQualityDomain,
                Long
        > enabledRules =
                new EnumMap<>(
                        DataQualityDomain.class
                );

        Map<
                DataQualityDomain,
                Set<Long>
        > affectedRules =
                new EnumMap<>(
                        DataQualityDomain.class
                );

        Map<
                DataQualityDomain,
                Long
        > openFindings =
                new EnumMap<>(
                        DataQualityDomain.class
                );

        for (
                DataQualityDomain domain
                : DataQualityDomain.values()
        ) {
            enabledWeight.put(
                    domain,
                    BigDecimal.ZERO
            );

            affectedWeight.put(
                    domain,
                    BigDecimal.ZERO
            );

            enabledRules.put(
                    domain,
                    0L
            );

            affectedRules.put(
                    domain,
                    new HashSet<>()
            );

            openFindings.put(
                    domain,
                    0L
            );
        }

        Map<
                Long,
                DataQualityRepository.RuleRow
        > ruleById =
                new java.util.HashMap<>();

        for (
                DataQualityRepository.RuleRow rule
                : rules
        ) {
            ruleById.put(
                    rule.id(),
                    rule
            );

            if (!rule.enabled()) {
                continue;
            }

            enabledWeight.merge(
                    rule.domain(),
                    rule.weight(),
                    BigDecimal::add
            );

            enabledRules.merge(
                    rule.domain(),
                    1L,
                    Long::sum
            );
        }

        for (
                DataQualityRepository.FindingRow finding
                : findings
        ) {
            if (!isActiveFinding(
                    finding
            )) {
                continue;
            }

            DataQualityRepository.RuleRow rule =
                    ruleById.get(
                            finding.ruleId()
                    );

            if (
                    rule == null
                    ||
                    !rule.enabled()
            ) {
                continue;
            }

            openFindings.merge(
                    rule.domain(),
                    1L,
                    Long::sum
            );

            affectedRules
                    .get(
                            rule.domain()
                    )
                    .add(
                            rule.id()
                    );
        }

        for (
                DataQualityDomain domain
                : DataQualityDomain.values()
        ) {
            BigDecimal totalAffectedWeight =
                    affectedRules
                            .get(
                                    domain
                            )
                            .stream()
                            .map(
                                    ruleById::get
                            )
                            .filter(
                                    java.util.Objects::nonNull
                            )
                            .map(
                                    DataQualityRepository.RuleRow::
                                            weight
                            )
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            );

            affectedWeight.put(
                    domain,
                    totalAffectedWeight
            );
        }

        List<DataQualityDomainScoreResponse> result =
                new ArrayList<>();

        for (
                DataQualityDomain domain
                : DataQualityDomain.values()
        ) {
            result.add(
                    new DataQualityDomainScoreResponse(
                            domain,
                            enabledRules.get(
                                    domain
                            ),
                            affectedRules
                                    .get(
                                            domain
                                    )
                                    .size(),
                            openFindings.get(
                                    domain
                            ),
                            scoringService
                                    .domainScore(
                                            enabledWeight.get(
                                                    domain
                                            ),
                                            affectedWeight.get(
                                                    domain
                                            )
                                    )
                    )
            );
        }

        return List.copyOf(
                result
        );
    }

    private DataQualityRuleResponse ruleResponse(
            DataQualityRepository.RuleRow row
    ) {
        return new DataQualityRuleResponse(
                row.id(),
                row.ruleCode(),
                row.domain(),
                row.title(),
                row.description(),
                row.severity(),
                row.weight()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                row.enabled(),
                row.activeFindings()
        );
    }

    private DataQualityFindingResponse findingResponse(
            DataQualityRepository.FindingRow row
    ) {
        return new DataQualityFindingResponse(
                row.id(),
                row.findingKey(),
                row.ruleId(),
                row.ruleCode(),
                row.domain(),
                row.ruleTitle(),
                row.severity(),
                row.entityType(),
                row.entityId(),
                row.relatedEntityId(),
                row.entityReference(),
                row.details(),
                row.status(),
                row.openRemediationTasks(),
                row.overdueRemediationTasks(),
                row.detectedAt(),
                row.lastSeenAt(),
                row.resolutionNote(),
                row.resolvedAt(),
                row.resolvedByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private DataQualityRemediationResponse remediationResponse(
            DataQualityRepository.RemediationRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == DataQualityRemediationStatus.OPEN
                        ||
                        row.status()
                                == DataQualityRemediationStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new DataQualityRemediationResponse(
                row.id(),
                row.findingId(),
                row.title(),
                row.ownerUserId(),
                row.ownerName(),
                row.dueDate(),
                row.status(),
                overdue,
                row.completionNote(),
                row.completedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private boolean isActiveFinding(
            DataQualityRepository.FindingRow finding
    ) {
        return finding.status()
                        == DataQualityFindingStatus.OPEN
                ||
                finding.status()
                        == DataQualityFindingStatus.REMEDIATION_IN_PROGRESS;
    }

    private DataQualityRepository.FindingRow requireFinding(
            UUID findingId
    ) {
        DataQualityRepository.FindingRow finding =
                repository
                        .findFinding(
                                findingId
                        );

        if (finding == null) {
            throw new ResourceNotFoundException(
                    "Data-quality finding not found: "
                            + findingId
            );
        }

        return finding;
    }

    private DataQualityRepository.RemediationRow requireRemediation(
            UUID taskId
    ) {
        DataQualityRepository.RemediationRow task =
                repository
                        .findRemediation(
                                taskId
                        );

        if (task == null) {
            throw new ResourceNotFoundException(
                    "Data-quality remediation task not found: "
                            + taskId
            );
        }

        return task;
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

    private AppUserEntity requireGovernanceUser(
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
                    "Data-quality remediation ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access data-quality governance."
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
                    "Your ProcureIQ role cannot manage data-quality remediation."
            );
        }
    }

    private void assertApprovalRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can dismiss findings or configure data-quality rules."
            );
        }
    }
}
