package com.procureiq.strategyscenario;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategycockpit.BoardDimensionKey;
import com.procureiq.strategycockpit.BoardHealth;
import com.procureiq.strategycockpit.BoardMovement;
import com.procureiq.strategycockpit.BoardScorecardSummaryResponse;
import com.procureiq.strategycockpit.StrategyCockpitDashboardResponse;
import com.procureiq.strategycockpit.StrategyCockpitService;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class StrategyScenarioService {

    private final StrategyScenarioRepository repository;

    private final StrategyScenarioMathService mathService;

    private final StrategyCockpitService strategyCockpitService;

    private final AppUserRepository appUserRepository;

    public StrategyScenarioService(
            StrategyScenarioRepository repository,
            StrategyScenarioMathService mathService,
            StrategyCockpitService strategyCockpitService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategyCockpitService =
                strategyCockpitService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public StrategyScenarioDashboardResponse dashboard(
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

        StrategyCockpitDashboardResponse board =
                strategyCockpitService
                        .dashboard(
                                currentUserId,
                                normalizedCurrency,
                                fiscalYear
                        );

        List<StrategyScenarioRepository.ScenarioRow> rows =
                repository
                        .scenarios(
                                normalizedCurrency,
                                fiscalYear
                        );

        List<ScenarioWithEvaluation> mapped =
                rows.stream()
                        .map(
                                row ->
                                        new ScenarioWithEvaluation(
                                                row,
                                                repository
                                                        .latestEvaluation(
                                                                row.id()
                                                        )
                                        )
                        )
                        .toList();

        List<ScenarioWithEvaluation> ranked =
                mapped.stream()
                        .filter(
                                scenario ->
                                        scenario.evaluation()
                                                != null
                        )
                        .sorted(
                                Comparator
                                        .comparing(
                                                (
                                                        ScenarioWithEvaluation item
                                                ) ->
                                                        item
                                                                .evaluation()
                                                                .simulatedOverallScore()
                                        )
                                        .reversed()
                                        .thenComparing(
                                                item ->
                                                        item.row()
                                                                .scenarioNumber()
                                        )
                        )
                        .toList();

        Map<UUID, Integer> rankByScenario =
                new java.util.HashMap<>();

        for (
                int index = 0;
                index < ranked.size();
                index++
        ) {
            rankByScenario.put(
                    ranked
                            .get(
                                    index
                            )
                            .row()
                            .id(),
                    index + 1
            );
        }

        return new StrategyScenarioDashboardResponse(
                normalizedCurrency,
                fiscalYear,
                board.current(),
                mapped.stream()
                        .map(
                                scenario ->
                                        scenarioSummary(
                                                scenario.row(),
                                                scenario.evaluation(),
                                                rankByScenario
                                                        .getOrDefault(
                                                                scenario
                                                                        .row()
                                                                        .id(),
                                                                0
                                                        )
                                        )
                        )
                        .toList()
        );
    }

    public StrategyScenarioDetailResponse createScenario(
            UUID currentUserId,
            StrategyScenarioInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String currency =
                normalizeCurrency(
                        input.currency()
                );

        StrategyCockpitDashboardResponse board =
                strategyCockpitService
                        .dashboard(
                                currentUserId,
                                currency,
                                input.fiscalYear()
                        );

        UUID scenarioId =
                UUID.randomUUID();

        repository.createScenario(
                scenarioId,
                nextScenarioNumber(),
                input,
                currency,
                board.current(),
                currentUserId
        );

        return scenario(
                currentUserId,
                scenarioId
        );
    }

    @Transactional(readOnly = true)
    public StrategyScenarioDetailResponse scenario(
            UUID currentUserId,
            UUID scenarioId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyScenarioRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        StrategyScenarioRepository.EvaluationRow latest =
                repository
                        .latestEvaluation(
                                scenarioId
                        );

        return new StrategyScenarioDetailResponse(
                scenarioSummary(
                        scenario,
                        latest,
                        0
                ),
                repository
                        .assumptions(
                                scenarioId
                        )
                        .stream()
                        .map(
                                this::assumptionResponse
                        )
                        .toList(),
                latest == null
                        ? null
                        : evaluationDetail(
                                latest
                        )
        );
    }

    public StrategyScenarioDetailResponse upsertAssumption(
            UUID currentUserId,
            UUID scenarioId,
            StrategyScenarioAssumptionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyScenarioRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        requireEditable(
                scenario
        );

        repository.upsertAssumption(
                UUID.randomUUID(),
                scenarioId,
                input,
                currentUserId
        );

        repository.markScenarioDraft(
                scenarioId
        );

        return scenario(
                currentUserId,
                scenarioId
        );
    }

    public void deleteAssumption(
            UUID currentUserId,
            UUID assumptionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyScenarioRepository.AssumptionRow assumption =
                repository
                        .findAssumption(
                                assumptionId
                        );

        if (assumption == null) {
            throw new ResourceNotFoundException(
                    "Strategy scenario assumption not found: "
                            + assumptionId
            );
        }

        StrategyScenarioRepository.ScenarioRow scenario =
                requireScenario(
                        assumption.scenarioId()
                );

        requireEditable(
                scenario
        );

        repository.deleteAssumption(
                assumptionId
        );

        repository.markScenarioDraft(
                scenario.id()
        );
    }

    public StrategyScenarioEvaluationDetailResponse evaluate(
            UUID currentUserId,
            UUID scenarioId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyScenarioRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        requireEditable(
                scenario
        );

        List<StrategyScenarioRepository.AssumptionRow> assumptions =
                repository
                        .assumptions(
                                scenarioId
                        );

        if (assumptions.isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one governed scenario assumption is required before evaluation."
            );
        }

        Map<BoardDimensionKey, BigDecimal> adjustments =
                new EnumMap<>(
                        BoardDimensionKey.class
                );

        for (
                BoardDimensionKey key
                : BoardDimensionKey.values()
        ) {
            adjustments.put(
                    key,
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            )
            );
        }

        for (
                StrategyScenarioRepository.AssumptionRow assumption
                : assumptions
        ) {
            adjustments.put(
                    assumption.dimensionKey(),
                    assumption.adjustmentPoints()
            );
        }

        List<ScenarioDimensionResult> dimensions =
                new ArrayList<>();

        for (
                BoardDimensionKey key
                : BoardDimensionKey.values()
        ) {
            dimensions.add(
                    mathService
                            .dimension(
                                    key,
                                    baselineScore(
                                            scenario,
                                            key
                                    ),
                                    adjustments
                                            .get(
                                                    key
                                            )
                            )
            );
        }

        BigDecimal simulatedOverall =
                mathService
                        .overallScore(
                                dimensions
                        );

        BigDecimal delta =
                mathService
                        .delta(
                                simulatedOverall,
                                scenario
                                        .baselineOverallScore()
                        );

        BoardMovement movement =
                mathService
                        .movement(
                                simulatedOverall,
                                scenario
                                        .baselineOverallScore()
                        );

        BoardHealth health =
                mathService
                        .health(
                                simulatedOverall
                        );

        int improved =
                (
                        int
                ) dimensions.stream()
                        .filter(
                                dimension ->
                                        dimension
                                                .simulatedScore()
                                                .compareTo(
                                                        dimension
                                                                .baselineScore()
                                                )
                                        > 0
                        )
                        .count();

        int deteriorated =
                (
                        int
                ) dimensions.stream()
                        .filter(
                                dimension ->
                                        dimension
                                                .simulatedScore()
                                                .compareTo(
                                                        dimension
                                                                .baselineScore()
                                                )
                                        < 0
                        )
                        .count();

        String generatedSummary =
                generatedSummary(
                        scenario,
                        simulatedOverall,
                        health,
                        delta,
                        improved,
                        deteriorated,
                        dimensions
                );

        UUID evaluationId =
                UUID.randomUUID();

        repository.createEvaluation(
                evaluationId,
                nextEvaluationNumber(),
                scenarioId,
                scenario.baselineOverallScore(),
                simulatedOverall,
                health,
                delta,
                movement,
                assumptions.size(),
                improved,
                deteriorated,
                generatedSummary,
                currentUserId
        );

        for (
                ScenarioDimensionResult dimension
                : dimensions
        ) {
            repository.createEvaluationDimension(
                    evaluationId,
                    new StrategyScenarioEvaluationDimensionResponse(
                            dimension.key(),
                            label(
                                    dimension.key()
                            ),
                            dimension.weightPct(),
                            dimension.baselineScore(),
                            dimension.adjustmentPoints(),
                            dimension.simulatedScore(),
                            dimension.weightedContribution(),
                            dimension.health()
                    )
            );
        }

        repository.markScenarioEvaluated(
                scenarioId
        );

        return evaluation(
                currentUserId,
                evaluationId
        );
    }

    public StrategyScenarioDetailResponse approve(
            UUID currentUserId,
            UUID scenarioId,
            StrategyScenarioDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyScenarioRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        if (
                scenario.status()
                        != StrategyScenarioStatus.EVALUATED
        ) {
            throw new IllegalArgumentException(
                    "Only evaluated strategy scenarios can be approved."
            );
        }

        if (
                repository
                        .latestEvaluation(
                                scenarioId
                        )
                == null
        ) {
            throw new IllegalArgumentException(
                    "Approved strategy scenarios require an immutable evaluation."
            );
        }

        repository.approveScenario(
                scenarioId,
                input.note(),
                currentUserId
        );

        return scenario(
                currentUserId,
                scenarioId
        );
    }

    public StrategyScenarioDetailResponse archive(
            UUID currentUserId,
            UUID scenarioId,
            StrategyScenarioDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyScenarioRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        if (
                scenario.status()
                        == StrategyScenarioStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Strategy scenario is already archived."
            );
        }

        repository.archiveScenario(
                scenarioId,
                input.note(),
                currentUserId
        );

        return scenario(
                currentUserId,
                scenarioId
        );
    }

    @Transactional(readOnly = true)
    public StrategyScenarioEvaluationDetailResponse evaluation(
            UUID currentUserId,
            UUID evaluationId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyScenarioRepository.EvaluationRow evaluation =
                repository
                        .findEvaluation(
                                evaluationId
                        );

        if (evaluation == null) {
            throw new ResourceNotFoundException(
                    "Strategy scenario evaluation not found: "
                            + evaluationId
            );
        }

        return evaluationDetail(
                evaluation
        );
    }

    private StrategyScenarioEvaluationDetailResponse evaluationDetail(
            StrategyScenarioRepository.EvaluationRow evaluation
    ) {
        return new StrategyScenarioEvaluationDetailResponse(
                evaluationSummary(
                        evaluation
                ),
                evaluation.generatedSummary(),
                repository
                        .evaluationDimensions(
                                evaluation.id()
                        )
                        .stream()
                        .map(
                                this::evaluationDimensionResponse
                        )
                        .toList()
        );
    }

    private StrategyScenarioSummaryResponse scenarioSummary(
            StrategyScenarioRepository.ScenarioRow row,
            StrategyScenarioRepository.EvaluationRow evaluation,
            int rank
    ) {
        return new StrategyScenarioSummaryResponse(
                row.id(),
                row.scenarioNumber(),
                row.name(),
                row.description(),
                row.currency(),
                row.fiscalYear(),
                row.status(),
                mathService
                        .bounded(
                                row.baselineOverallScore()
                        ),
                row.baselineHealth(),
                evaluation == null
                        ? null
                        : mathService
                                .bounded(
                                        evaluation.simulatedOverallScore()
                                ),
                evaluation == null
                        ? null
                        : evaluation.simulatedHealth(),
                evaluation == null
                        ? null
                        : mathService
                                .decimal(
                                        evaluation.scoreDelta()
                                ),
                evaluation == null
                        ? null
                        : evaluation.movement(),
                repository
                        .assumptions(
                                row.id()
                        )
                        .size(),
                rank,
                row.approvalNote(),
                row.approvedByName(),
                row.approvedAt(),
                row.archiveNote(),
                row.createdByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private StrategyScenarioAssumptionResponse assumptionResponse(
            StrategyScenarioRepository.AssumptionRow row
    ) {
        return new StrategyScenarioAssumptionResponse(
                row.id(),
                row.dimensionKey(),
                label(
                        row.dimensionKey()
                ),
                mathService
                        .decimal(
                                row.adjustmentPoints()
                        ),
                row.rationale(),
                row.createdByName(),
                row.updatedByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private StrategyScenarioEvaluationSummaryResponse evaluationSummary(
            StrategyScenarioRepository.EvaluationRow row
    ) {
        return new StrategyScenarioEvaluationSummaryResponse(
                row.id(),
                row.evaluationNumber(),
                row.scenarioId(),
                mathService
                        .bounded(
                                row.baselineOverallScore()
                        ),
                mathService
                        .bounded(
                                row.simulatedOverallScore()
                        ),
                row.simulatedHealth(),
                mathService
                        .decimal(
                                row.scoreDelta()
                        ),
                row.movement(),
                row.assumptionCount(),
                row.improvedDimensionCount(),
                row.deterioratedDimensionCount(),
                row.evaluatedByName(),
                row.evaluatedAt()
        );
    }

    private StrategyScenarioEvaluationDimensionResponse evaluationDimensionResponse(
            StrategyScenarioRepository.EvaluationDimensionRow row
    ) {
        return new StrategyScenarioEvaluationDimensionResponse(
                row.dimensionKey(),
                row.dimensionLabel(),
                mathService
                        .decimal(
                                row.weightPct()
                        ),
                mathService
                        .bounded(
                                row.baselineScore()
                        ),
                mathService
                        .decimal(
                                row.adjustmentPoints()
                        ),
                mathService
                        .bounded(
                                row.simulatedScore()
                        ),
                mathService
                        .decimal(
                                row.weightedContribution()
                        ),
                row.health()
        );
    }

    private BigDecimal baselineScore(
            StrategyScenarioRepository.ScenarioRow scenario,
            BoardDimensionKey key
    ) {
        return switch (
                key
        ) {
            case OBJECTIVE_EXECUTION ->
                    scenario
                            .baselineObjectiveExecutionScore();

            case STRATEGIC_ALIGNMENT ->
                    scenario
                            .baselineStrategicAlignmentScore();

            case CAPACITY_READINESS ->
                    scenario
                            .baselineCapacityScore();

            case CAPABILITY_READINESS ->
                    scenario
                            .baselineCapabilityScore();

            case SUCCESSION_RESILIENCE ->
                    scenario
                            .baselineSuccessionScore();
        };
    }

    private String label(
            BoardDimensionKey key
    ) {
        return switch (
                key
        ) {
            case OBJECTIVE_EXECUTION ->
                    "Objective execution";

            case STRATEGIC_ALIGNMENT ->
                    "Strategic alignment";

            case CAPACITY_READINESS ->
                    "Capacity readiness";

            case CAPABILITY_READINESS ->
                    "Capability readiness";

            case SUCCESSION_RESILIENCE ->
                    "Succession resilience";
        };
    }

    private String generatedSummary(
            StrategyScenarioRepository.ScenarioRow scenario,
            BigDecimal simulatedOverall,
            BoardHealth health,
            BigDecimal delta,
            int improved,
            int deteriorated,
            List<ScenarioDimensionResult> dimensions
    ) {
        ScenarioDimensionResult strongest =
                dimensions.stream()
                        .max(
                                Comparator.comparing(
                                        ScenarioDimensionResult::
                                                adjustmentPoints
                                )
                        )
                        .orElseThrow();

        ScenarioDimensionResult weakest =
                dimensions.stream()
                        .min(
                                Comparator.comparing(
                                        ScenarioDimensionResult::
                                                adjustmentPoints
                                )
                        )
                        .orElseThrow();

        return "Scenario "
                + scenario.scenarioNumber()
                + " simulates an enterprise procurement score of "
                + simulatedOverall.setScale(
                        1,
                        RoundingMode.HALF_UP
                )
                + "/100 ("
                + health.name()
                + "), a "
                + signed(
                        delta
                )
                + " point change versus its frozen "
                + scenario
                        .baselineOverallScore()
                        .setScale(
                                1,
                                RoundingMode.HALF_UP
                        )
                + " baseline. "
                + improved
                + " dimension(s) improve and "
                + deteriorated
                + " deteriorate. Largest positive assumption: "
                + label(
                        strongest.key()
                )
                + " "
                + signed(
                        strongest.adjustmentPoints()
                )
                + " points. Largest negative assumption: "
                + label(
                        weakest.key()
                )
                + " "
                + signed(
                        weakest.adjustmentPoints()
                )
                + " points. Simulation is advisory and does not mutate source authorities.";
    }

    private String signed(
            BigDecimal value
    ) {
        BigDecimal normalized =
                mathService
                        .decimal(
                                value
                        );

        return normalized.compareTo(
                BigDecimal.ZERO
        ) > 0
                ? "+"
                + normalized
                        .setScale(
                                1,
                                RoundingMode.HALF_UP
                        )
                : normalized
                        .setScale(
                                1,
                                RoundingMode.HALF_UP
                        )
                        .toString();
    }

    private StrategyScenarioRepository.ScenarioRow requireScenario(
            UUID scenarioId
    ) {
        StrategyScenarioRepository.ScenarioRow scenario =
                repository
                        .findScenario(
                                scenarioId
                        );

        if (scenario == null) {
            throw new ResourceNotFoundException(
                    "Procurement strategy scenario not found: "
                            + scenarioId
            );
        }

        return scenario;
    }

    private void requireEditable(
            StrategyScenarioRepository.ScenarioRow scenario
    ) {
        if (
                scenario.status()
                        == StrategyScenarioStatus.APPROVED
                ||
                scenario.status()
                        == StrategyScenarioStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Approved or archived strategy scenarios are immutable."
            );
        }
    }

    private String nextScenarioNumber() {
        return String.format(
                "SCN-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextScenarioSequence()
        );
    }

    private String nextEvaluationNumber() {
        return String.format(
                "SCNEVAL-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextEvaluationSequence()
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
                    "Strategy-scenario currency must contain exactly three characters."
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
                    "Your ProcureIQ role cannot access strategy scenarios."
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
                    "Your ProcureIQ role cannot manage strategy scenarios."
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
                    "Only administrators and procurement managers can approve or archive strategy scenarios."
            );
        }
    }

    private record ScenarioWithEvaluation(
            StrategyScenarioRepository.ScenarioRow row,
            StrategyScenarioRepository.EvaluationRow evaluation
    ) {
    }
}
