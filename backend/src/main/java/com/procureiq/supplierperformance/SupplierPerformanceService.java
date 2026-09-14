package com.procureiq.supplierperformance;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SupplierPerformanceService {

    private final SupplierPerformanceRepository repository;

    private final SupplierPerformanceScoringService scoringService;

    private final AppUserRepository appUserRepository;

    public SupplierPerformanceService(
            SupplierPerformanceRepository repository,
            SupplierPerformanceScoringService scoringService,
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
    public List<SupplierPerformanceReviewResponse> reviews(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return repository
                .findReviews()
                .stream()
                .map(
                        this::reviewResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierPerformanceReviewDetailResponse detail(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SupplierPerformanceRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        return new SupplierPerformanceReviewDetailResponse(
                reviewResponse(
                        review
                ),
                repository
                        .findCorrectiveActions(
                                reviewId
                        )
                        .stream()
                        .map(
                                this::correctiveActionResponse
                        )
                        .toList(),
                historyRows(
                        review.supplierId()
                )
        );
    }

    public SupplierPerformanceReviewResponse create(
            UUID currentUserId,
            SupplierPerformanceReviewInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        if (
                input.periodEnd()
                        .isBefore(
                                input.periodStart()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Supplier review period end cannot be before period start."
            );
        }

        SupplierPerformanceRepository.SupplierSnapshotRow snapshot =
                repository
                        .supplierSnapshot(
                                input.supplierId(),
                                input.periodStart(),
                                input.periodEnd()
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Supplier not found: "
                            + input.supplierId()
            );
        }

        BigDecimal weightedScore =
                scoringService
                        .weightedScore(
                                input.qualityScore(),
                                input.deliveryScore(),
                                input.commercialScore(),
                                input.serviceScore(),
                                input.complianceScore()
                        );

        SupplierPerformanceBand band =
                scoringService
                        .band(
                                weightedScore
                        );

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireAssignableUser(
                                input.ownerUserId()
                        ).getId();

        UUID reviewId =
                UUID.randomUUID();

        try {
            repository.createReview(
                    reviewId,
                    nextReviewNumber(),
                    input,
                    ownerId,
                    weightedScore,
                    band,
                    snapshot
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "A supplier performance review already exists for this supplier and review period."
            );
        }

        return reviewResponse(
                requireReview(
                        reviewId
                )
        );
    }

    public SupplierPerformanceReviewResponse submit(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SupplierPerformanceRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != SupplierPerformanceReviewStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft supplier performance reviews can be submitted."
            );
        }

        repository.submitReview(
                reviewId
        );

        return reviewResponse(
                requireReview(
                        reviewId
                )
        );
    }

    public SupplierPerformanceReviewResponse approve(
            UUID currentUserId,
            UUID reviewId,
            PerformanceDecisionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertApprovalRole(
                currentUser.getRole()
        );

        SupplierPerformanceRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != SupplierPerformanceReviewStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted supplier performance reviews can be approved."
            );
        }

        repository.decideReview(
                reviewId,
                SupplierPerformanceReviewStatus.APPROVED,
                currentUserId,
                input.note()
        );

        return reviewResponse(
                requireReview(
                        reviewId
                )
        );
    }

    public SupplierPerformanceReviewResponse reject(
            UUID currentUserId,
            UUID reviewId,
            PerformanceDecisionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertApprovalRole(
                currentUser.getRole()
        );

        SupplierPerformanceRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != SupplierPerformanceReviewStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted supplier performance reviews can be rejected."
            );
        }

        repository.decideReview(
                reviewId,
                SupplierPerformanceReviewStatus.REJECTED,
                currentUserId,
                input.note()
        );

        return reviewResponse(
                requireReview(
                        reviewId
                )
        );
    }

    public CorrectiveActionResponse addCorrectiveAction(
            UUID currentUserId,
            UUID reviewId,
            CorrectiveActionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        SupplierPerformanceRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != SupplierPerformanceReviewStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Corrective actions can only be created for approved supplier performance reviews."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireAssignableUser(
                                input.ownerUserId()
                        ).getId();

        UUID actionId =
                UUID.randomUUID();

        repository.createCorrectiveAction(
                actionId,
                reviewId,
                input,
                ownerId
        );

        return correctiveActionResponse(
                requireCorrectiveAction(
                        actionId
                )
        );
    }

    public CorrectiveActionResponse startCorrectiveAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SupplierPerformanceRepository.CorrectiveActionRow action =
                requireCorrectiveAction(
                        actionId
                );

        if (
                action.status()
                        != CorrectiveActionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open corrective actions can be started."
            );
        }

        repository.startCorrectiveAction(
                actionId
        );

        return correctiveActionResponse(
                requireCorrectiveAction(
                        actionId
                )
        );
    }

    public CorrectiveActionResponse completeCorrectiveAction(
            UUID currentUserId,
            UUID actionId,
            CorrectiveActionCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SupplierPerformanceRepository.CorrectiveActionRow action =
                requireCorrectiveAction(
                        actionId
                );

        if (
                action.status()
                        != CorrectiveActionStatus.OPEN
                &&
                action.status()
                        != CorrectiveActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only open or in-progress corrective actions can be completed."
            );
        }

        repository.completeCorrectiveAction(
                actionId,
                input.note()
        );

        return correctiveActionResponse(
                requireCorrectiveAction(
                        actionId
                )
        );
    }

    public CorrectiveActionResponse cancelCorrectiveAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SupplierPerformanceRepository.CorrectiveActionRow action =
                requireCorrectiveAction(
                        actionId
                );

        if (
                action.status()
                        == CorrectiveActionStatus.COMPLETED
        ) {
            throw new IllegalArgumentException(
                    "Completed corrective actions cannot be cancelled."
            );
        }

        repository.cancelCorrectiveAction(
                actionId
        );

        return correctiveActionResponse(
                requireCorrectiveAction(
                        actionId
                )
        );
    }

    @Transactional(readOnly = true)
    public SupplierPerformanceSummaryResponse summary(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<SupplierPerformanceRepository.ReviewRow> reviews =
                repository
                        .findReviews();

        List<SupplierPerformanceRepository.CorrectiveActionRow> actions =
                repository
                        .findOpenCorrectiveActions();

        long reviewedSuppliers =
                reviews.stream()
                        .map(
                                SupplierPerformanceRepository.ReviewRow::
                                        supplierId
                        )
                        .distinct()
                        .count();

        long pendingApproval =
                reviews.stream()
                        .filter(
                                review ->
                                        review.status()
                                                == SupplierPerformanceReviewStatus.SUBMITTED
                        )
                        .count();

        long needsImprovement =
                reviews.stream()
                        .filter(
                                review ->
                                        review.status()
                                                == SupplierPerformanceReviewStatus.APPROVED
                                        &&
                                        review.performanceBand()
                                                == SupplierPerformanceBand.NEEDS_IMPROVEMENT
                        )
                        .count();

        long criticalReviews =
                reviews.stream()
                        .filter(
                                review ->
                                        review.status()
                                                == SupplierPerformanceReviewStatus.APPROVED
                                        &&
                                        review.performanceBand()
                                                == SupplierPerformanceBand.CRITICAL
                        )
                        .count();

        long overdueActions =
                actions.stream()
                        .filter(
                                action ->
                                        action.dueDate()
                                                .isBefore(
                                                        LocalDate.now(
                                                                ZoneOffset.UTC
                                                        )
                                                )
                        )
                        .count();

        BigDecimal approvedScoreSum =
                reviews.stream()
                        .filter(
                                review ->
                                        review.status()
                                                == SupplierPerformanceReviewStatus.APPROVED
                        )
                        .map(
                                SupplierPerformanceRepository.ReviewRow::
                                        weightedScore
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        long approvedReviews =
                reviews.stream()
                        .filter(
                                review ->
                                        review.status()
                                                == SupplierPerformanceReviewStatus.APPROVED
                        )
                        .count();

        BigDecimal averageApprovedScore =
                approvedReviews == 0
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : approvedScoreSum
                                .divide(
                                        BigDecimal.valueOf(
                                                approvedReviews
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new SupplierPerformanceSummaryResponse(
                reviews.size(),
                reviewedSuppliers,
                pendingApproval,
                needsImprovement,
                criticalReviews,
                actions.size(),
                overdueActions,
                averageApprovedScore
        );
    }

    @Transactional(readOnly = true)
    public List<SupplierPerformanceTrendResponse> supplierHistory(
            UUID currentUserId,
            UUID supplierId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return historyRows(
                supplierId
        );
    }

    @Transactional(readOnly = true)
    public SupplierPerformanceContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return new SupplierPerformanceContextResponse(
                repository.suppliers(),
                repository.users()
        );
    }

    private SupplierPerformanceReviewResponse reviewResponse(
            SupplierPerformanceRepository.ReviewRow row
    ) {
        return new SupplierPerformanceReviewResponse(
                row.id(),
                row.reviewNumber(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.supplierCategory(),
                row.periodStart(),
                row.periodEnd(),
                row.status(),
                money(
                        row.qualityScore()
                ),
                money(
                        row.deliveryScore()
                ),
                money(
                        row.commercialScore()
                ),
                money(
                        row.serviceScore()
                ),
                money(
                        row.complianceScore()
                ),
                money(
                        row.weightedScore()
                ),
                row.performanceBand(),
                row.supplierRatingSnapshot(),
                row.supplierRiskSnapshot(),
                row.purchaseOrderCountSnapshot(),
                money(
                        row.purchaseOrderValueSnapshot()
                ),
                row.overduePurchaseOrderCountSnapshot(),
                row.ownerUserId(),
                row.ownerName(),
                row.decisionNote(),
                row.decidedAt(),
                row.decidedByName(),
                row.notes(),
                row.openCorrectiveActions(),
                row.overdueCorrectiveActions(),
                row.submittedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private CorrectiveActionResponse correctiveActionResponse(
            SupplierPerformanceRepository.CorrectiveActionRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == CorrectiveActionStatus.OPEN
                        ||
                        row.status()
                                == CorrectiveActionStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new CorrectiveActionResponse(
                row.id(),
                row.reviewId(),
                row.title(),
                row.description(),
                row.ownerUserId(),
                row.ownerName(),
                row.dueDate(),
                row.status(),
                overdue,
                row.completedAt(),
                row.completionNote(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private List<SupplierPerformanceTrendResponse> historyRows(
            UUID supplierId
    ) {
        return repository
                .findSupplierReviews(
                        supplierId
                )
                .stream()
                .map(
                        review ->
                                new SupplierPerformanceTrendResponse(
                                        review.id(),
                                        review.reviewNumber(),
                                        review.periodEnd(),
                                        money(
                                                review.weightedScore()
                                        ),
                                        review.performanceBand(),
                                        review.status()
                                )
                )
                .toList();
    }

    private SupplierPerformanceRepository.ReviewRow requireReview(
            UUID reviewId
    ) {
        SupplierPerformanceRepository.ReviewRow review =
                repository
                        .findReview(
                                reviewId
                        );

        if (review == null) {
            throw new ResourceNotFoundException(
                    "Supplier performance review not found: "
                            + reviewId
            );
        }

        return review;
    }

    private SupplierPerformanceRepository.CorrectiveActionRow
    requireCorrectiveAction(
            UUID actionId
    ) {
        SupplierPerformanceRepository.CorrectiveActionRow action =
                repository
                        .findCorrectiveAction(
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Supplier corrective action not found: "
                            + actionId
            );
        }

        return action;
    }

    private String nextReviewNumber() {
        Long sequence =
                repository
                        .nextReviewSequence();

        return String.format(
                "SPR-%d-%05d",
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
        if (value == null) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return value.setScale(
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

    private AppUserEntity requireAssignableUser(
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
                    "Supplier performance ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access supplier performance governance."
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
                    "Your ProcureIQ role cannot manage supplier performance reviews."
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
                    "Only administrators and procurement managers can approve supplier performance reviews."
            );
        }
    }
}
