package com.procureiq.flywheelallocation;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.flywheelstrategy.FlywheelStrategyDecision;
import com.procureiq.flywheelstrategy.FlywheelStrategyItemResponse;
import com.procureiq.flywheelstrategy.FlywheelStrategyPortfolioDetailResponse;
import com.procureiq.flywheelstrategy.FlywheelStrategyPortfolioResponse;
import com.procureiq.flywheelstrategy.FlywheelStrategyPortfolioStatus;
import com.procureiq.flywheelstrategy.FlywheelStrategyService;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class FlywheelAllocationService {

    private final FlywheelAllocationRepository repository;

    private final FlywheelAllocationMathService mathService;

    private final FlywheelStrategyService strategyService;

    private final AppUserRepository appUserRepository;

    public FlywheelAllocationService(
            FlywheelAllocationRepository repository,
            FlywheelAllocationMathService mathService,
            FlywheelStrategyService strategyService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategyService =
                strategyService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public FlywheelAllocationDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<FlywheelAllocationStrategyResponse> strategies =
                eligibleStrategies(
                        currentUserId
                );

        List<FlywheelAllocationMandateResponse> mandates =
                repository
                        .mandates()
                        .stream()
                        .map(
                                this::mandateResponse
                        )
                        .toList();

        return new FlywheelAllocationDashboardResponse(
                summary(
                        strategies.size(),
                        mandates
                ),

                repository.users(),

                strategies,

                mandates,

                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelAllocationMandateDetailResponse createMandate(
            UUID currentUserId,
            FlywheelAllocationMandateInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelStrategyPortfolioDetailResponse strategyDetail =
                requireApprovedStrategy(
                        currentUserId,
                        input.strategyPortfolioId()
                );

        if (
                repository.hasOpenMandateForStrategy(
                        input.strategyPortfolioId()
                )
        ) {
            throw new IllegalArgumentException(
                    "The approved Step 67 strategy portfolio already has an open allocation mandate."
            );
        }

        AppUserEntity owner =
                requireMandateOwner(
                        input.mandateOwnerUserId()
                );

        FlywheelAllocationStrategyResponse strategy =
                strategyResponse(
                        strategyDetail.portfolio()
                );

        if (
                strategy.prioritizedCapacityAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Step 67 strategy contains no prioritized capital capacity."
            );
        }

        UUID mandateId =
                UUID.randomUUID();

        repository.createMandate(
                mandateId,
                nextMandateNumber(),
                input,
                strategy,
                owner.getFullName(),
                currentUserId
        );

        return mandate(
                currentUserId,
                mandateId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelAllocationMandateDetailResponse mandate(
            UUID currentUserId,
            UUID mandateId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelAllocationRepository.MandateRow mandate =
                requireMandate(
                        mandateId
                );

        FlywheelStrategyPortfolioDetailResponse strategyDetail =
                strategyService.portfolio(
                        currentUserId,
                        mandate.strategyPortfolioId()
                );

        List<FlywheelAllocationCandidateItemResponse> candidates =
                strategyDetail
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.decision()
                                                == FlywheelStrategyDecision.PRIORITIZE
                        )
                        .filter(
                                item ->
                                        repository
                                                .items(
                                                        mandateId
                                                )
                                                .stream()
                                                .noneMatch(
                                                        existing ->
                                                                existing
                                                                        .strategyItemId()
                                                                        .equals(
                                                                                item.id()
                                                                        )
                                                )
                        )
                        .map(
                                this::candidateItem
                        )
                        .toList();

        return new FlywheelAllocationMandateDetailResponse(
                mandateResponse(
                        mandate
                ),

                strategyResponse(
                        strategyDetail.portfolio()
                ),

                repository.users(),

                candidates,

                repository
                        .items(
                                mandateId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList(),

                repository
                        .snapshotsForMandate(
                                mandateId
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelAllocationMandateDetailResponse addItem(
            UUID currentUserId,
            UUID mandateId,
            FlywheelAllocationItemInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelAllocationRepository.MandateRow mandate =
                requireMandate(
                        mandateId
                );

        if (
                mandate.status()
                        != FlywheelAllocationMandateStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Allocation items can be added only while the mandate is DRAFT."
            );
        }

        FlywheelStrategyPortfolioDetailResponse strategyDetail =
                requireApprovedStrategy(
                        currentUserId,
                        mandate.strategyPortfolioId()
                );

        FlywheelStrategyItemResponse source =
                strategyDetail
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        input.strategyItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Step 67 strategy item does not belong to the source portfolio."
                                        )
                        );

        if (
                source.decision()
                        != FlywheelStrategyDecision.PRIORITIZE
        ) {
            throw new IllegalArgumentException(
                    "Only Step 67 PRIORITIZE decisions may become allocation-mandate items."
            );
        }

        if (
                repository
                        .items(
                                mandateId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.strategyItemId()
                                                .equals(
                                                        source.id()
                                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 67 strategy item already belongs to this mandate."
            );
        }

        BigDecimal requested =
                mathService.money(
                        input.requestedAllocationAmount()
                );

        if (
                requested.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Requested allocation must be positive."
            );
        }

        if (
                requested.compareTo(
                        mathService.money(
                                source.proposedCapacityAmount()
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Requested allocation cannot exceed the Step 67 proposed capacity for this lineage."
            );
        }

        BigDecimal existing =
                repository
                        .items(
                                mandateId
                        )
                        .stream()
                        .map(
                                FlywheelAllocationRepository.ItemRow::
                                        requestedAllocationAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal resulting =
                existing.add(
                        requested
                );

        if (
                resulting.compareTo(
                        mathService.money(
                                mandate.strategyPrioritizedCapacityAmount()
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Requested mandate allocation would exceed Step 67 prioritized strategy capacity."
            );
        }

        repository.createItem(
                UUID.randomUUID(),
                mandateId,
                candidateItem(
                        source
                ),
                requested,
                currentUserId
        );

        return mandate(
                currentUserId,
                mandateId
        );
    }

    public FlywheelAllocationMandateDetailResponse submitForReview(
            UUID currentUserId,
            UUID mandateId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelAllocationRepository.MandateRow mandate =
                requireMandate(
                        mandateId
                );

        if (
                mandate.status()
                        != FlywheelAllocationMandateStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only a DRAFT allocation mandate can enter review."
            );
        }

        List<FlywheelAllocationRepository.ItemRow> items =
                repository.items(
                        mandateId
                );

        if (items.isEmpty()) {
            throw new IllegalArgumentException(
                    "Allocation mandate requires at least one prioritized Step 67 lineage."
            );
        }

        validateStrategyAuthority(
                currentUserId,
                mandate,
                items
        );

        FlywheelAllocationMetricResult metric =
                allocationMetric(
                        mandate,
                        items
                );

        if (
                metric.requestedAllocationAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Allocation mandate contains no positive requested capacity."
            );
        }

        if (
                metric.requestedAllocationAmount()
                        .compareTo(
                                mathService.money(
                                        mandate.strategyPrioritizedCapacityAmount()
                                )
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Allocation mandate exceeds Step 67 prioritized strategy capacity."
            );
        }

        int updated =
                repository.submitForReview(
                        mandateId,
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Allocation mandate state changed before review submission."
            );
        }

        return mandate(
                currentUserId,
                mandateId
        );
    }

    public FlywheelAllocationMandateDetailResponse authorize(
            UUID currentUserId,
            UUID mandateId,
            FlywheelAllocationNoteInput input
    ) {
        assertAuthorizeRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelAllocationRepository.MandateRow mandate =
                requireMandate(
                        mandateId
                );

        if (
                mandate.status()
                        != FlywheelAllocationMandateStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only an IN_REVIEW allocation mandate can be authorized."
            );
        }

        List<FlywheelAllocationRepository.ItemRow> items =
                repository.items(
                        mandateId
                );

        if (items.isEmpty()) {
            throw new IllegalArgumentException(
                    "Allocation mandate contains no items."
            );
        }

        validateStrategyAuthority(
                currentUserId,
                mandate,
                items
        );

        FlywheelAllocationMetricResult metric =
                allocationMetric(
                        mandate,
                        items
                );

        if (
                metric.requestedAllocationAmount()
                        .compareTo(
                                mathService.money(
                                        mandate.strategyPrioritizedCapacityAmount()
                                )
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Authorization would exceed Step 67 prioritized strategy capacity."
            );
        }

        int updated =
                repository.authorize(
                        mandateId,
                        input.note(),
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Allocation mandate state changed before authorization."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                mandateId
        );

        return mandate(
                currentUserId,
                mandateId
        );
    }

    public FlywheelAllocationMandateDetailResponse close(
            UUID currentUserId,
            UUID mandateId,
            FlywheelAllocationNoteInput input
    ) {
        assertAuthorizeRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelAllocationRepository.MandateRow mandate =
                requireMandate(
                        mandateId
                );

        if (
                mandate.status()
                        != FlywheelAllocationMandateStatus.AUTHORIZED
        ) {
            throw new IllegalArgumentException(
                    "Only an AUTHORIZED allocation mandate can be closed."
            );
        }

        int updated =
                repository.close(
                        mandateId,
                        input.note(),
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Allocation mandate state changed before closure."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                mandateId
        );

        return mandate(
                currentUserId,
                mandateId
        );
    }

    public FlywheelAllocationSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID mandateId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        requireMandate(
                mandateId
        );

        return captureSnapshotInternal(
                currentUserId,
                mandateId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelAllocationSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelAllocationRepository.SnapshotRow snapshot =
                repository.findSnapshot(
                        snapshotId
                );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Flywheel allocation snapshot not found: "
                            + snapshotId
            );
        }

        return new FlywheelAllocationSnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),

                repository
                        .snapshotItems(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotItemResponse
                        )
                        .toList()
        );
    }

    private FlywheelAllocationSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId,
            UUID mandateId
    ) {
        FlywheelAllocationRepository.MandateRow mandate =
                requireMandate(
                        mandateId
                );

        FlywheelAllocationMandateResponse response =
                mandateResponse(
                        mandate
                );

        List<FlywheelAllocationItemResponse> items =
                repository
                        .items(
                                mandateId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                response,
                currentUserId
        );

        for (
                FlywheelAllocationItemResponse item
                : items
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    item
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<FlywheelAllocationStrategyResponse> eligibleStrategies(
            UUID currentUserId
    ) {
        return strategyService
                .dashboard(
                        currentUserId
                )
                .portfolios()
                .stream()
                .filter(
                        portfolio ->
                                portfolio.status()
                                        == FlywheelStrategyPortfolioStatus.APPROVED
                )
                .filter(
                        portfolio ->
                                portfolio.prioritizeCount()
                                        > 0
                )
                .filter(
                        portfolio ->
                                portfolio.prioritizedCapacityAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        ) > 0
                )
                .filter(
                        portfolio ->
                                !repository.hasOpenMandateForStrategy(
                                        portfolio.id()
                                )
                )
                .map(
                        this::strategyResponse
                )
                .toList();
    }

    private FlywheelStrategyPortfolioDetailResponse requireApprovedStrategy(
            UUID currentUserId,
            UUID strategyPortfolioId
    ) {
        FlywheelStrategyPortfolioDetailResponse detail =
                strategyService.portfolio(
                        currentUserId,
                        strategyPortfolioId
                );

        if (
                detail
                        .portfolio()
                        .status()
                        != FlywheelStrategyPortfolioStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Step 68 requires an APPROVED Step 67 strategy portfolio."
            );
        }

        return detail;
    }

    private void validateStrategyAuthority(
            UUID currentUserId,
            FlywheelAllocationRepository.MandateRow mandate,
            List<FlywheelAllocationRepository.ItemRow> mandateItems
    ) {
        FlywheelStrategyPortfolioDetailResponse strategy =
                requireApprovedStrategy(
                        currentUserId,
                        mandate.strategyPortfolioId()
                );

        FlywheelStrategyPortfolioResponse portfolio =
                strategy.portfolio();

        if (
                !portfolio
                        .portfolioNumber()
                        .equals(
                                mandate.strategyPortfolioNumber()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 67 portfolio identity changed after mandate capture."
            );
        }

        if (
                !portfolio
                        .currency()
                        .equalsIgnoreCase(
                                mandate.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 67 strategy currency no longer matches the mandate."
            );
        }

        if (
                mathService
                        .money(
                                portfolio.prioritizedCapacityAmount()
                        )
                        .compareTo(
                                mathService.money(
                                        mandate.strategyPrioritizedCapacityAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 67 prioritized capacity changed after mandate creation."
            );
        }

        for (
                FlywheelAllocationRepository.ItemRow mandateItem
                : mandateItems
        ) {
            FlywheelStrategyItemResponse source =
                    strategy
                            .items()
                            .stream()
                            .filter(
                                    item ->
                                            item.id()
                                                    .equals(
                                                            mandateItem.strategyItemId()
                                                    )
                            )
                            .findFirst()
                            .orElseThrow(
                                    () ->
                                            new IllegalArgumentException(
                                                    "Step 67 source strategy item no longer exists."
                                            )
                            );

            if (
                    source.decision()
                            != FlywheelStrategyDecision.PRIORITIZE
            ) {
                throw new IllegalArgumentException(
                        "A mandate source item is no longer PRIORITIZE in Step 67."
                );
            }

            if (
                    !source
                            .flywheelLineageId()
                            .equals(
                                    mandateItem.flywheelLineageId()
                            )
            ) {
                throw new IllegalArgumentException(
                        "Step 67 source lineage changed after mandate capture."
                );
            }

            if (
                    mathService
                            .money(
                                    source.proposedCapacityAmount()
                            )
                            .compareTo(
                                    mathService.money(
                                            mandateItem.strategyProposedCapacityAmount()
                                    )
                            ) != 0
            ) {
                throw new IllegalArgumentException(
                        "Step 67 proposed lineage capacity changed after mandate capture."
                );
            }

            if (
                    mathService
                            .percent(
                                    source.priorityScore()
                            )
                            .compareTo(
                                    mathService.percent(
                                            mandateItem.strategyPriorityScore()
                                    )
                            ) != 0
            ) {
                throw new IllegalArgumentException(
                        "Step 67 priority score changed after mandate capture."
                );
            }

            if (
                    source.advisoryRecommendation()
                            != mandateItem.strategyAdvisoryRecommendation()
            ) {
                throw new IllegalArgumentException(
                        "Step 67 advisory recommendation changed after mandate capture."
                );
            }

            if (
                    mathService
                            .money(
                                    mandateItem.requestedAllocationAmount()
                            )
                            .compareTo(
                                    mathService.money(
                                            source.proposedCapacityAmount()
                                    )
                            ) > 0
            ) {
                throw new IllegalArgumentException(
                        "Mandate allocation exceeds the current Step 67 proposed lineage capacity."
                );
            }
        }
    }

    private FlywheelAllocationStrategyResponse strategyResponse(
            FlywheelStrategyPortfolioResponse portfolio
    ) {
        return new FlywheelAllocationStrategyResponse(
                portfolio.id(),
                portfolio.portfolioNumber(),
                portfolio.title(),

                portfolio.currency(),
                portfolio.fiscalYear(),

                mathService.money(
                        portfolio.capitalCapacityAmount()
                ),

                mathService.money(
                        portfolio.prioritizedCapacityAmount()
                ),

                mathService.money(
                        portfolio.remainingCapacityAmount()
                ),

                mathService.percent(
                        portfolio.capacityUtilizationPct()
                ),

                mathService.percent(
                        portfolio.averagePriorityScore()
                ),

                portfolio.prioritizeCount(),

                portfolio.portfolioOwnerName(),
                portfolio.strategicObjective(),

                portfolio.status()
        );
    }

    private FlywheelAllocationCandidateItemResponse candidateItem(
            FlywheelStrategyItemResponse item
    ) {
        return new FlywheelAllocationCandidateItemResponse(
                item.id(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                mathService.money(
                        item.proposedCapacityAmount()
                ),

                mathService.percent(
                        item.priorityScore()
                ),

                item.advisoryRecommendation()
        );
    }

    private FlywheelAllocationMandateResponse mandateResponse(
            FlywheelAllocationRepository.MandateRow row
    ) {
        List<FlywheelAllocationRepository.ItemRow> items =
                repository.items(
                        row.id()
                );

        FlywheelAllocationMetricResult metric =
                allocationMetric(
                        row,
                        items
                );

        return new FlywheelAllocationMandateResponse(
                row.id(),
                row.mandateNumber(),

                row.strategyPortfolioId(),
                row.strategyPortfolioNumber(),

                row.title(),

                row.currency(),
                row.fiscalYear(),

                mathService.money(
                        row.strategyCapitalCapacityAmount()
                ),

                mathService.money(
                        row.strategyPrioritizedCapacityAmount()
                ),

                metric.requestedAllocationAmount(),
                metric.remainingStrategyCapacityAmount(),
                metric.allocationUtilizationPct(),

                items.size(),

                row.mandateOwnerUserId(),
                row.mandateOwnerName(),

                row.mandateRationale(),

                row.status(),

                row.submittedByName(),
                row.submittedAt(),

                row.authorizationNote(),
                row.authorizedByName(),
                row.authorizedAt(),

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),

                row.createdAt(),
                row.updatedAt(),

                row.version()
        );
    }

    private FlywheelAllocationMetricResult allocationMetric(
            FlywheelAllocationRepository.MandateRow mandate,
            List<FlywheelAllocationRepository.ItemRow> items
    ) {
        return mathService.calculate(
                mandate.strategyPrioritizedCapacityAmount(),

                items.stream()
                        .map(
                                FlywheelAllocationRepository.ItemRow::
                                        requestedAllocationAmount
                        )
                        .toList()
        );
    }

    private FlywheelAllocationItemResponse itemResponse(
            FlywheelAllocationRepository.ItemRow row
    ) {
        return new FlywheelAllocationItemResponse(
                row.id(),
                row.mandateId(),

                row.strategyItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                mathService.money(
                        row.strategyProposedCapacityAmount()
                ),

                mathService.percent(
                        row.strategyPriorityScore()
                ),

                row.strategyAdvisoryRecommendation(),

                mathService.money(
                        row.requestedAllocationAmount()
                ),

                row.addedByName(),
                row.addedAt()
        );
    }

    private FlywheelAllocationSummaryResponse summary(
            int eligibleStrategyCount,
            List<FlywheelAllocationMandateResponse> mandates
    ) {
        return new FlywheelAllocationSummaryResponse(
                eligibleStrategyCount,
                mandates.size(),
                countStatus(mandates, FlywheelAllocationMandateStatus.DRAFT),
                countStatus(mandates, FlywheelAllocationMandateStatus.IN_REVIEW),
                countStatus(mandates, FlywheelAllocationMandateStatus.AUTHORIZED),
                countStatus(mandates, FlywheelAllocationMandateStatus.CLOSED),
                com.procureiq.common.money.CurrencyTotals.sum(
                        mandates.stream()
                                .filter(
                                        mandate -> mandate.status()
                                                == FlywheelAllocationMandateStatus.AUTHORIZED
                                )
                                .toList(),
                        FlywheelAllocationMandateResponse::currency,
                        FlywheelAllocationMandateResponse::requestedAllocationAmount
                )
        );
    }

    private int countStatus(
            List<FlywheelAllocationMandateResponse> mandates,
            FlywheelAllocationMandateStatus status
    ) {
        return (int)
                mandates.stream()
                        .filter(
                                mandate ->
                                        mandate.status()
                                                == status
                        )
                        .count();
    }

    private FlywheelAllocationSnapshotSummaryResponse snapshotSummary(
            FlywheelAllocationRepository.SnapshotRow row
    ) {
        return new FlywheelAllocationSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.mandateId(),
                row.mandateNumber(),

                row.strategyPortfolioId(),
                row.strategyPortfolioNumber(),

                row.mandateStatus(),

                row.currency(),
                row.fiscalYear(),

                mathService.money(
                        row.strategyPrioritizedCapacityAmount()
                ),

                mathService.money(
                        row.requestedAllocationAmount()
                ),

                mathService.money(
                        row.remainingStrategyCapacityAmount()
                ),

                mathService.percent(
                        row.allocationUtilizationPct()
                ),

                row.itemCount(),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private FlywheelAllocationSnapshotItemResponse snapshotItemResponse(
            FlywheelAllocationRepository.SnapshotItemRow row
    ) {
        return new FlywheelAllocationSnapshotItemResponse(
                row.strategyItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                mathService.money(
                        row.strategyProposedCapacityAmount()
                ),

                mathService.percent(
                        row.strategyPriorityScore()
                ),

                mathService.money(
                        row.requestedAllocationAmount()
                )
        );
    }

    private FlywheelAllocationRepository.MandateRow requireMandate(
            UUID mandateId
    ) {
        FlywheelAllocationRepository.MandateRow mandate =
                repository.findMandate(
                        mandateId
                );

        if (mandate == null) {
            throw new ResourceNotFoundException(
                    "Flywheel allocation mandate not found: "
                            + mandateId
            );
        }

        return mandate;
    }

    private AppUserEntity requireMandateOwner(
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
                    "Requester accounts cannot own flywheel allocation mandates."
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

    private String nextMandateNumber() {
        return String.format(
                "FWALLOC-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                repository.nextMandateSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "FWALLOCSNAP-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                repository.nextSnapshotSequence()
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
                    "Your ProcureIQ role cannot access flywheel allocation governance."
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
                    "Your ProcureIQ role cannot manage flywheel allocation mandates."
            );
        }
    }

    private void assertAuthorizeRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can authorize flywheel allocation mandates."
            );
        }
    }
}
