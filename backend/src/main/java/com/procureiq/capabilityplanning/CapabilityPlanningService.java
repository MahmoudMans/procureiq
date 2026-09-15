package com.procureiq.capabilityplanning;

import com.procureiq.capacityplanning.CapacityAssignmentResponse;
import com.procureiq.capacityplanning.CapacityMemberResponse;
import com.procureiq.capacityplanning.CapacityPlanningDashboardResponse;
import com.procureiq.capacityplanning.CapacityPlanningService;
import com.procureiq.capacityplanning.CapacityWorkItemResponse;
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
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class CapabilityPlanningService {

    private final CapabilityPlanningRepository repository;

    private final CapabilityPlanningMathService mathService;

    private final CapacityPlanningService capacityPlanningService;

    private final AppUserRepository appUserRepository;

    public CapabilityPlanningService(
            CapabilityPlanningRepository repository,
            CapabilityPlanningMathService mathService,
            CapacityPlanningService capacityPlanningService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.capacityPlanningService =
                capacityPlanningService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public CapabilityPlanningDashboardResponse dashboard(
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

        CapacityPlanningDashboardResponse capacity =
                capacityPlanningService
                        .dashboard(
                                currentUserId,
                                normalizedCurrency,
                                fiscalYear
                        );

        List<CapabilityPlanningRepository.SkillRow> skills =
                repository.skills();

        List<CapabilityPlanningRepository.UserCapabilityRow> capabilities =
                repository.capabilities();

        List<CapabilityPlanningRepository.RequirementRow> requirements =
                repository
                        .requirements(
                                normalizedCurrency,
                                fiscalYear
                        );

        List<CapabilityPlanningRepository.DevelopmentActionRow> actions =
                repository
                        .developmentActions(
                                fiscalYear
                        );

        Map<UserSkillKey, Integer> proficiency =
                capabilities.stream()
                        .collect(
                                Collectors.toMap(
                                        row ->
                                                new UserSkillKey(
                                                        row.userId(),
                                                        row.skillId()
                                                ),
                                        CapabilityPlanningRepository.UserCapabilityRow::
                                                proficiencyLevel
                                )
                        );

        Map<SourceKey, List<CapabilityPlanningRepository.RequirementRow>> requirementMap =
                requirements.stream()
                        .collect(
                                Collectors.groupingBy(
                                        row ->
                                                new SourceKey(
                                                        row.sourceType(),
                                                        row.sourceEntityId()
                                                )
                                )
                        );

        Set<UUID> benchUsers =
                capacity
                        .members()
                        .stream()
                        .map(
                                CapacityMemberResponse::
                                        userId
                        )
                        .collect(
                                Collectors.toSet()
                        );

        List<CapabilityWorkItemResponse> workItems =
                capacity
                        .workItems()
                        .stream()
                        .map(
                                item ->
                                        workItem(
                                                item,
                                                requirementMap
                                                        .getOrDefault(
                                                                new SourceKey(
                                                                        CapabilitySourceType.valueOf(
                                                                                item.sourceType()
                                                                                        .name()
                                                                        ),
                                                                        item.sourceEntityId()
                                                                ),
                                                                List.of()
                                                        ),
                                                proficiency,
                                                benchUsers
                                        )
                        )
                        .toList();

        List<CapabilityMemberResponse> members =
                memberResponses(
                        capacity,
                        capabilities,
                        workItems,
                        requirements,
                        proficiency,
                        actions
                );

        CapabilitySummaryResponse summary =
                summary(
                        skills,
                        members,
                        workItems,
                        actions
                );

        return new CapabilityPlanningDashboardResponse(
                normalizedCurrency,
                fiscalYear,
                summary,
                capacity.users(),
                skills.stream()
                        .map(
                                this::skillResponse
                        )
                        .toList(),
                capabilities.stream()
                        .map(
                                this::userCapabilityResponse
                        )
                        .toList(),
                members,
                workItems,
                actions.stream()
                        .map(
                                this::developmentActionResponse
                        )
                        .toList(),
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

    public CapabilitySkillResponse createSkill(
            UUID currentUserId,
            CapabilitySkillInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        UUID skillId =
                UUID.randomUUID();

        repository.createSkill(
                skillId,
                input,
                currentUserId
        );

        return skillResponse(
                requireSkill(
                        skillId
                )
        );
    }

    public UserCapabilityResponse assessCapability(
            UUID currentUserId,
            UUID userId,
            UUID skillId,
            UserCapabilityInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireCapabilityUser(
                userId
        );

        requireSkill(
                skillId
        );

        repository.upsertUserCapability(
                UUID.randomUUID(),
                userId,
                skillId,
                input,
                currentUserId
        );

        return repository
                .capabilities()
                .stream()
                .filter(
                        capability ->
                                capability.userId()
                                        .equals(
                                                userId
                                        )
                                &&
                                capability.skillId()
                                        .equals(
                                                skillId
                                        )
                )
                .findFirst()
                .map(
                        this::userCapabilityResponse
                )
                .orElseThrow();
    }

    @Transactional(readOnly = true)
    public CapabilityWorkItemResponse workItem(
            UUID currentUserId,
            String currency,
            int fiscalYear,
            CapabilitySourceType sourceType,
            UUID sourceEntityId
    ) {
        CapabilityPlanningDashboardResponse dashboard =
                dashboard(
                        currentUserId,
                        currency,
                        fiscalYear
                );

        return dashboard
                .workItems()
                .stream()
                .filter(
                        item ->
                                item.sourceType()
                                        == sourceType
                                &&
                                item.sourceEntityId()
                                        .equals(
                                                sourceEntityId
                                        )
                )
                .findFirst()
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Strategic work item not found in capability portfolio."
                                )
                );
    }

    public CapabilityWorkItemResponse createRequirement(
            UUID currentUserId,
            String currency,
            int fiscalYear,
            CapabilitySourceType sourceType,
            UUID sourceEntityId,
            WorkCapabilityRequirementInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireSkill(
                input.skillId()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        CapacityPlanningDashboardResponse capacity =
                capacityPlanningService
                        .dashboard(
                                currentUserId,
                                normalizedCurrency,
                                fiscalYear
                        );

        CapacityWorkItemResponse source =
                capacity
                        .workItems()
                        .stream()
                        .filter(
                                item ->
                                        item.sourceType()
                                                .name()
                                                .equals(
                                                        sourceType.name()
                                                )
                                        &&
                                        item.sourceEntityId()
                                                .equals(
                                                        sourceEntityId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Selected work item is not present in the Step 47 capacity portfolio."
                                        )
                        );

        repository.createRequirement(
                UUID.randomUUID(),
                normalizedCurrency,
                fiscalYear,
                sourceType,
                sourceEntityId,
                source.sourceReference(),
                source.sourceTitle(),
                source.sourceStatus(),
                input,
                currentUserId
        );

        return workItem(
                currentUserId,
                normalizedCurrency,
                fiscalYear,
                sourceType,
                sourceEntityId
        );
    }

    public void deleteRequirement(
            UUID currentUserId,
            UUID requirementId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .findRequirement(
                                requirementId
                        )
                == null
        ) {
            throw new ResourceNotFoundException(
                    "Capability requirement not found: "
                            + requirementId
            );
        }

        repository.deleteRequirement(
                requirementId
        );
    }

    public CapabilityDevelopmentActionResponse createDevelopmentAction(
            UUID currentUserId,
            int fiscalYear,
            CapabilityDevelopmentActionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireCapabilityUser(
                input.userId()
        );

        CapabilityPlanningRepository.SkillRow skill =
                requireSkill(
                        input.skillId()
                );

        if (
                input.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Capability-development due date cannot be in the past."
            );
        }

        int currentLevel =
                repository
                        .capabilities()
                        .stream()
                        .filter(
                                capability ->
                                        capability.userId()
                                                .equals(
                                                        input.userId()
                                                )
                                        &&
                                        capability.skillId()
                                                .equals(
                                                        skill.id()
                                                )
                        )
                        .map(
                                CapabilityPlanningRepository.UserCapabilityRow::
                                        proficiencyLevel
                        )
                        .findFirst()
                        .orElse(
                                0
                        );

        if (
                input.targetProficiency()
                        <= currentLevel
        ) {
            throw new IllegalArgumentException(
                    "Development target proficiency must exceed the currently assessed level."
            );
        }

        UUID actionId =
                UUID.randomUUID();

        repository.createDevelopmentAction(
                actionId,
                fiscalYear,
                input,
                currentUserId
        );

        return developmentActionResponse(
                requireDevelopmentAction(
                        actionId
                )
        );
    }

    public CapabilityDevelopmentActionResponse startDevelopmentAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapabilityPlanningRepository.DevelopmentActionRow action =
                requireDevelopmentAction(
                        actionId
                );

        if (
                action.status()
                        != CapabilityActionStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned development actions can be started."
            );
        }

        repository.startDevelopmentAction(
                actionId
        );

        return developmentActionResponse(
                requireDevelopmentAction(
                        actionId
                )
        );
    }

    public CapabilityDevelopmentActionResponse completeDevelopmentAction(
            UUID currentUserId,
            UUID actionId,
            CapabilityNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapabilityPlanningRepository.DevelopmentActionRow action =
                requireDevelopmentAction(
                        actionId
                );

        if (
                action.status()
                        != CapabilityActionStatus.PLANNED
                &&
                action.status()
                        != CapabilityActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active development actions can be completed."
            );
        }

        repository.completeDevelopmentAction(
                actionId,
                input.note()
        );

        return developmentActionResponse(
                requireDevelopmentAction(
                        actionId
                )
        );
    }

    public CapabilityDevelopmentActionResponse cancelDevelopmentAction(
            UUID currentUserId,
            UUID actionId,
            CapabilityNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapabilityPlanningRepository.DevelopmentActionRow action =
                requireDevelopmentAction(
                        actionId
                );

        if (
                action.status()
                        != CapabilityActionStatus.PLANNED
                &&
                action.status()
                        != CapabilityActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active development actions can be cancelled."
            );
        }

        repository.cancelDevelopmentAction(
                actionId,
                input.note()
        );

        return developmentActionResponse(
                requireDevelopmentAction(
                        actionId
                )
        );
    }

    public CapabilitySnapshotDetailResponse captureSnapshot(
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

        CapabilityPlanningDashboardResponse dashboard =
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

        for (
                CapabilityMemberResponse member
                : dashboard.members()
        ) {
            repository.createSnapshotMember(
                    snapshotId,
                    member
            );
        }

        for (
                CapabilityWorkItemResponse item
                : dashboard.workItems()
        ) {
            repository.createSnapshotWorkItem(
                    snapshotId,
                    item
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    @Transactional(readOnly = true)
    public CapabilitySnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapabilityPlanningRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Capability snapshot not found: "
                            + snapshotId
            );
        }

        return new CapabilitySnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),
                summaryFromSnapshot(
                        snapshot
                ),
                repository
                        .snapshotMembers(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotMemberResponse
                        )
                        .toList(),
                repository
                        .snapshotWorkItems(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotWorkResponse
                        )
                        .toList()
        );
    }

    private CapabilityWorkItemResponse workItem(
            CapacityWorkItemResponse capacityItem,
            List<CapabilityPlanningRepository.RequirementRow> requirements,
            Map<UserSkillKey, Integer> proficiency,
            Set<UUID> benchUsers
    ) {
        List<UUID> assignedUserIds =
                capacityItem
                        .assignments()
                        .stream()
                        .map(
                                CapacityAssignmentResponse::
                                        userId
                        )
                        .distinct()
                        .toList();

        List<CapabilityRequirementFit> assignedFits =
                requirements.stream()
                        .map(
                                requirement ->
                                        new CapabilityRequirementFit(
                                                requirement.requiredProficiency(),
                                                bestLevel(
                                                        assignedUserIds,
                                                        requirement.skillId(),
                                                        proficiency
                                                ),
                                                requirement.importanceWeightPct()
                                        )
                        )
                        .toList();

        List<CapabilityRequirementFit> benchFits =
                requirements.stream()
                        .map(
                                requirement ->
                                        new CapabilityRequirementFit(
                                                requirement.requiredProficiency(),
                                                bestLevel(
                                                        benchUsers,
                                                        requirement.skillId(),
                                                        proficiency
                                                ),
                                                requirement.importanceWeightPct()
                                        )
                        )
                        .toList();

        BigDecimal assignedScore =
                mathService
                        .weightedFit(
                                assignedFits
                        );

        BigDecimal benchScore =
                mathService
                        .weightedFit(
                                benchFits
                        );

        int criticalGapCount =
                (
                        int
                ) requirements.stream()
                        .filter(
                                requirement ->
                                        requirement.requiredProficiency()
                                                >= 4
                                        &&
                                        bestLevel(
                                                assignedUserIds,
                                                requirement.skillId(),
                                                proficiency
                                        )
                                                <
                                                requirement.requiredProficiency()
                        )
                        .count();

        int benchReadyCount =
                requirements.isEmpty()
                        ? 0
                        : (
                                int
                        ) benchUsers.stream()
                                .filter(
                                        userId ->
                                                requirements.stream()
                                                        .allMatch(
                                                                requirement ->
                                                                        proficiency
                                                                                .getOrDefault(
                                                                                        new UserSkillKey(
                                                                                                userId,
                                                                                                requirement.skillId()
                                                                                        ),
                                                                                        0
                                                                                )
                                                                                >=
                                                                                requirement.requiredProficiency()
                                                        )
                                )
                                .count();

        return new CapabilityWorkItemResponse(
                CapabilitySourceType.valueOf(
                        capacityItem.sourceType()
                                .name()
                ),
                capacityItem.sourceEntityId(),
                capacityItem.sourceReference(),
                capacityItem.sourceTitle(),
                capacityItem.sourceStatus(),
                assignedUserIds.size(),
                requirements.size(),
                criticalGapCount,
                assignedScore,
                benchScore,
                benchReadyCount,
                mathService
                        .readiness(
                                !requirements.isEmpty(),
                                assignedScore
                        ),
                requirements.stream()
                        .map(
                                this::requirementResponse
                        )
                        .toList(),
                assignedUserIds
        );
    }

    private List<CapabilityMemberResponse> memberResponses(
            CapacityPlanningDashboardResponse capacity,
            List<CapabilityPlanningRepository.UserCapabilityRow> capabilities,
            List<CapabilityWorkItemResponse> workItems,
            List<CapabilityPlanningRepository.RequirementRow> requirements,
            Map<UserSkillKey, Integer> proficiency,
            List<CapabilityPlanningRepository.DevelopmentActionRow> actions
    ) {
        Map<UUID, List<CapabilityPlanningRepository.UserCapabilityRow>> capabilityByUser =
                capabilities.stream()
                        .collect(
                                Collectors.groupingBy(
                                        CapabilityPlanningRepository.UserCapabilityRow::
                                                userId
                                )
                        );

        Map<SourceKey, List<CapabilityPlanningRepository.RequirementRow>> requirementBySource =
                requirements.stream()
                        .collect(
                                Collectors.groupingBy(
                                        requirement ->
                                                new SourceKey(
                                                        requirement.sourceType(),
                                                        requirement.sourceEntityId()
                                                )
                                )
                        );

        return capacity
                .users()
                .stream()
                .map(
                        user -> {
                            List<CapabilityPlanningRepository.UserCapabilityRow> userCapabilities =
                                    capabilityByUser
                                            .getOrDefault(
                                                    user.id(),
                                                    List.of()
                                            );

                            List<CapabilityWorkItemResponse> assignedWork =
                                    workItems.stream()
                                            .filter(
                                                    work ->
                                                            work.assignedUserIds()
                                                                    .contains(
                                                                            user.id()
                                                                    )
                                            )
                                            .toList();

                            Set<UUID> gapSkills =
                                    new HashSet<>();

                            for (
                                    CapabilityWorkItemResponse work
                                    : assignedWork
                            ) {
                                List<CapabilityPlanningRepository.RequirementRow> workRequirements =
                                        requirementBySource
                                                .getOrDefault(
                                                        new SourceKey(
                                                                work.sourceType(),
                                                                work.sourceEntityId()
                                                        ),
                                                        List.of()
                                                );

                                for (
                                        CapabilityPlanningRepository.RequirementRow requirement
                                        : workRequirements
                                ) {
                                    int level =
                                            proficiency
                                                    .getOrDefault(
                                                            new UserSkillKey(
                                                                    user.id(),
                                                                    requirement.skillId()
                                                            ),
                                                            0
                                                    );

                                    if (
                                            level
                                                    <
                                                    requirement.requiredProficiency()
                                    ) {
                                        gapSkills.add(
                                                requirement.skillId()
                                        );
                                    }
                                }
                            }

                            int openDevelopmentActions =
                                    (
                                            int
                                    ) actions.stream()
                                            .filter(
                                                    action ->
                                                            action.userId()
                                                                    .equals(
                                                                            user.id()
                                                                    )
                                                            &&
                                                            (
                                                                    action.status()
                                                                            == CapabilityActionStatus.PLANNED
                                                                    ||
                                                                    action.status()
                                                                            == CapabilityActionStatus.IN_PROGRESS
                                                            )
                                            )
                                            .count();

                            BigDecimal average =
                                    userCapabilities.isEmpty()
                                            ? BigDecimal.ZERO
                                                    .setScale(
                                                            2,
                                                            RoundingMode.HALF_UP
                                                    )
                                            : BigDecimal
                                                    .valueOf(
                                                            userCapabilities
                                                                    .stream()
                                                                    .mapToInt(
                                                                            CapabilityPlanningRepository.UserCapabilityRow::
                                                                                    proficiencyLevel
                                                                    )
                                                                    .sum()
                                                    )
                                                    .divide(
                                                            BigDecimal.valueOf(
                                                                    userCapabilities.size()
                                                            ),
                                                            2,
                                                            RoundingMode.HALF_UP
                                                    );

                            return new CapabilityMemberResponse(
                                    user.id(),
                                    user.fullName(),
                                    user.role()
                                            .name(),
                                    userCapabilities.size(),
                                    average,
                                    assignedWork.size(),
                                    gapSkills.size(),
                                    openDevelopmentActions
                            );
                        }
                )
                .sorted(
                        Comparator
                                .comparingInt(
                                        CapabilityMemberResponse::
                                                capabilityGapCount
                                )
                                .reversed()
                                .thenComparing(
                                        CapabilityMemberResponse::
                                                userName
                                )
                )
                .toList();
    }

    private CapabilitySummaryResponse summary(
            List<CapabilityPlanningRepository.SkillRow> skills,
            List<CapabilityMemberResponse> members,
            List<CapabilityWorkItemResponse> workItems,
            List<CapabilityPlanningRepository.DevelopmentActionRow> actions
    ) {
        List<CapabilityWorkItemResponse> defined =
                workItems.stream()
                        .filter(
                                work ->
                                        work.requirementCount()
                                                > 0
                        )
                        .toList();

        CapabilityPortfolioScore score =
                mathService
                        .portfolioScore(
                                workItems.size(),
                                defined.size(),
                                defined.stream()
                                        .map(
                                                CapabilityWorkItemResponse::
                                                        assignedFitPct
                                        )
                                        .toList(),
                                defined.stream()
                                        .map(
                                                CapabilityWorkItemResponse::
                                                        benchFitPct
                                        )
                                        .toList()
                        );

        return new CapabilitySummaryResponse(
                skills.size(),
                (
                        int
                ) members.stream()
                        .filter(
                                member ->
                                        member.assessedSkillCount()
                                                > 0
                        )
                        .count(),
                workItems.size(),
                defined.size(),
                countReadiness(
                        workItems,
                        CapabilityReadiness.READY
                ),
                countReadiness(
                        workItems,
                        CapabilityReadiness.WATCH
                ),
                countReadiness(
                        workItems,
                        CapabilityReadiness.GAP
                ),
                countReadiness(
                        workItems,
                        CapabilityReadiness.CRITICAL
                ),
                workItems.stream()
                        .mapToInt(
                                CapabilityWorkItemResponse::
                                        criticalGapCount
                        )
                        .sum(),
                (
                        int
                ) actions.stream()
                        .filter(
                                action ->
                                        action.status()
                                                == CapabilityActionStatus.PLANNED
                                        ||
                                        action.status()
                                                == CapabilityActionStatus.IN_PROGRESS
                        )
                        .count(),
                score.requirementCoveragePct(),
                score.averageAssignedFitPct(),
                score.averageBenchFitPct(),
                score.capabilityScore(),
                score.health()
        );
    }

    private int countReadiness(
            List<CapabilityWorkItemResponse> workItems,
            CapabilityReadiness readiness
    ) {
        return (
                int
        ) workItems.stream()
                .filter(
                        item ->
                                item.readiness()
                                        == readiness
                )
                .count();
    }

    private int bestLevel(
            Iterable<UUID> userIds,
            UUID skillId,
            Map<UserSkillKey, Integer> proficiency
    ) {
        int best =
                0;

        for (
                UUID userId
                : userIds
        ) {
            best =
                    Math.max(
                            best,
                            proficiency
                                    .getOrDefault(
                                            new UserSkillKey(
                                                    userId,
                                                    skillId
                                            ),
                                            0
                                    )
                    );
        }

        return best;
    }

    private CapabilitySkillResponse skillResponse(
            CapabilityPlanningRepository.SkillRow row
    ) {
        return new CapabilitySkillResponse(
                row.id(),
                row.code(),
                row.name(),
                row.category(),
                row.description(),
                row.active()
        );
    }

    private UserCapabilityResponse userCapabilityResponse(
            CapabilityPlanningRepository.UserCapabilityRow row
    ) {
        return new UserCapabilityResponse(
                row.id(),
                row.userId(),
                row.userName(),
                row.role(),
                row.skillId(),
                row.skillCode(),
                row.skillName(),
                row.skillCategory(),
                row.proficiencyLevel(),
                row.evidenceNote(),
                row.assessedByName(),
                row.assessedAt(),
                row.version()
        );
    }

    private WorkCapabilityRequirementResponse requirementResponse(
            CapabilityPlanningRepository.RequirementRow row
    ) {
        return new WorkCapabilityRequirementResponse(
                row.id(),
                row.currency(),
                row.fiscalYear(),
                row.sourceType(),
                row.sourceEntityId(),
                row.sourceReference(),
                row.sourceTitle(),
                row.skillId(),
                row.skillCode(),
                row.skillName(),
                row.skillCategory(),
                row.requiredProficiency(),
                mathService
                        .decimal(
                                row.importanceWeightPct()
                        )
        );
    }

    private CapabilityDevelopmentActionResponse developmentActionResponse(
            CapabilityPlanningRepository.DevelopmentActionRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == CapabilityActionStatus.PLANNED
                        ||
                        row.status()
                                == CapabilityActionStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new CapabilityDevelopmentActionResponse(
                row.id(),
                row.userId(),
                row.userName(),
                row.skillId(),
                row.skillCode(),
                row.skillName(),
                row.fiscalYear(),
                row.actionType(),
                row.title(),
                row.description(),
                row.targetProficiency(),
                row.dueDate(),
                row.status(),
                overdue,
                row.evidenceNote(),
                row.startedAt(),
                row.completedAt(),
                row.cancelledAt(),
                row.createdAt(),
                row.version()
        );
    }

    private CapabilitySnapshotSummaryResponse snapshotSummary(
            CapabilityPlanningRepository.SnapshotRow row
    ) {
        return new CapabilitySnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.currency(),
                row.fiscalYear(),
                mathService
                        .decimal(
                                row.capabilityScore()
                        ),
                row.capabilityHealth(),
                row.criticalGapCount(),
                row.openDevelopmentActionCount(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private CapabilitySummaryResponse summaryFromSnapshot(
            CapabilityPlanningRepository.SnapshotRow row
    ) {
        return new CapabilitySummaryResponse(
                row.activeSkillCount(),
                row.assessedMemberCount(),
                row.strategicWorkCount(),
                row.workWithRequirementsCount(),
                row.readyWorkCount(),
                row.watchWorkCount(),
                row.gapWorkCount(),
                row.criticalWorkCount(),
                row.criticalGapCount(),
                row.openDevelopmentActionCount(),
                mathService
                        .decimal(
                                row.requirementCoveragePct()
                        ),
                mathService
                        .decimal(
                                row.averageAssignedFitPct()
                        ),
                mathService
                        .decimal(
                                row.averageBenchFitPct()
                        ),
                mathService
                        .decimal(
                                row.capabilityScore()
                        ),
                row.capabilityHealth()
        );
    }

    private CapabilityMemberResponse snapshotMemberResponse(
            CapabilityPlanningRepository.SnapshotMemberRow row
    ) {
        return new CapabilityMemberResponse(
                row.userId(),
                row.userName(),
                row.role(),
                row.assessedSkillCount(),
                mathService
                        .decimal(
                                row.averageProficiency()
                        ),
                row.assignedWorkItemCount(),
                row.capabilityGapCount(),
                row.openDevelopmentActionCount()
        );
    }

    private CapabilityWorkItemResponse snapshotWorkResponse(
            CapabilityPlanningRepository.SnapshotWorkRow row
    ) {
        return new CapabilityWorkItemResponse(
                row.sourceType(),
                row.sourceEntityId(),
                row.sourceReference(),
                row.sourceTitle(),
                row.sourceStatus(),
                row.assignedMemberCount(),
                row.requirementCount(),
                row.criticalGapCount(),
                mathService
                        .decimal(
                                row.assignedFitPct()
                        ),
                mathService
                        .decimal(
                                row.benchFitPct()
                        ),
                row.benchReadyMemberCount(),
                row.readiness(),
                List.of(),
                List.of()
        );
    }

    private CapabilityPlanningRepository.SkillRow requireSkill(
            UUID skillId
    ) {
        CapabilityPlanningRepository.SkillRow skill =
                repository
                        .findSkill(
                                skillId
                        );

        if (
                skill == null
                ||
                !skill.active()
        ) {
            throw new ResourceNotFoundException(
                    "Capability skill not found: "
                            + skillId
            );
        }

        return skill;
    }

    private CapabilityPlanningRepository.DevelopmentActionRow requireDevelopmentAction(
            UUID actionId
    ) {
        CapabilityPlanningRepository.DevelopmentActionRow action =
                repository
                        .findDevelopmentAction(
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Capability-development action not found: "
                            + actionId
            );
        }

        return action;
    }

    private AppUserEntity requireCapabilityUser(
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
                    "Requester accounts cannot receive strategic capability assessments."
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
                "CAPSKILL-%d-%05d",
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
                    "Capability-planning currency must contain exactly three characters."
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
                    "Your ProcureIQ role cannot access capability planning."
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
                    "Your ProcureIQ role cannot manage capability planning."
            );
        }
    }

    private record UserSkillKey(
            UUID userId,
            UUID skillId
    ) {
    }

    private record SourceKey(
            CapabilitySourceType sourceType,
            UUID sourceEntityId
    ) {
    }
}
