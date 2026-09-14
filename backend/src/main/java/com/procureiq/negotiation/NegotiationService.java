package com.procureiq.negotiation;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class NegotiationService {

    private final NegotiationRepository repository;

    private final NegotiationCalculationService calculationService;

    private final AppUserRepository appUserRepository;

    public NegotiationService(
            NegotiationRepository repository,
            NegotiationCalculationService calculationService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.calculationService =
                calculationService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<NegotiationWorkspaceResponse> workspaces(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return repository
                .findWorkspaces()
                .stream()
                .map(
                        this::workspaceResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public NegotiationWorkspaceResponse workspace(
            UUID currentUserId,
            UUID workspaceId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return workspaceResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    public NegotiationWorkspaceResponse createWorkspace(
            UUID currentUserId,
            NegotiationWorkspaceInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        NegotiationRepository.QuotationRow quotation =
                repository
                        .findQuotation(
                                input.baselineQuotationId()
                        );

        if (quotation == null) {
            throw new ResourceNotFoundException(
                    "Baseline quotation not found: "
                            + input.baselineQuotationId()
            );
        }

        if (
                !"SUBMITTED".equals(
                        quotation.status()
                )
        ) {
            throw new IllegalArgumentException(
                    "Only submitted quotations can establish a negotiation baseline."
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

        UUID workspaceId =
                UUID.randomUUID();

        try {
            repository.createWorkspace(
                    workspaceId,
                    nextNegotiationNumber(),
                    quotation,
                    ownerId,
                    input.notes()
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "A negotiation workspace already exists for this RFQ and supplier."
            );
        }

        return workspaceResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    public NegotiationWorkspaceResponse activate(
            UUID currentUserId,
            UUID workspaceId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        NegotiationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        if (
                workspace.status()
                        != NegotiationWorkspaceStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft negotiation workspaces can be activated."
            );
        }

        repository.updateWorkspaceStatus(
                workspaceId,
                NegotiationWorkspaceStatus.ACTIVE
        );

        return workspaceResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    public NegotiationScenarioResponse addScenario(
            UUID currentUserId,
            UUID workspaceId,
            NegotiationScenarioInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        NegotiationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        if (
                workspace.status()
                        != NegotiationWorkspaceStatus.DRAFT
                &&
                workspace.status()
                        != NegotiationWorkspaceStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Scenarios can only be added to draft or active negotiation workspaces."
            );
        }

        validateScenarioBoundaries(
                workspace,
                input
        );

        BigDecimal savings =
                calculationService
                        .savings(
                                workspace.baselineValue(),
                                input.totalValue()
                        );

        BigDecimal savingsPct =
                calculationService
                        .savingsPercentage(
                                workspace.baselineValue(),
                                input.totalValue()
                        );

        BigDecimal score =
                calculationService
                        .scenarioScore(
                                workspace.baselineValue(),
                                input.totalValue(),
                                input.paymentTermsDays(),
                                input.leadTimeDays(),
                                input.warrantyMonths()
                        );

        if (input.preferred()) {
            repository.clearPreferredScenarios(
                    workspaceId
            );
        }

        UUID scenarioId =
                UUID.randomUUID();

        repository.createScenario(
                scenarioId,
                workspaceId,
                input,
                savings,
                savingsPct,
                score,
                currentUserId
        );

        if (
                input.scenarioType()
                        == NegotiationScenarioType.TARGET
        ) {
            repository.updateTarget(
                    workspaceId,
                    input.totalValue(),
                    savings
            );
        }

        if (
                input.scenarioType()
                        == NegotiationScenarioType.WALK_AWAY
        ) {
            repository.updateWalkAway(
                    workspaceId,
                    input.totalValue()
            );
        }

        return scenarioResponse(
                requireScenario(
                        scenarioId
                )
        );
    }

    public NegotiationRoundResponse addRound(
            UUID currentUserId,
            UUID workspaceId,
            NegotiationRoundInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        NegotiationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        if (
                workspace.status()
                        != NegotiationWorkspaceStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Negotiation rounds can only be logged while the workspace is active."
            );
        }

        int roundNumber =
                repository
                        .nextRoundNumber(
                                workspaceId
                        );

        UUID roundId =
                UUID.randomUUID();

        repository.createRound(
                roundId,
                workspaceId,
                roundNumber,
                input,
                currentUserId
        );

        return repository
                .findRounds(
                        workspaceId
                )
                .stream()
                .filter(
                        round ->
                                round.id()
                                        .equals(
                                                roundId
                                        )
                )
                .map(
                        this::roundResponse
                )
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "Created negotiation round could not be reloaded."
                                )
                );
    }

    public NegotiationWorkspaceResponse agreeScenario(
            UUID currentUserId,
            UUID workspaceId,
            UUID scenarioId
    ) {
        assertAgreementRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        NegotiationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        if (
                workspace.status()
                        != NegotiationWorkspaceStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only active negotiation workspaces can record a final agreement."
            );
        }

        NegotiationRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        if (
                !scenario.workspaceId()
                        .equals(
                                workspaceId
                        )
        ) {
            throw new IllegalArgumentException(
                    "Selected negotiation scenario does not belong to this workspace."
            );
        }

        if (
                workspace.walkAwayValue()
                        != null
                &&
                scenario.totalValue()
                        .compareTo(
                                workspace.walkAwayValue()
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "The selected agreement exceeds the configured walk-away value."
            );
        }

        BigDecimal agreedSavings =
                calculationService
                        .savings(
                                workspace.baselineValue(),
                                scenario.totalValue()
                        );

        repository.agreeScenario(
                workspaceId,
                scenarioId,
                scenario.totalValue(),
                agreedSavings
        );

        return workspaceResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    public NegotiationWorkspaceResponse close(
            UUID currentUserId,
            UUID workspaceId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        NegotiationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        if (
                workspace.status()
                        != NegotiationWorkspaceStatus.AGREED
        ) {
            throw new IllegalArgumentException(
                    "Only agreed negotiations can be closed."
            );
        }

        repository.updateWorkspaceStatus(
                workspaceId,
                NegotiationWorkspaceStatus.CLOSED
        );

        return workspaceResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    public NegotiationWorkspaceResponse cancel(
            UUID currentUserId,
            UUID workspaceId
    ) {
        assertAgreementRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        NegotiationRepository.WorkspaceRow workspace =
                requireWorkspace(
                        workspaceId
                );

        if (
                workspace.status()
                        != NegotiationWorkspaceStatus.DRAFT
                &&
                workspace.status()
                        != NegotiationWorkspaceStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only draft or active negotiations can be cancelled."
            );
        }

        repository.updateWorkspaceStatus(
                workspaceId,
                NegotiationWorkspaceStatus.CANCELLED
        );

        return workspaceResponse(
                requireWorkspace(
                        workspaceId
                )
        );
    }

    @Transactional(readOnly = true)
    public NegotiationSummaryResponse summary(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<NegotiationRepository.WorkspaceRow> workspaces =
                repository
                        .findWorkspaces();

        long drafts =
                countStatus(
                        workspaces,
                        NegotiationWorkspaceStatus.DRAFT
                );

        long active =
                countStatus(
                        workspaces,
                        NegotiationWorkspaceStatus.ACTIVE
                );

        long agreed =
                countStatus(
                        workspaces,
                        NegotiationWorkspaceStatus.AGREED
                );

        long closed =
                countStatus(
                        workspaces,
                        NegotiationWorkspaceStatus.CLOSED
                );

        long suppliers =
                workspaces.stream()
                        .filter(
                                workspace ->
                                        workspace.status()
                                                != NegotiationWorkspaceStatus.CANCELLED
                        )
                        .map(
                                NegotiationRepository.WorkspaceRow::
                                        supplierId
                        )
                        .distinct()
                        .count();

        BigDecimal baselinePipeline =
                workspaces.stream()
                        .filter(
                                workspace ->
                                        workspace.status()
                                                == NegotiationWorkspaceStatus.DRAFT
                                        ||
                                        workspace.status()
                                                == NegotiationWorkspaceStatus.ACTIVE
                        )
                        .map(
                                NegotiationRepository.WorkspaceRow::
                                        baselineValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal targetSavings =
                workspaces.stream()
                        .filter(
                                workspace ->
                                        workspace.status()
                                                != NegotiationWorkspaceStatus.CANCELLED
                        )
                        .map(
                                NegotiationRepository.WorkspaceRow::
                                        targetSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        List<NegotiationRepository.WorkspaceRow> agreedWorkspaces =
                workspaces.stream()
                        .filter(
                                workspace ->
                                        workspace.status()
                                                == NegotiationWorkspaceStatus.AGREED
                                        ||
                                        workspace.status()
                                                == NegotiationWorkspaceStatus.CLOSED
                        )
                        .toList();

        BigDecimal agreedSavings =
                agreedWorkspaces.stream()
                        .map(
                                NegotiationRepository.WorkspaceRow::
                                        agreedSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal averagePct =
                agreedWorkspaces.isEmpty()
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : agreedWorkspaces
                                .stream()
                                .map(
                                        workspace ->
                                                calculationService
                                                        .savingsPercentage(
                                                                workspace.baselineValue(),
                                                                workspace.agreedValue()
                                                        )
                                )
                                .reduce(
                                        BigDecimal.ZERO,
                                        BigDecimal::add
                                )
                                .divide(
                                        BigDecimal.valueOf(
                                                agreedWorkspaces.size()
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new NegotiationSummaryResponse(
                workspaces.size(),
                drafts,
                active,
                agreed,
                closed,
                suppliers,
                money(
                        baselinePipeline
                ),
                money(
                        targetSavings
                ),
                money(
                        agreedSavings
                ),
                averagePct
        );
    }

    @Transactional(readOnly = true)
    public NegotiationContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new NegotiationContextResponse(
                repository.quotations(),
                repository.users()
        );
    }

    private void validateScenarioBoundaries(
            NegotiationRepository.WorkspaceRow workspace,
            NegotiationScenarioInput input
    ) {
        if (
                input.scenarioType()
                        == NegotiationScenarioType.TARGET
                &&
                workspace.walkAwayValue()
                        != null
                &&
                input.totalValue()
                        .compareTo(
                                workspace.walkAwayValue()
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Target value cannot exceed the configured walk-away value."
            );
        }

        if (
                input.scenarioType()
                        == NegotiationScenarioType.WALK_AWAY
                &&
                workspace.targetValue()
                        != null
                &&
                input.totalValue()
                        .compareTo(
                                workspace.targetValue()
                        ) < 0
        ) {
            throw new IllegalArgumentException(
                    "Walk-away value cannot be below the configured negotiation target."
            );
        }
    }

    private NegotiationWorkspaceResponse workspaceResponse(
            NegotiationRepository.WorkspaceRow row
    ) {
        NegotiationRepository.AwardOutcomeRow award =
                repository
                        .awardOutcome(
                                row.rfqId()
                        );

        BigDecimal awardSavings =
                award == null
                        ? null
                        : calculationService
                                .savings(
                                        row.baselineValue(),
                                        award.awardValue()
                                );

        BigDecimal agreementToAwardDelta =
                award == null
                        ||
                        row.agreedValue()
                                == null
                        ? null
                        : award.awardValue()
                                .subtract(
                                        row.agreedValue()
                                )
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                );

        Boolean supplierMatches =
                award == null
                        ? null
                        : award.supplierId()
                                .equals(
                                        row.supplierId()
                                );

        BigDecimal agreedPct =
                row.agreedValue()
                        == null
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : calculationService
                                .savingsPercentage(
                                        row.baselineValue(),
                                        row.agreedValue()
                                );

        return new NegotiationWorkspaceResponse(
                row.id(),
                row.negotiationNumber(),
                row.rfqId(),
                row.rfqNumber(),
                row.rfqTitle(),
                row.supplierId(),
                row.supplierName(),
                row.supplierRiskLevel(),
                row.baselineQuotationId(),
                row.baselineQuotationReference(),
                row.status(),
                row.currency(),
                money(
                        row.baselineValue()
                ),
                moneyNullable(
                        row.targetValue()
                ),
                moneyNullable(
                        row.walkAwayValue()
                ),
                moneyNullable(
                        row.agreedValue()
                ),
                money(
                        row.targetSavings()
                ),
                money(
                        row.agreedSavings()
                ),
                agreedPct,
                row.agreedScenarioId(),
                row.ownerUserId(),
                row.ownerName(),
                row.notes(),
                row.agreedAt(),
                row.closedAt(),
                award == null
                        ? null
                        : award.quotationId(),
                award == null
                        ? null
                        : award.supplierId(),
                award == null
                        ? null
                        : award.supplierName(),
                award == null
                        ? null
                        : money(
                                award.awardValue()
                        ),
                moneyNullable(
                        awardSavings
                ),
                moneyNullable(
                        agreementToAwardDelta
                ),
                supplierMatches,
                repository
                        .findScenarios(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::scenarioResponse
                        )
                        .toList(),
                repository
                        .findRounds(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::roundResponse
                        )
                        .toList(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private NegotiationScenarioResponse scenarioResponse(
            NegotiationRepository.ScenarioRow row
    ) {
        return new NegotiationScenarioResponse(
                row.id(),
                row.workspaceId(),
                row.name(),
                row.scenarioType(),
                money(
                        row.totalValue()
                ),
                row.paymentTermsDays(),
                row.leadTimeDays(),
                row.warrantyMonths(),
                row.volumeCommitment(),
                money(
                        row.priceSavings()
                ),
                row.savingsPct()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                row.scenarioScore()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                row.preferred(),
                row.notes(),
                row.createdByUserId(),
                row.createdByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private NegotiationRoundResponse roundResponse(
            NegotiationRepository.RoundRow row
    ) {
        return new NegotiationRoundResponse(
                row.id(),
                row.workspaceId(),
                row.roundNumber(),
                row.actorSide(),
                money(
                        row.offerValue()
                ),
                row.paymentTermsDays(),
                row.leadTimeDays(),
                row.warrantyMonths(),
                row.volumeCommitment(),
                row.notes(),
                row.createdByUserId(),
                row.createdByName(),
                row.roundAt(),
                row.createdAt()
        );
    }

    private NegotiationRepository.WorkspaceRow requireWorkspace(
            UUID workspaceId
    ) {
        NegotiationRepository.WorkspaceRow workspace =
                repository
                        .findWorkspace(
                                workspaceId
                        );

        if (workspace == null) {
            throw new ResourceNotFoundException(
                    "Negotiation workspace not found: "
                            + workspaceId
            );
        }

        return workspace;
    }

    private NegotiationRepository.ScenarioRow requireScenario(
            UUID scenarioId
    ) {
        NegotiationRepository.ScenarioRow scenario =
                repository
                        .findScenario(
                                scenarioId
                        );

        if (scenario == null) {
            throw new ResourceNotFoundException(
                    "Negotiation scenario not found: "
                            + scenarioId
            );
        }

        return scenario;
    }

    private long countStatus(
            List<NegotiationRepository.WorkspaceRow> workspaces,
            NegotiationWorkspaceStatus status
    ) {
        return workspaces.stream()
                .filter(
                        workspace ->
                                workspace.status()
                                        == status
                )
                .count();
    }

    private String nextNegotiationNumber() {
        Long sequence =
                repository
                        .nextNegotiationSequence();

        return String.format(
                "NEG-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
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
                    "Negotiation ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access sourcing negotiations."
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
                    "Your ProcureIQ role cannot manage sourcing negotiations."
            );
        }
    }

    private void assertAgreementRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can finalize or cancel negotiated agreements."
            );
        }
    }
}
