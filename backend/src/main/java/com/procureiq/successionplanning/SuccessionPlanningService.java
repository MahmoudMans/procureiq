package com.procureiq.successionplanning;

import com.procureiq.capacityplanning.CapacityMemberResponse;
import com.procureiq.capacityplanning.CapacityPlanningDashboardResponse;
import com.procureiq.capacityplanning.CapacityPlanningService;
import com.procureiq.capabilityplanning.CapabilityDevelopmentActionResponse;
import com.procureiq.capabilityplanning.CapabilityPlanningDashboardResponse;
import com.procureiq.capabilityplanning.CapabilityPlanningService;
import com.procureiq.capabilityplanning.CapabilitySkillResponse;
import com.procureiq.capabilityplanning.CapabilityWorkItemResponse;
import com.procureiq.capabilityplanning.UserCapabilityResponse;
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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class SuccessionPlanningService {

    private final SuccessionPlanningRepository repository;

    private final SuccessionPlanningMathService mathService;

    private final CapabilityPlanningService capabilityPlanningService;

    private final CapacityPlanningService capacityPlanningService;

    private final AppUserRepository appUserRepository;

    public SuccessionPlanningService(
            SuccessionPlanningRepository repository,
            SuccessionPlanningMathService mathService,
            CapabilityPlanningService capabilityPlanningService,
            CapacityPlanningService capacityPlanningService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.capabilityPlanningService =
                capabilityPlanningService;

        this.capacityPlanningService =
                capacityPlanningService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public SuccessionPlanningDashboardResponse dashboard(
            UUID currentUserId,
            String currency,
            int fiscalYear
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

        Context context =
                context(
                        currentUserId,
                        normalizedCurrency,
                        fiscalYear
                );

        List<SuccessionPolicyResponse> policies =
                repository
                        .policies(
                                normalizedCurrency,
                                fiscalYear
                        )
                        .stream()
                        .map(
                                policy ->
                                        policyResponse(
                                                policy,
                                                context
                                        )
                        )
                        .toList();

        SuccessionSummaryResponse summary =
                summary(
                        policies,
                        repository
                                .candidatesForScope(
                                        normalizedCurrency,
                                        fiscalYear
                                )
                );

        return new SuccessionPlanningDashboardResponse(
                normalizedCurrency,
                fiscalYear,
                summary,
                context.capacity()
                        .users(),
                context.capability()
                        .skills(),
                policies,
                repository
                        .snapshots(
                                normalizedCurrency,
                                fiscalYear
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public SuccessionPolicyDetailResponse createPolicy(
            UUID currentUserId,
            String currency,
            int fiscalYear,
            CriticalCapabilityPolicyInput input
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

        CapabilityPlanningDashboardResponse capability =
                capabilityPlanningService
                        .dashboard(
                                currentUserId,
                                normalizedCurrency,
                                fiscalYear
                        );

        boolean skillExists =
                capability
                        .skills()
                        .stream()
                        .anyMatch(
                                skill ->
                                        skill.id()
                                                .equals(
                                                        input.skillId()
                                                )
                        );

        if (!skillExists) {
            throw new IllegalArgumentException(
                    "Selected skill is not active in Step 48 capability planning."
            );
        }

        UUID policyId =
                UUID.randomUUID();

        repository.createPolicy(
                policyId,
                normalizedCurrency,
                fiscalYear,
                input,
                currentUserId
        );

        return policy(
                currentUserId,
                policyId
        );
    }

    @Transactional(readOnly = true)
    public SuccessionPolicyDetailResponse policy(
            UUID currentUserId,
            UUID policyId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SuccessionPlanningRepository.PolicyRow policy =
                requirePolicy(
                        policyId
                );

        Context context =
                context(
                        currentUserId,
                        policy.currency(),
                        policy.fiscalYear()
                );

        return new SuccessionPolicyDetailResponse(
                policyResponse(
                        policy,
                        context
                ),
                impactedWorkItems(
                        policy,
                        context.capability()
                ),
                repository
                        .candidatesForPolicy(
                                policyId
                        )
                        .stream()
                        .map(
                                candidate ->
                                        candidateResponse(
                                                candidate,
                                                context
                                        )
                        )
                        .toList()
        );
    }

    public SuccessionCandidateResponse nominateCandidate(
            UUID currentUserId,
            UUID policyId,
            SuccessionCandidateInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SuccessionPlanningRepository.PolicyRow policy =
                requirePolicy(
                        policyId
                );

        requireSuccessionUser(
                input.userId()
        );

        if (
                input.targetDate()
                        != null
                &&
                input.targetDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Succession target date cannot be in the past."
            );
        }

        UUID candidateId =
                UUID.randomUUID();

        repository.createCandidate(
                candidateId,
                policy.id(),
                input,
                currentUserId
        );

        Context context =
                context(
                        currentUserId,
                        policy.currency(),
                        policy.fiscalYear()
                );

        return candidateResponse(
                requireCandidate(
                        candidateId
                ),
                context
        );
    }

    public SuccessionCandidateResponse startCandidateDevelopment(
            UUID currentUserId,
            UUID candidateId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SuccessionPlanningRepository.CandidateRow candidate =
                requireCandidate(
                        candidateId
                );

        if (
                candidate.status()
                        != SuccessionCandidateStatus.IDENTIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only identified succession candidates can enter development."
            );
        }

        repository.startCandidateDevelopment(
                candidateId
        );

        candidate =
                requireCandidate(
                        candidateId
                );

        return candidateResponse(
                candidate,
                context(
                        currentUserId,
                        candidate.currency(),
                        candidate.fiscalYear()
                )
        );
    }

    public SuccessionCandidateResponse markCandidateReady(
            UUID currentUserId,
            UUID candidateId,
            SuccessionNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SuccessionPlanningRepository.CandidateRow candidate =
                requireCandidate(
                        candidateId
                );

        if (
                candidate.status()
                        != SuccessionCandidateStatus.IDENTIFIED
                &&
                candidate.status()
                        != SuccessionCandidateStatus.DEVELOPING
        ) {
            throw new IllegalArgumentException(
                    "Only active succession candidates can be marked ready."
            );
        }

        Context context =
                context(
                        currentUserId,
                        candidate.currency(),
                        candidate.fiscalYear()
                );

        SuccessionCandidateResponse evaluated =
                candidateResponse(
                        candidate,
                        context
                );

        if (
                evaluated.readiness()
                        != SuccessionCandidateReadiness.READY
        ) {
            throw new IllegalArgumentException(
                    "Candidate cannot be marked ready until the recorded proficiency meets the governed critical-capability requirement."
            );
        }

        repository.markCandidateReady(
                candidateId,
                input.note()
        );

        return candidateResponse(
                requireCandidate(
                        candidateId
                ),
                context
        );
    }

    public SuccessionCandidateResponse declineCandidate(
            UUID currentUserId,
            UUID candidateId,
            SuccessionNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SuccessionPlanningRepository.CandidateRow candidate =
                requireCandidate(
                        candidateId
                );

        if (
                candidate.status()
                        != SuccessionCandidateStatus.IDENTIFIED
                &&
                candidate.status()
                        != SuccessionCandidateStatus.DEVELOPING
        ) {
            throw new IllegalArgumentException(
                    "Only active succession candidates can be declined."
            );
        }

        repository.declineCandidate(
                candidateId,
                input.note()
        );

        return candidateResponse(
                requireCandidate(
                        candidateId
                ),
                context(
                        currentUserId,
                        candidate.currency(),
                        candidate.fiscalYear()
                )
        );
    }

    public SuccessionSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            String currency,
            int fiscalYear
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SuccessionPlanningDashboardResponse dashboard =
                dashboard(
                        currentUserId,
                        currency,
                        fiscalYear
                );

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                dashboard.currency(),
                dashboard.fiscalYear(),
                dashboard.summary(),
                currentUserId
        );

        Context context =
                context(
                        currentUserId,
                        dashboard.currency(),
                        dashboard.fiscalYear()
                );

        for (
                SuccessionPolicyResponse policy
                : dashboard.policies()
        ) {
            repository.createSnapshotPolicy(
                    snapshotId,
                    policy
            );

            for (
                    SuccessionPlanningRepository.CandidateRow candidate
                    : repository
                            .candidatesForPolicy(
                                    policy.id()
                            )
            ) {
                repository.createSnapshotCandidate(
                        snapshotId,
                        candidateResponse(
                                candidate,
                                context
                        )
                );
            }
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    @Transactional(readOnly = true)
    public SuccessionSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SuccessionPlanningRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Succession snapshot not found: "
                            + snapshotId
            );
        }

        return new SuccessionSnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),
                summaryFromSnapshot(
                        snapshot
                ),
                repository
                        .snapshotPolicies(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotPolicyResponse
                        )
                        .toList(),
                repository
                        .snapshotCandidates(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotCandidateResponse
                        )
                        .toList()
        );
    }

    private Context context(
            UUID currentUserId,
            String currency,
            int fiscalYear
    ) {
        return new Context(
                capabilityPlanningService
                        .dashboard(
                                currentUserId,
                                currency,
                                fiscalYear
                        ),
                capacityPlanningService
                        .dashboard(
                                currentUserId,
                                currency,
                                fiscalYear
                        )
        );
    }

    private SuccessionPolicyResponse policyResponse(
            SuccessionPlanningRepository.PolicyRow policy,
            Context context
    ) {
        List<CapabilityWorkItemResponse> impacted =
                impactedWorkItems(
                        policy,
                        context.capability()
                );

        Set<UUID> assignedMembers =
                impacted.stream()
                        .flatMap(
                                work ->
                                        work.assignedUserIds()
                                                .stream()
                        )
                        .collect(
                                Collectors.toCollection(
                                        HashSet::new
                                )
                        );

        Map<UUID, Integer> proficiency =
                context
                        .capability()
                        .userCapabilities()
                        .stream()
                        .filter(
                                capability ->
                                        capability.skillId()
                                                .equals(
                                                        policy.skillId()
                                                )
                        )
                        .collect(
                                Collectors.toMap(
                                        UserCapabilityResponse::
                                                userId,
                                        UserCapabilityResponse::
                                                proficiencyLevel,
                                        Math::max
                                )
                        );

        Set<UUID> readyPeople =
                proficiency.entrySet()
                        .stream()
                        .filter(
                                entry ->
                                        entry.getValue()
                                                >=
                                                policy.requiredProficiency()
                        )
                        .map(
                                Map.Entry::getKey
                        )
                        .collect(
                                Collectors.toSet()
                        );

        int readyBench =
                (
                        int
                ) readyPeople.stream()
                        .filter(
                                userId ->
                                        !assignedMembers
                                                .contains(
                                                        userId
                                                )
                        )
                        .count();

        List<SuccessionPlanningRepository.CandidateRow> candidates =
                repository
                        .candidatesForPolicy(
                                policy.id()
                        );

        int readyCandidateCount =
                (
                        int
                ) candidates.stream()
                        .filter(
                                candidate ->
                                        candidate.status()
                                                == SuccessionCandidateStatus.READY
                        )
                        .count();

        boolean singlePointFailure =
                !impacted.isEmpty()
                &&
                readyPeople.size()
                        <= 1;

        SuccessionPolicyScore score =
                mathService
                        .policyScore(
                                policy.criticality(),
                                policy.targetReadyPeople(),
                                readyPeople.size(),
                                singlePointFailure
                        );

        return new SuccessionPolicyResponse(
                policy.id(),
                policy.currency(),
                policy.fiscalYear(),
                policy.skillId(),
                policy.skillCode(),
                policy.skillName(),
                policy.skillCategory(),
                policy.criticality(),
                policy.requiredProficiency(),
                policy.targetReadyPeople(),
                policy.notes(),
                impacted.size(),
                assignedMembers.size(),
                readyPeople.size(),
                readyBench,
                candidates.size(),
                readyCandidateCount,
                singlePointFailure,
                score.coveragePct(),
                score.policyScore(),
                score.health(),
                policy.version()
        );
    }

    private SuccessionCandidateResponse candidateResponse(
            SuccessionPlanningRepository.CandidateRow candidate,
            Context context
    ) {
        int proficiency =
                context
                        .capability()
                        .userCapabilities()
                        .stream()
                        .filter(
                                capability ->
                                        capability.userId()
                                                .equals(
                                                        candidate.userId()
                                                )
                                        &&
                                        capability.skillId()
                                                .equals(
                                                        candidate.skillId()
                                                )
                        )
                        .map(
                                UserCapabilityResponse::
                                        proficiencyLevel
                        )
                        .findFirst()
                        .orElse(
                                0
                        );

        BigDecimal utilization =
                context
                        .capacity()
                        .members()
                        .stream()
                        .filter(
                                member ->
                                        member.userId()
                                                .equals(
                                                        candidate.userId()
                                                )
                        )
                        .map(
                                CapacityMemberResponse::
                                        utilizationPct
                        )
                        .findFirst()
                        .orElse(
                                new BigDecimal(
                                        "999.99"
                                )
                        );

        int openDevelopmentActions =
                (
                        int
                ) context
                        .capability()
                        .developmentActions()
                        .stream()
                        .filter(
                                action ->
                                        action.userId()
                                                .equals(
                                                        candidate.userId()
                                                )
                                        &&
                                        action.skillId()
                                                .equals(
                                                        candidate.skillId()
                                                )
                                        &&
                                        (
                                                action.status()
                                                        .name()
                                                        .equals(
                                                                "PLANNED"
                                                        )
                                                ||
                                                action.status()
                                                        .name()
                                                        .equals(
                                                                "IN_PROGRESS"
                                                        )
                                        )
                        )
                        .count();

        return new SuccessionCandidateResponse(
                candidate.id(),
                candidate.policyId(),
                candidate.userId(),
                candidate.userName(),
                candidate.role(),
                candidate.status(),
                proficiency,
                mathService
                        .proficiencyFit(
                                candidate.requiredProficiency(),
                                proficiency
                        ),
                mathService
                        .decimal(
                                utilization
                        ),
                mathService
                        .candidateEvidenceScore(
                                candidate.requiredProficiency(),
                                proficiency,
                                utilization
                        ),
                mathService
                        .candidateReadiness(
                                candidate.requiredProficiency(),
                                proficiency
                        ),
                openDevelopmentActions,
                candidate.rationale(),
                candidate.targetDate(),
                candidate.decisionNote(),
                candidate.version()
        );
    }

    private List<CapabilityWorkItemResponse> impactedWorkItems(
            SuccessionPlanningRepository.PolicyRow policy,
            CapabilityPlanningDashboardResponse capability
    ) {
        return capability
                .workItems()
                .stream()
                .filter(
                        work ->
                                work.requirements()
                                        .stream()
                                        .anyMatch(
                                                requirement ->
                                                        requirement.skillId()
                                                                .equals(
                                                                        policy.skillId()
                                                                )
                                        )
                )
                .toList();
    }

    private SuccessionSummaryResponse summary(
            List<SuccessionPolicyResponse> policies,
            List<SuccessionPlanningRepository.CandidateRow> candidates
    ) {
        int covered =
                (
                        int
                ) policies.stream()
                        .filter(
                                policy ->
                                        policy.readyPeopleCount()
                                                >=
                                                policy.targetReadyPeople()
                        )
                        .count();

        int exposed =
                (
                        int
                ) policies.stream()
                        .filter(
                                policy ->
                                        policy.readyPeopleCount()
                                                <
                                                policy.targetReadyPeople()
                        )
                        .count();

        int criticalExposure =
                (
                        int
                ) policies.stream()
                        .filter(
                                policy ->
                                        policy.criticality()
                                                == SuccessionCriticality.CRITICAL
                                        &&
                                        policy.readyPeopleCount()
                                                <
                                                policy.targetReadyPeople()
                        )
                        .count();

        int singlePoint =
                (
                        int
                ) policies.stream()
                        .filter(
                                SuccessionPolicyResponse::
                                        singlePointFailure
                        )
                        .count();

        int readyCandidates =
                (
                        int
                ) candidates.stream()
                        .filter(
                                candidate ->
                                        candidate.status()
                                                == SuccessionCandidateStatus.READY
                        )
                        .count();

        BigDecimal averageReady =
                policies.isEmpty()
                        ? BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                )
                        : BigDecimal
                                .valueOf(
                                        policies.stream()
                                                .mapToInt(
                                                        SuccessionPolicyResponse::
                                                                readyPeopleCount
                                                )
                                                .sum()
                                )
                                .divide(
                                        BigDecimal.valueOf(
                                                policies.size()
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        SuccessionPortfolioScore score =
                mathService
                        .portfolioScore(
                                policies.size(),
                                covered,
                                policies.stream()
                                        .map(
                                                SuccessionPolicyResponse::
                                                        policyScore
                                        )
                                        .toList(),
                                singlePoint,
                                criticalExposure
                        );

        return new SuccessionSummaryResponse(
                policies.size(),
                covered,
                exposed,
                criticalExposure,
                singlePoint,
                candidates.size(),
                readyCandidates,
                averageReady,
                score.policyCoveragePct(),
                score.averagePolicyScore(),
                score.successionScore(),
                score.health()
        );
    }

    private SuccessionSnapshotSummaryResponse snapshotSummary(
            SuccessionPlanningRepository.SnapshotRow row
    ) {
        return new SuccessionSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.currency(),
                row.fiscalYear(),
                mathService
                        .decimal(
                                row.successionScore()
                        ),
                row.successionHealth(),
                row.singlePointFailureCount(),
                row.criticalExposureCount(),
                row.readyCandidateCount(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private SuccessionSummaryResponse summaryFromSnapshot(
            SuccessionPlanningRepository.SnapshotRow row
    ) {
        return new SuccessionSummaryResponse(
                row.policyCount(),
                row.coveredPolicyCount(),
                row.exposedPolicyCount(),
                row.criticalExposureCount(),
                row.singlePointFailureCount(),
                row.nominatedCandidateCount(),
                row.readyCandidateCount(),
                mathService
                        .decimal(
                                row.averageReadyPeople()
                        ),
                mathService
                        .decimal(
                                row.policyCoveragePct()
                        ),
                mathService
                        .decimal(
                                row.averagePolicyScore()
                        ),
                mathService
                        .decimal(
                                row.successionScore()
                        ),
                row.successionHealth()
        );
    }

    private SuccessionPolicyResponse snapshotPolicyResponse(
            SuccessionPlanningRepository.SnapshotPolicyRow row
    ) {
        return new SuccessionPolicyResponse(
                row.policyId(),
                "",
                0,
                row.skillId(),
                row.skillCode(),
                row.skillName(),
                row.skillCategory(),
                row.criticality(),
                row.requiredProficiency(),
                row.targetReadyPeople(),
                null,
                row.strategicWorkCount(),
                row.assignedMemberCount(),
                row.readyPeopleCount(),
                row.readyBenchCount(),
                row.nominatedCandidateCount(),
                row.readyCandidateCount(),
                row.singlePointFailure(),
                mathService
                        .decimal(
                                row.coveragePct()
                        ),
                mathService
                        .decimal(
                                row.policyScore()
                        ),
                row.health(),
                0
        );
    }

    private SuccessionCandidateResponse snapshotCandidateResponse(
            SuccessionPlanningRepository.SnapshotCandidateRow row
    ) {
        return new SuccessionCandidateResponse(
                row.candidateId(),
                row.policyId(),
                row.userId(),
                row.userName(),
                row.role(),
                row.status(),
                row.currentProficiency(),
                mathService
                        .decimal(
                                row.proficiencyFitPct()
                        ),
                mathService
                        .decimal(
                                row.capacityUtilizationPct()
                        ),
                mathService
                        .decimal(
                                row.evidenceScore()
                        ),
                row.readiness(),
                row.openDevelopmentActionCount(),
                "",
                row.targetDate(),
                null,
                0
        );
    }

    private SuccessionPlanningRepository.PolicyRow requirePolicy(
            UUID policyId
    ) {
        SuccessionPlanningRepository.PolicyRow policy =
                repository
                        .findPolicy(
                                policyId
                        );

        if (
                policy == null
                ||
                !policy.active()
        ) {
            throw new ResourceNotFoundException(
                    "Critical-capability policy not found: "
                            + policyId
            );
        }

        return policy;
    }

    private SuccessionPlanningRepository.CandidateRow requireCandidate(
            UUID candidateId
    ) {
        SuccessionPlanningRepository.CandidateRow candidate =
                repository
                        .findCandidate(
                                candidateId
                        );

        if (candidate == null) {
            throw new ResourceNotFoundException(
                    "Succession candidate not found: "
                            + candidateId
            );
        }

        return candidate;
    }

    private AppUserEntity requireSuccessionUser(
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
                    "Requester accounts cannot be nominated for procurement succession."
            );
        }

        return user;
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
                                                "ProcureIQ user not found: "
                                                        + userId
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private String nextSnapshotNumber() {
        return String.format(
                "SUCCESSION-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextSnapshotSequence()
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
                    "Succession-planning currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
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
                    "Your ProcureIQ role cannot access succession planning."
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
                    "Your ProcureIQ role cannot manage succession planning."
            );
        }
    }

    private void assertFinalizeRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can finalize succession-candidate decisions."
            );
        }
    }

    private record Context(
            CapabilityPlanningDashboardResponse capability,
            CapacityPlanningDashboardResponse capacity
    ) {
    }
}
