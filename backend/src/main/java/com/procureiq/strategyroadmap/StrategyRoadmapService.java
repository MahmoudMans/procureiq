package com.procureiq.strategyroadmap;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategyscenario.StrategyScenarioDetailResponse;
import com.procureiq.strategyscenario.StrategyScenarioEvaluationDetailResponse;
import com.procureiq.strategyscenario.StrategyScenarioService;
import com.procureiq.strategyscenario.StrategyScenarioStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class StrategyRoadmapService {

    private final StrategyRoadmapRepository repository;

    private final StrategyRoadmapMathService mathService;

    private final StrategyScenarioService strategyScenarioService;

    private final AppUserRepository appUserRepository;

    public StrategyRoadmapService(
            StrategyRoadmapRepository repository,
            StrategyRoadmapMathService mathService,
            StrategyScenarioService strategyScenarioService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategyScenarioService =
                strategyScenarioService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public StrategyRoadmapDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new StrategyRoadmapDashboardResponse(
                repository
                        .roadmaps()
                        .stream()
                        .map(
                                this::buildRoadmap
                        )
                        .map(
                                StrategyRoadmapDetailResponse::
                                        roadmap
                        )
                        .toList()
        );
    }

    public StrategyRoadmapDetailResponse createRoadmap(
            UUID currentUserId,
            StrategyRoadmapInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                input.targetEndDate()
                        .isBefore(
                                input.startDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Roadmap target end date cannot precede its start date."
            );
        }

        StrategyScenarioDetailResponse scenario =
                strategyScenarioService
                        .scenario(
                                currentUserId,
                                input.approvedScenarioId()
                        );

        if (
                scenario
                        .scenario()
                        .status()
                        != StrategyScenarioStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only an approved Step 51 strategy scenario can create an implementation roadmap."
            );
        }

        StrategyScenarioEvaluationDetailResponse evaluation =
                scenario.latestEvaluation();

        if (evaluation == null) {
            throw new IllegalArgumentException(
                    "Approved strategy scenario is missing its immutable evaluation."
            );
        }

        UUID roadmapId =
                UUID.randomUUID();

        repository.createRoadmap(
                roadmapId,
                nextRoadmapNumber(),
                scenario
                        .scenario()
                        .id(),
                scenario
                        .scenario()
                        .scenarioNumber(),
                scenario
                        .scenario()
                        .name(),
                evaluation
                        .evaluation()
                        .id(),
                evaluation
                        .evaluation()
                        .evaluationNumber(),
                scenario
                        .scenario()
                        .currency(),
                scenario
                        .scenario()
                        .fiscalYear(),
                input,
                evaluation
                        .evaluation()
                        .baselineOverallScore(),
                evaluation
                        .evaluation()
                        .simulatedOverallScore(),
                evaluation
                        .evaluation()
                        .scoreDelta(),
                currentUserId
        );

        return roadmap(
                currentUserId,
                roadmapId
        );
    }

    @Transactional(readOnly = true)
    public StrategyRoadmapDetailResponse roadmap(
            UUID currentUserId,
            UUID roadmapId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return buildRoadmap(
                requireRoadmap(
                        roadmapId
                )
        );
    }

    public StrategyRoadmapDetailResponse activate(
            UUID currentUserId,
            UUID roadmapId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.RoadmapRow roadmap =
                requireRoadmap(
                        roadmapId
                );

        if (
                roadmap.status()
                        != StrategyRoadmapStatus.DRAFT
                &&
                roadmap.status()
                        != StrategyRoadmapStatus.ON_HOLD
        ) {
            throw new IllegalArgumentException(
                    "Only draft or on-hold roadmaps can be activated."
            );
        }

        if (
                repository
                        .initiatives(
                                roadmapId
                        )
                        .isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "At least one proposed initiative is required before roadmap activation."
            );
        }

        repository.activateRoadmap(
                roadmapId
        );

        return roadmap(
                currentUserId,
                roadmapId
        );
    }

    public StrategyRoadmapDetailResponse hold(
            UUID currentUserId,
            UUID roadmapId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.RoadmapRow roadmap =
                requireRoadmap(
                        roadmapId
                );

        if (
                roadmap.status()
                        != StrategyRoadmapStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only an active roadmap can be placed on hold."
            );
        }

        repository.holdRoadmap(
                roadmapId
        );

        return roadmap(
                currentUserId,
                roadmapId
        );
    }

    public StrategyRoadmapDetailResponse complete(
            UUID currentUserId,
            UUID roadmapId
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.RoadmapRow roadmap =
                requireRoadmap(
                        roadmapId
                );

        if (
                roadmap.status()
                        != StrategyRoadmapStatus.ACTIVE
                &&
                roadmap.status()
                        != StrategyRoadmapStatus.ON_HOLD
        ) {
            throw new IllegalArgumentException(
                    "Only active or on-hold roadmaps can be completed."
            );
        }

        List<StrategyRoadmapRepository.InitiativeRow> initiatives =
                repository
                        .initiatives(
                                roadmapId
                        );

        boolean unfinished =
                initiatives.stream()
                        .anyMatch(
                                initiative ->
                                        initiative.status()
                                                != RoadmapInitiativeStatus.COMPLETED
                                        &&
                                        initiative.status()
                                                != RoadmapInitiativeStatus.CANCELLED
                        );

        if (unfinished) {
            throw new IllegalArgumentException(
                    "All roadmap initiatives must be completed or cancelled before roadmap completion."
            );
        }

        boolean unresolvedGate =
                repository
                        .gates(
                                roadmapId
                        )
                        .stream()
                        .anyMatch(
                                gate ->
                                        gate.status()
                                                == RoadmapGateStatus.PENDING
                                        ||
                                        gate.status()
                                                == RoadmapGateStatus.REJECTED
                        );

        if (unresolvedGate) {
            throw new IllegalArgumentException(
                    "Roadmap completion requires every decision gate to be approved or waived."
            );
        }

        repository.completeRoadmap(
                roadmapId
        );

        return roadmap(
                currentUserId,
                roadmapId
        );
    }

    public StrategyRoadmapDetailResponse archive(
            UUID currentUserId,
            UUID roadmapId
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.RoadmapRow roadmap =
                requireRoadmap(
                        roadmapId
                );

        if (
                roadmap.status()
                        == StrategyRoadmapStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Roadmap is already archived."
            );
        }

        repository.archiveRoadmap(
                roadmapId
        );

        return roadmap(
                currentUserId,
                roadmapId
        );
    }

    public StrategyRoadmapDetailResponse createInitiative(
            UUID currentUserId,
            UUID roadmapId,
            RoadmapInitiativeInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.RoadmapRow roadmap =
                requireRoadmap(
                        roadmapId
                );

        requirePlanningMutable(
                roadmap
        );

        requireRoadmapUser(
                input.ownerUserId()
        );

        if (
                input.plannedEndDate()
                        .isBefore(
                                input.plannedStartDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Initiative end date cannot precede its start date."
            );
        }

        if (
                input.plannedStartDate()
                        .isBefore(
                                roadmap.startDate()
                        )
                ||
                input.plannedEndDate()
                        .isAfter(
                                roadmap.targetEndDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Initiative dates must remain within the roadmap planning window."
            );
        }

        repository.createInitiative(
                UUID.randomUUID(),
                roadmapId,
                nextInitiativeNumber(),
                input,
                currentUserId
        );

        return roadmap(
                currentUserId,
                roadmapId
        );
    }

    public StrategyRoadmapDetailResponse startInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        StrategyRoadmapRepository.RoadmapRow roadmap =
                requireRoadmap(
                        initiative.roadmapId()
                );

        if (
                roadmap.status()
                        != StrategyRoadmapStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Initiatives can start only while their roadmap is active."
            );
        }

        if (
                initiative.status()
                        != RoadmapInitiativeStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned initiatives can be started."
            );
        }

        int blockers =
                blockedDependencyCount(
                        initiative.id(),
                        repository
                                .dependencies(
                                        roadmap.id()
                                )
                );

        if (blockers > 0) {
            throw new IllegalArgumentException(
                    "Initiative has unsatisfied sequencing dependencies."
            );
        }

        boolean rejectedGate =
                repository
                        .gates(
                                roadmap.id()
                        )
                        .stream()
                        .anyMatch(
                                gate ->
                                        gate.initiativeId()
                                                .equals(
                                                        initiative.id()
                                                )
                                        &&
                                        gate.status()
                                                == RoadmapGateStatus.REJECTED
                        );

        if (rejectedGate) {
            throw new IllegalArgumentException(
                    "Initiative has a rejected decision gate."
            );
        }

        repository.startInitiative(
                initiativeId
        );

        return roadmap(
                currentUserId,
                roadmap.id()
        );
    }

    public StrategyRoadmapDetailResponse completeInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != RoadmapInitiativeStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only in-progress initiatives can be completed."
            );
        }

        boolean unresolvedGate =
                repository
                        .gates(
                                initiative.roadmapId()
                        )
                        .stream()
                        .anyMatch(
                                gate ->
                                        gate.initiativeId()
                                                .equals(
                                                        initiative.id()
                                                )
                                        &&
                                        (
                                                gate.status()
                                                        == RoadmapGateStatus.PENDING
                                                ||
                                                gate.status()
                                                        == RoadmapGateStatus.REJECTED
                                        )
                        );

        if (unresolvedGate) {
            throw new IllegalArgumentException(
                    "Initiative completion requires all gates to be approved or waived."
            );
        }

        repository.completeInitiative(
                initiativeId
        );

        return roadmap(
                currentUserId,
                initiative.roadmapId()
        );
    }

    public StrategyRoadmapDetailResponse cancelInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        == RoadmapInitiativeStatus.COMPLETED
                ||
                initiative.status()
                        == RoadmapInitiativeStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Completed or cancelled initiatives cannot be cancelled again."
            );
        }

        repository.cancelInitiative(
                initiativeId
        );

        return roadmap(
                currentUserId,
                initiative.roadmapId()
        );
    }

    public StrategyRoadmapDetailResponse createDependency(
            UUID currentUserId,
            UUID roadmapId,
            RoadmapDependencyInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.RoadmapRow roadmap =
                requireRoadmap(
                        roadmapId
                );

        requirePlanningMutable(
                roadmap
        );

        StrategyRoadmapRepository.InitiativeRow predecessor =
                requireInitiative(
                        input.predecessorInitiativeId()
                );

        StrategyRoadmapRepository.InitiativeRow successor =
                requireInitiative(
                        input.successorInitiativeId()
                );

        if (
                !predecessor
                        .roadmapId()
                        .equals(
                                roadmapId
                        )
                ||
                !successor
                        .roadmapId()
                        .equals(
                                roadmapId
                        )
        ) {
            throw new IllegalArgumentException(
                    "Both dependency initiatives must belong to the selected roadmap."
            );
        }

        if (
                predecessor
                        .id()
                        .equals(
                                successor.id()
                        )
        ) {
            throw new IllegalArgumentException(
                    "An initiative cannot depend on itself."
            );
        }

        List<StrategyRoadmapRepository.DependencyRow> dependencies =
                repository
                        .dependencies(
                                roadmapId
                        );

        if (
                wouldCreateCycle(
                        predecessor.id(),
                        successor.id(),
                        dependencies
                )
        ) {
            throw new IllegalArgumentException(
                    "Dependency would create a roadmap sequencing cycle."
            );
        }

        repository.createDependency(
                UUID.randomUUID(),
                roadmapId,
                input,
                currentUserId
        );

        return roadmap(
                currentUserId,
                roadmapId
        );
    }

    public void deleteDependency(
            UUID currentUserId,
            UUID dependencyId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.DependencyRow dependency =
                repository
                        .findDependency(
                                dependencyId
                        );

        if (dependency == null) {
            throw new ResourceNotFoundException(
                    "Roadmap dependency not found: "
                            + dependencyId
            );
        }

        requirePlanningMutable(
                requireRoadmap(
                        dependency.roadmapId()
                )
        );

        repository.deleteDependency(
                dependencyId
        );
    }

    public StrategyRoadmapDetailResponse createMilestone(
            UUID currentUserId,
            UUID initiativeId,
            RoadmapMilestoneInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        requirePlanningMutable(
                requireRoadmap(
                        initiative.roadmapId()
                )
        );

        if (
                input.dueDate()
                        .isBefore(
                                initiative.plannedStartDate()
                        )
                ||
                input.dueDate()
                        .isAfter(
                                initiative.plannedEndDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Milestone due date must remain inside the initiative planning window."
            );
        }

        repository.createMilestone(
                UUID.randomUUID(),
                initiativeId,
                input,
                currentUserId
        );

        return roadmap(
                currentUserId,
                initiative.roadmapId()
        );
    }

    public StrategyRoadmapDetailResponse completeMilestone(
            UUID currentUserId,
            UUID milestoneId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.MilestoneRow milestone =
                requireMilestone(
                        milestoneId
                );

        if (
                milestone.status()
                        != RoadmapMilestoneStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned milestones can be completed."
            );
        }

        repository.completeMilestone(
                milestoneId
        );

        return roadmap(
                currentUserId,
                milestone.roadmapId()
        );
    }

    public StrategyRoadmapDetailResponse cancelMilestone(
            UUID currentUserId,
            UUID milestoneId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.MilestoneRow milestone =
                requireMilestone(
                        milestoneId
                );

        if (
                milestone.status()
                        != RoadmapMilestoneStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned milestones can be cancelled."
            );
        }

        repository.cancelMilestone(
                milestoneId
        );

        return roadmap(
                currentUserId,
                milestone.roadmapId()
        );
    }

    public StrategyRoadmapDetailResponse createGate(
            UUID currentUserId,
            UUID initiativeId,
            RoadmapGateInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        requirePlanningMutable(
                requireRoadmap(
                        initiative.roadmapId()
                )
        );

        if (
                input.dueDate()
                        .isBefore(
                                initiative.plannedStartDate()
                        )
                ||
                input.dueDate()
                        .isAfter(
                                initiative.plannedEndDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Decision-gate due date must remain inside the initiative planning window."
            );
        }

        repository.createGate(
                UUID.randomUUID(),
                initiativeId,
                input,
                currentUserId
        );

        return roadmap(
                currentUserId,
                initiative.roadmapId()
        );
    }

    public StrategyRoadmapDetailResponse decideGate(
            UUID currentUserId,
            UUID gateId,
            RoadmapGateStatus decision,
            RoadmapDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                decision
                        == RoadmapGateStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Decision must be APPROVED, REJECTED, or WAIVED."
            );
        }

        StrategyRoadmapRepository.GateRow gate =
                requireGate(
                        gateId
                );

        if (
                gate.status()
                        != RoadmapGateStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Only pending roadmap gates can be decided."
            );
        }

        repository.decideGate(
                gateId,
                decision,
                input.note(),
                currentUserId
        );

        return roadmap(
                currentUserId,
                gate.roadmapId()
        );
    }

    public StrategyRoadmapSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID roadmapId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapDetailResponse detail =
                roadmap(
                        currentUserId,
                        roadmapId
                );

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                detail.roadmap(),
                currentUserId
        );

        for (
                RoadmapInitiativeResponse initiative
                : detail.initiatives()
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    initiative
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    @Transactional(readOnly = true)
    public StrategyRoadmapSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Roadmap snapshot not found: "
                            + snapshotId
            );
        }

        StrategyRoadmapRepository.RoadmapRow roadmap =
                requireRoadmap(
                        snapshot.roadmapId()
                );

        StrategyRoadmapSummaryResponse frozenRoadmap =
                frozenRoadmapSummary(
                        roadmap,
                        snapshot
                );

        List<RoadmapInitiativeResponse> initiatives =
                repository
                        .snapshotItems(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotInitiativeResponse
                        )
                        .toList();

        return new StrategyRoadmapSnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),
                frozenRoadmap,
                initiatives
        );
    }

    private StrategyRoadmapDetailResponse buildRoadmap(
            StrategyRoadmapRepository.RoadmapRow roadmap
    ) {
        List<StrategyRoadmapRepository.InitiativeRow> initiatives =
                repository
                        .initiatives(
                                roadmap.id()
                        );

        List<StrategyRoadmapRepository.DependencyRow> dependencies =
                repository
                        .dependencies(
                                roadmap.id()
                        );

        List<StrategyRoadmapRepository.MilestoneRow> milestones =
                repository
                        .milestones(
                                roadmap.id()
                        );

        List<StrategyRoadmapRepository.GateRow> gates =
                repository
                        .gates(
                                roadmap.id()
                        );

        List<RoadmapInitiativeResponse> initiativeResponses =
                initiatives.stream()
                        .map(
                                initiative ->
                                        initiativeResponse(
                                                initiative,
                                                dependencies,
                                                milestones,
                                                gates
                                        )
                        )
                        .toList();

        int satisfiedDependencies =
                (
                        int
                ) dependencies.stream()
                        .filter(
                                this::dependencySatisfied
                        )
                        .count();

        int healthyMilestones =
                (
                        int
                ) milestones.stream()
                        .filter(
                                milestone ->
                                        !milestoneOverdue(
                                                milestone
                                        )
                        )
                        .count();

        int healthyGates =
                (
                        int
                ) gates.stream()
                        .filter(
                                gate ->
                                        gate.status()
                                                == RoadmapGateStatus.APPROVED
                                        ||
                                        gate.status()
                                                == RoadmapGateStatus.WAIVED
                                        ||
                                        (
                                                gate.status()
                                                        == RoadmapGateStatus.PENDING
                                                &&
                                                !gateOverdue(
                                                        gate
                                                )
                                        )
                        )
                        .count();

        int rejectedGates =
                (
                        int
                ) gates.stream()
                        .filter(
                                gate ->
                                        gate.status()
                                                == RoadmapGateStatus.REJECTED
                        )
                        .count();

        RoadmapReadinessResult readiness =
                mathService
                        .readiness(
                                initiatives.size(),
                                initiatives.size(),
                                dependencies.size(),
                                satisfiedDependencies,
                                milestones.size(),
                                healthyMilestones,
                                gates.size(),
                                healthyGates,
                                rejectedGates
                        );

        StrategyRoadmapSummaryResponse summary =
                new StrategyRoadmapSummaryResponse(
                        roadmap.id(),
                        roadmap.roadmapNumber(),
                        roadmap.sourceScenarioId(),
                        roadmap.sourceScenarioNumber(),
                        roadmap.sourceScenarioName(),
                        roadmap.currency(),
                        roadmap.fiscalYear(),
                        roadmap.title(),
                        roadmap.objective(),
                        roadmap.startDate(),
                        roadmap.targetEndDate(),
                        roadmap.status(),
                        mathService
                                .decimal(
                                        roadmap.scenarioBaselineScore()
                                ),
                        mathService
                                .decimal(
                                        roadmap.scenarioSimulatedScore()
                                ),
                        mathService
                                .decimal(
                                        roadmap.scenarioDelta()
                                ),
                        initiatives.size(),
                        (
                                int
                        ) initiatives.stream()
                                .filter(
                                        initiative ->
                                                initiative.status()
                                                        == RoadmapInitiativeStatus.COMPLETED
                                )
                                .count(),
                        (
                                int
                        ) initiativeResponses.stream()
                                .filter(
                                        RoadmapInitiativeResponse::
                                                blocked
                                )
                                .count(),
                        (
                                int
                        ) milestones.stream()
                                .filter(
                                        this::milestoneOverdue
                                )
                                .count(),
                        rejectedGates,
                        readiness.ownerCoveragePct(),
                        readiness.dependencyHealthPct(),
                        readiness.milestoneHealthPct(),
                        readiness.gateHealthPct(),
                        readiness.readinessScore(),
                        readiness.health(),
                        roadmap.createdByName(),
                        roadmap.createdAt(),
                        roadmap.updatedAt(),
                        roadmap.version()
                );

        return new StrategyRoadmapDetailResponse(
                summary,
                repository.users(),
                initiativeResponses,
                dependencies.stream()
                        .map(
                                this::dependencyResponse
                        )
                        .toList(),
                milestones.stream()
                        .map(
                                this::milestoneResponse
                        )
                        .toList(),
                gates.stream()
                        .map(
                                this::gateResponse
                        )
                        .toList(),
                repository
                        .snapshots(
                                roadmap.id()
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    private RoadmapInitiativeResponse initiativeResponse(
            StrategyRoadmapRepository.InitiativeRow initiative,
            List<StrategyRoadmapRepository.DependencyRow> dependencies,
            List<StrategyRoadmapRepository.MilestoneRow> milestones,
            List<StrategyRoadmapRepository.GateRow> gates
    ) {
        int blockedDependencies =
                blockedDependencyCount(
                        initiative.id(),
                        dependencies
                );

        int overdueMilestones =
                (
                        int
                ) milestones.stream()
                        .filter(
                                milestone ->
                                        milestone
                                                .initiativeId()
                                                .equals(
                                                        initiative.id()
                                                )
                                        &&
                                        milestoneOverdue(
                                                milestone
                                        )
                        )
                        .count();

        int pendingGates =
                (
                        int
                ) gates.stream()
                        .filter(
                                gate ->
                                        gate
                                                .initiativeId()
                                                .equals(
                                                        initiative.id()
                                                )
                                        &&
                                        gate.status()
                                                == RoadmapGateStatus.PENDING
                        )
                        .count();

        int rejectedGates =
                (
                        int
                ) gates.stream()
                        .filter(
                                gate ->
                                        gate
                                                .initiativeId()
                                                .equals(
                                                        initiative.id()
                                                )
                                        &&
                                        gate.status()
                                                == RoadmapGateStatus.REJECTED
                        )
                        .count();

        return new RoadmapInitiativeResponse(
                initiative.id(),
                initiative.initiativeNumber(),
                initiative.title(),
                initiative.description(),
                initiative.dimensionKey(),
                initiative.priority(),
                initiative.ownerUserId(),
                initiative.ownerName(),
                initiative.ownerRole(),
                initiative.plannedStartDate(),
                initiative.plannedEndDate(),
                mathService
                        .decimal(
                                initiative.plannedContributionPoints()
                        ),
                initiative.status(),
                blockedDependencies,
                overdueMilestones,
                pendingGates,
                rejectedGates,
                blockedDependencies > 0
                        ||
                        rejectedGates > 0
        );
    }

    private RoadmapDependencyResponse dependencyResponse(
            StrategyRoadmapRepository.DependencyRow row
    ) {
        return new RoadmapDependencyResponse(
                row.id(),
                row.predecessorInitiativeId(),
                row.predecessorNumber(),
                row.predecessorTitle(),
                row.predecessorStatus(),
                row.successorInitiativeId(),
                row.successorNumber(),
                row.successorTitle(),
                row.successorStatus(),
                row.dependencyType(),
                row.rationale(),
                dependencySatisfied(
                        row
                )
        );
    }

    private RoadmapMilestoneResponse milestoneResponse(
            StrategyRoadmapRepository.MilestoneRow row
    ) {
        return new RoadmapMilestoneResponse(
                row.id(),
                row.initiativeId(),
                row.title(),
                row.description(),
                row.dueDate(),
                row.status(),
                milestoneOverdue(
                        row
                )
        );
    }

    private RoadmapGateResponse gateResponse(
            StrategyRoadmapRepository.GateRow row
    ) {
        return new RoadmapGateResponse(
                row.id(),
                row.initiativeId(),
                row.gateName(),
                row.dueDate(),
                row.status(),
                gateOverdue(
                        row
                ),
                row.decisionNote(),
                row.decidedByName()
        );
    }

    private boolean dependencySatisfied(
            StrategyRoadmapRepository.DependencyRow row
    ) {
        return switch (
                row.dependencyType()
        ) {
            case FINISH_TO_START ->
                    row.predecessorStatus()
                            == RoadmapInitiativeStatus.COMPLETED
                    ||
                    row.predecessorStatus()
                            == RoadmapInitiativeStatus.CANCELLED;

            case START_TO_START ->
                    row.predecessorStatus()
                            != RoadmapInitiativeStatus.PLANNED;

            case FINISH_TO_FINISH ->
                    row.predecessorStatus()
                            == RoadmapInitiativeStatus.COMPLETED
                    ||
                    row.predecessorStatus()
                            == RoadmapInitiativeStatus.CANCELLED;
        };
    }

    private int blockedDependencyCount(
            UUID initiativeId,
            List<StrategyRoadmapRepository.DependencyRow> dependencies
    ) {
        return (
                int
        ) dependencies.stream()
                .filter(
                        dependency ->
                                dependency
                                        .successorInitiativeId()
                                        .equals(
                                                initiativeId
                                        )
                                &&
                                !dependencySatisfied(
                                        dependency
                                )
                )
                .count();
    }

    private boolean milestoneOverdue(
            StrategyRoadmapRepository.MilestoneRow milestone
    ) {
        return milestone.status()
                == RoadmapMilestoneStatus.PLANNED
                &&
                milestone
                        .dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );
    }

    private boolean gateOverdue(
            StrategyRoadmapRepository.GateRow gate
    ) {
        return gate.status()
                == RoadmapGateStatus.PENDING
                &&
                gate
                        .dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );
    }

    private boolean wouldCreateCycle(
            UUID predecessor,
            UUID successor,
            List<StrategyRoadmapRepository.DependencyRow> existing
    ) {
        Map<UUID, Set<UUID>> adjacency =
                new HashMap<>();

        for (
                StrategyRoadmapRepository.DependencyRow dependency
                : existing
        ) {
            adjacency
                    .computeIfAbsent(
                            dependency.predecessorInitiativeId(),
                            ignored ->
                                    new HashSet<>()
                    )
                    .add(
                            dependency.successorInitiativeId()
                    );
        }

        adjacency
                .computeIfAbsent(
                        predecessor,
                        ignored ->
                                new HashSet<>()
                )
                .add(
                        successor
                );

        ArrayDeque<UUID> queue =
                new ArrayDeque<>();

        Set<UUID> visited =
                new HashSet<>();

        queue.add(
                successor
        );

        while (!queue.isEmpty()) {
            UUID current =
                    queue.removeFirst();

            if (
                    current.equals(
                            predecessor
                    )
            ) {
                return true;
            }

            if (!visited.add(
                    current
            )) {
                continue;
            }

            for (
                    UUID next
                    : adjacency
                            .getOrDefault(
                                    current,
                                    Set.of()
                            )
            ) {
                queue.addLast(
                        next
                );
            }
        }

        return false;
    }

    private StrategyRoadmapSnapshotSummaryResponse snapshotSummary(
            StrategyRoadmapRepository.SnapshotRow row
    ) {
        return new StrategyRoadmapSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.roadmapId(),
                row.roadmapNumber(),
                row.roadmapTitle(),
                row.roadmapStatus(),
                mathService
                        .decimal(
                                row.readinessScore()
                        ),
                row.readinessHealth(),
                row.initiativeCount(),
                row.blockedInitiativeCount(),
                row.overdueMilestoneCount(),
                row.rejectedGateCount(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private StrategyRoadmapSummaryResponse frozenRoadmapSummary(
            StrategyRoadmapRepository.RoadmapRow roadmap,
            StrategyRoadmapRepository.SnapshotRow snapshot
    ) {
        return new StrategyRoadmapSummaryResponse(
                roadmap.id(),
                snapshot.roadmapNumber(),
                roadmap.sourceScenarioId(),
                roadmap.sourceScenarioNumber(),
                roadmap.sourceScenarioName(),
                roadmap.currency(),
                roadmap.fiscalYear(),
                snapshot.roadmapTitle(),
                roadmap.objective(),
                roadmap.startDate(),
                roadmap.targetEndDate(),
                snapshot.roadmapStatus(),
                mathService
                        .decimal(
                                roadmap.scenarioBaselineScore()
                        ),
                mathService
                        .decimal(
                                roadmap.scenarioSimulatedScore()
                        ),
                mathService
                        .decimal(
                                roadmap.scenarioDelta()
                        ),
                snapshot.initiativeCount(),
                snapshot.completedInitiativeCount(),
                snapshot.blockedInitiativeCount(),
                snapshot.overdueMilestoneCount(),
                snapshot.rejectedGateCount(),
                mathService
                        .decimal(
                                snapshot.ownerCoveragePct()
                        ),
                mathService
                        .decimal(
                                snapshot.dependencyHealthPct()
                        ),
                mathService
                        .decimal(
                                snapshot.milestoneHealthPct()
                        ),
                mathService
                        .decimal(
                                snapshot.gateHealthPct()
                        ),
                mathService
                        .decimal(
                                snapshot.readinessScore()
                        ),
                snapshot.readinessHealth(),
                roadmap.createdByName(),
                roadmap.createdAt(),
                snapshot.capturedAt(),
                roadmap.version()
        );
    }

    private RoadmapInitiativeResponse snapshotInitiativeResponse(
            StrategyRoadmapRepository.SnapshotItemRow row
    ) {
        return new RoadmapInitiativeResponse(
                row.initiativeId(),
                row.initiativeNumber(),
                row.title(),
                null,
                row.dimensionKey(),
                row.priority(),
                null,
                row.ownerName(),
                "",
                row.plannedStartDate(),
                row.plannedEndDate(),
                mathService
                        .decimal(
                                row.plannedContributionPoints()
                        ),
                row.status(),
                row.blockedDependencyCount(),
                row.overdueMilestoneCount(),
                row.pendingGateCount(),
                row.rejectedGateCount(),
                row.blocked()
        );
    }

    private StrategyRoadmapRepository.RoadmapRow requireRoadmap(
            UUID roadmapId
    ) {
        StrategyRoadmapRepository.RoadmapRow roadmap =
                repository
                        .findRoadmap(
                                roadmapId
                        );

        if (roadmap == null) {
            throw new ResourceNotFoundException(
                    "Strategy roadmap not found: "
                            + roadmapId
            );
        }

        return roadmap;
    }

    private StrategyRoadmapRepository.InitiativeRow requireInitiative(
            UUID initiativeId
    ) {
        StrategyRoadmapRepository.InitiativeRow initiative =
                repository
                        .findInitiative(
                                initiativeId
                        );

        if (initiative == null) {
            throw new ResourceNotFoundException(
                    "Roadmap initiative not found: "
                            + initiativeId
            );
        }

        return initiative;
    }

    private StrategyRoadmapRepository.MilestoneRow requireMilestone(
            UUID milestoneId
    ) {
        StrategyRoadmapRepository.MilestoneRow milestone =
                repository
                        .findMilestone(
                                milestoneId
                        );

        if (milestone == null) {
            throw new ResourceNotFoundException(
                    "Roadmap milestone not found: "
                            + milestoneId
            );
        }

        return milestone;
    }

    private StrategyRoadmapRepository.GateRow requireGate(
            UUID gateId
    ) {
        StrategyRoadmapRepository.GateRow gate =
                repository
                        .findGate(
                                gateId
                        );

        if (gate == null) {
            throw new ResourceNotFoundException(
                    "Roadmap gate not found: "
                            + gateId
            );
        }

        return gate;
    }

    private AppUserEntity requireRoadmapUser(
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
                    "Requester accounts cannot own strategic roadmap initiatives."
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

    private void requirePlanningMutable(
            StrategyRoadmapRepository.RoadmapRow roadmap
    ) {
        if (
                roadmap.status()
                        == StrategyRoadmapStatus.COMPLETED
                ||
                roadmap.status()
                        == StrategyRoadmapStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Completed or archived roadmaps cannot be structurally modified."
            );
        }
    }

    private String nextRoadmapNumber() {
        return String.format(
                "ROADMAP-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextRoadmapSequence()
        );
    }

    private String nextInitiativeNumber() {
        return String.format(
                "RMI-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextInitiativeSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "RMSNAP-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextSnapshotSequence()
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
                    "Your ProcureIQ role cannot access strategic roadmaps."
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
                    "Your ProcureIQ role cannot manage strategic roadmaps."
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
                    "Only administrators and procurement managers can finalize roadmap governance decisions."
            );
        }
    }
}
