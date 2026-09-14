package com.procureiq.sustainability;

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
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class SustainabilityService {

    private final SustainabilityRepository repository;

    private final SustainabilityScoreService scoreService;

    private final AppUserRepository appUserRepository;

    public SustainabilityService(
            SustainabilityRepository repository,
            SustainabilityScoreService scoreService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.scoreService =
                scoreService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<SustainabilityPortfolioResponse> portfolio(
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

        return repository
                .portfolio(
                        normalizedCurrency
                )
                .stream()
                .map(
                        row ->
                                portfolioResponse(
                                        row,
                                        normalizedCurrency
                                )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public SustainabilityAssessmentResponse assessment(
            UUID currentUserId,
            UUID assessmentId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return assessmentResponse(
                requireAssessment(
                        assessmentId
                )
        );
    }

    public SustainabilityAssessmentResponse createAssessment(
            UUID currentUserId,
            SustainabilityAssessmentInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        SustainabilityRepository.SupplierRow supplier =
                repository
                        .findSupplier(
                                input.supplierId()
                        );

        if (supplier == null) {
            throw new ResourceNotFoundException(
                    "Supplier not found: "
                            + input.supplierId()
            );
        }

        if (
                !"ACTIVE".equals(
                        supplier.status()
                )
        ) {
            throw new IllegalArgumentException(
                    "Sustainability assessments require an active supplier."
            );
        }

        if (
                repository
                        .hasOpenAssessment(
                                input.supplierId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Supplier already has an open sustainability assessment."
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

        BigDecimal overallScore =
                scoreService.overallScore(
                        input.environmentalScore(),
                        input.socialScore(),
                        input.governanceScore()
                );

        SustainabilityRating rating =
                scoreService.rating(
                        overallScore
                );

        UUID assessmentId =
                UUID.randomUUID();

        repository.createAssessment(
                assessmentId,
                nextAssessmentNumber(),
                input,
                ownerId,
                overallScore,
                rating
        );

        seedDeclarations(
                assessmentId
        );

        return assessmentResponse(
                requireAssessment(
                        assessmentId
                )
        );
    }

    public SustainabilityAssessmentResponse uploadDeclaration(
            UUID currentUserId,
            UUID assessmentId,
            SustainabilityDeclarationType declarationType,
            SustainabilityDeclarationInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireEditableAssessment(
                assessmentId
        );

        SustainabilityRepository.DeclarationRow declaration =
                repository
                        .findDeclarationByType(
                                assessmentId,
                                declarationType
                        );

        if (declaration == null) {
            throw new ResourceNotFoundException(
                    "Sustainability declaration not found: "
                            + declarationType
            );
        }

        repository.uploadDeclaration(
                assessmentId,
                declarationType,
                input
        );

        return assessmentResponse(
                requireAssessment(
                        assessmentId
                )
        );
    }

    public SustainabilityDeclarationResponse verifyDeclaration(
            UUID currentUserId,
            UUID declarationId,
            SustainabilityDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SustainabilityRepository.DeclarationRow declaration =
                requireDeclaration(
                        declarationId
                );

        requireEditableAssessment(
                declaration.assessmentId()
        );

        if (
                declaration.documentReference()
                        == null
                ||
                declaration.documentReference()
                        .isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Declaration evidence must be supplied before verification."
            );
        }

        if (
                declaration.expiryDate()
                        != null
                &&
                declaration.expiryDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Expired sustainability declaration cannot be verified."
            );
        }

        repository.reviewDeclaration(
                declarationId,
                SustainabilityDeclarationStatus.VERIFIED,
                currentUserId,
                input.note()
        );

        return declarationResponse(
                requireDeclaration(
                        declarationId
                )
        );
    }

    public SustainabilityDeclarationResponse rejectDeclaration(
            UUID currentUserId,
            UUID declarationId,
            SustainabilityDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SustainabilityRepository.DeclarationRow declaration =
                requireDeclaration(
                        declarationId
                );

        requireEditableAssessment(
                declaration.assessmentId()
        );

        repository.reviewDeclaration(
                declarationId,
                SustainabilityDeclarationStatus.REJECTED,
                currentUserId,
                input.note()
        );

        return declarationResponse(
                requireDeclaration(
                        declarationId
                )
        );
    }

    public SustainabilityAssessmentResponse submitAssessment(
            UUID currentUserId,
            UUID assessmentId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SustainabilityRepository.AssessmentRow assessment =
                requireAssessment(
                        assessmentId
                );

        if (
                assessment.status()
                        != SustainabilityAssessmentStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft sustainability assessments can be submitted."
            );
        }

        List<SustainabilityRepository.DeclarationRow> declarations =
                repository
                        .findDeclarations(
                                assessmentId
                        );

        long readyMandatory =
                declarations.stream()
                        .filter(
                                SustainabilityRepository.DeclarationRow::
                                        mandatory
                        )
                        .filter(
                                declaration ->
                                        declaration.status()
                                                == SustainabilityDeclarationStatus.DECLARED
                                        ||
                                        declaration.status()
                                                == SustainabilityDeclarationStatus.VERIFIED
                        )
                        .count();

        long mandatory =
                declarations.stream()
                        .filter(
                                SustainabilityRepository.DeclarationRow::
                                        mandatory
                        )
                        .count();

        if (
                readyMandatory
                        <
                        mandatory
        ) {
            throw new IllegalArgumentException(
                    "All mandatory responsible-sourcing declarations must be supplied before submission."
            );
        }

        repository.submitAssessment(
                assessmentId
        );

        return assessmentResponse(
                requireAssessment(
                        assessmentId
                )
        );
    }

    public SustainabilityAssessmentResponse approveAssessment(
            UUID currentUserId,
            UUID assessmentId,
            SustainabilityDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SustainabilityRepository.AssessmentRow assessment =
                requireAssessment(
                        assessmentId
                );

        if (
                assessment.status()
                        != SustainabilityAssessmentStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted sustainability assessments can be approved."
            );
        }

        List<SustainabilityDeclarationResponse> declarations =
                repository
                        .findDeclarations(
                                assessmentId
                        )
                        .stream()
                        .map(
                                this::declarationResponse
                        )
                        .toList();

        long mandatory =
                declarations.stream()
                        .filter(
                                SustainabilityDeclarationResponse::
                                        mandatory
                        )
                        .count();

        long verified =
                declarations.stream()
                        .filter(
                                SustainabilityDeclarationResponse::
                                        mandatory
                        )
                        .filter(
                                declaration ->
                                        declaration.status()
                                                == SustainabilityDeclarationStatus.VERIFIED
                        )
                        .count();

        if (verified < mandatory) {
            throw new IllegalArgumentException(
                    "All mandatory declarations must be verified before sustainability approval."
            );
        }

        LocalDate nextReviewDate =
                assessment.assessmentDate()
                        .plusDays(
                                scoreService
                                        .reviewIntervalDays(
                                                assessment.rating()
                                        )
                        );

        repository.approveAssessment(
                assessmentId,
                currentUserId,
                input.note(),
                nextReviewDate
        );

        return assessmentResponse(
                requireAssessment(
                        assessmentId
                )
        );
    }

    public SustainabilityAssessmentResponse rejectAssessment(
            UUID currentUserId,
            UUID assessmentId,
            SustainabilityDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SustainabilityRepository.AssessmentRow assessment =
                requireAssessment(
                        assessmentId
                );

        if (
                assessment.status()
                        != SustainabilityAssessmentStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted sustainability assessments can be rejected."
            );
        }

        repository.rejectAssessment(
                assessmentId,
                currentUserId,
                input.note()
        );

        return assessmentResponse(
                requireAssessment(
                        assessmentId
                )
        );
    }

    public SustainabilityActionResponse createAction(
            UUID currentUserId,
            UUID assessmentId,
            SustainabilityActionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        SustainabilityRepository.AssessmentRow assessment =
                requireAssessment(
                        assessmentId
                );

        if (
                assessment.status()
                        == SustainabilityAssessmentStatus.REJECTED
        ) {
            throw new IllegalArgumentException(
                    "Improvement actions cannot be added to a rejected assessment."
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

        UUID actionId =
                UUID.randomUUID();

        repository.createAction(
                actionId,
                assessmentId,
                input,
                ownerId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public SustainabilityActionResponse startAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SustainabilityRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        != SustainabilityActionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open sustainability actions can be started."
            );
        }

        repository.startAction(
                actionId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public SustainabilityActionResponse completeAction(
            UUID currentUserId,
            UUID actionId,
            SustainabilityActionCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SustainabilityRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        != SustainabilityActionStatus.OPEN
                &&
                action.status()
                        != SustainabilityActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active sustainability actions can be completed."
            );
        }

        repository.completeAction(
                actionId,
                input.note()
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public SustainabilityActionResponse cancelAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SustainabilityRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        == SustainabilityActionStatus.COMPLETED
        ) {
            throw new IllegalArgumentException(
                    "Completed sustainability actions cannot be cancelled."
            );
        }

        repository.cancelAction(
                actionId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    @Transactional(readOnly = true)
    public SustainabilitySummaryResponse summary(
            UUID currentUserId,
            String currency
    ) {
        List<SustainabilityPortfolioResponse> portfolio =
                portfolio(
                        currentUserId,
                        currency
                );

        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        long assessedSuppliers =
                portfolio.stream()
                        .filter(
                                item ->
                                        item.assessmentId()
                                                != null
                                        &&
                                        item.assessmentStatus()
                                                == SustainabilityAssessmentStatus.APPROVED
                        )
                        .count();

        long highRiskSuppliers =
                portfolio.stream()
                        .filter(
                                item ->
                                        item.rating()
                                                == SustainabilityRating.HIGH_RISK
                                        ||
                                        item.rating()
                                                == SustainabilityRating.CRITICAL
                        )
                        .count();

        long eligible =
                portfolio.stream()
                        .filter(
                                SustainabilityPortfolioResponse::
                                        responsibleSourcingEligible
                        )
                        .count();

        BigDecimal totalSpend =
                sumSpend(
                        portfolio
                );

        BigDecimal assessedSpend =
                portfolio.stream()
                        .filter(
                                item ->
                                        item.assessmentStatus()
                                                == SustainabilityAssessmentStatus.APPROVED
                        )
                        .map(
                                SustainabilityPortfolioResponse::
                                        spend
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal riskSpend =
                portfolio.stream()
                        .filter(
                                item ->
                                        item.rating()
                                                == SustainabilityRating.HIGH_RISK
                                        ||
                                        item.rating()
                                                == SustainabilityRating.CRITICAL
                        )
                        .map(
                                SustainabilityPortfolioResponse::
                                        spend
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal unassessedSpend =
                totalSpend
                        .subtract(
                                assessedSpend
                        )
                        .max(
                                BigDecimal.ZERO
                        );

        long dueSoon =
                portfolio.stream()
                        .filter(
                                item ->
                                        item.assessmentStatus()
                                                == SustainabilityAssessmentStatus.APPROVED
                                )
                        .filter(
                                item ->
                                        item.nextReviewDate()
                                                != null
                                )
                        .filter(
                                item ->
                                        !item.nextReviewDate()
                                                .isBefore(
                                                        today
                                                )
                                        &&
                                        !item.nextReviewDate()
                                                .isAfter(
                                                        today.plusDays(
                                                                30
                                                        )
                                                )
                        )
                        .count();

        long expired =
                portfolio.stream()
                        .filter(
                                item ->
                                        item.assessmentStatus()
                                                == SustainabilityAssessmentStatus.EXPIRED
                        )
                        .count();

        long openActions =
                portfolio.stream()
                        .mapToLong(
                                SustainabilityPortfolioResponse::
                                        openActions
                        )
                        .sum();

        long overdueActions =
                portfolio.stream()
                        .mapToLong(
                                SustainabilityPortfolioResponse::
                                        overdueActions
                        )
                        .sum();

        return new SustainabilitySummaryResponse(
                normalizeCurrency(
                        currency
                ),
                portfolio.size(),
                assessedSuppliers,
                percentage(
                        BigDecimal.valueOf(
                                assessedSuppliers
                        ),
                        BigDecimal.valueOf(
                                portfolio.size()
                        )
                ),
                highRiskSuppliers,
                eligible,
                money(
                        totalSpend
                ),
                money(
                        assessedSpend
                ),
                percentage(
                        assessedSpend,
                        totalSpend
                ),
                money(
                        riskSpend
                ),
                money(
                        unassessedSpend
                ),
                dueSoon,
                expired,
                openActions,
                overdueActions
        );
    }

    @Transactional(readOnly = true)
    public List<SustainabilityCategoryExposureResponse> categories(
            UUID currentUserId,
            String currency
    ) {
        List<SustainabilityPortfolioResponse> portfolio =
                portfolio(
                        currentUserId,
                        currency
                );

        Map<
                String,
                List<SustainabilityPortfolioResponse>
        > grouped =
                portfolio.stream()
                        .collect(
                                Collectors.groupingBy(
                                        item ->
                                                item.category()
                                                        == null
                                                        ||
                                                        item.category()
                                                                .isBlank()
                                                        ? "Uncategorized"
                                                        : item.category()
                                )
                        );

        return grouped
                .entrySet()
                .stream()
                .map(
                        entry -> {
                            List<SustainabilityPortfolioResponse> values =
                                    entry.getValue();

                            long assessed =
                                    values.stream()
                                            .filter(
                                                    item ->
                                                            item.assessmentStatus()
                                                                    == SustainabilityAssessmentStatus.APPROVED
                                            )
                                            .count();

                            long highRisk =
                                    values.stream()
                                            .filter(
                                                    item ->
                                                            item.rating()
                                                                    == SustainabilityRating.HIGH_RISK
                                                            ||
                                                            item.rating()
                                                                    == SustainabilityRating.CRITICAL
                                            )
                                            .count();

                            BigDecimal total =
                                    sumSpend(
                                            values
                                    );

                            BigDecimal assessedSpend =
                                    values.stream()
                                            .filter(
                                                    item ->
                                                            item.assessmentStatus()
                                                                    == SustainabilityAssessmentStatus.APPROVED
                                            )
                                            .map(
                                                    SustainabilityPortfolioResponse::
                                                            spend
                                            )
                                            .reduce(
                                                    BigDecimal.ZERO,
                                                    BigDecimal::add
                                            );

                            BigDecimal riskSpend =
                                    values.stream()
                                            .filter(
                                                    item ->
                                                            item.rating()
                                                                    == SustainabilityRating.HIGH_RISK
                                                            ||
                                                            item.rating()
                                                                    == SustainabilityRating.CRITICAL
                                            )
                                            .map(
                                                    SustainabilityPortfolioResponse::
                                                            spend
                                            )
                                            .reduce(
                                                    BigDecimal.ZERO,
                                                    BigDecimal::add
                                            );

                            return new SustainabilityCategoryExposureResponse(
                                    entry.getKey(),
                                    values.size(),
                                    assessed,
                                    highRisk,
                                    money(
                                            total
                                    ),
                                    money(
                                            assessedSpend
                                    ),
                                    money(
                                            riskSpend
                                    ),
                                    percentage(
                                            assessedSpend,
                                            total
                                    )
                            );
                        }
                )
                .sorted(
                        Comparator.comparing(
                                SustainabilityCategoryExposureResponse::
                                        riskSpend
                        )
                                .reversed()
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public SustainabilityContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new SustainabilityContextResponse(
                repository.suppliers(),
                repository.users()
        );
    }

    private SustainabilityPortfolioResponse portfolioResponse(
            SustainabilityRepository.PortfolioRow row,
            String currency
    ) {
        SustainabilityAssessmentStatus effectiveStatus =
                effectiveStatus(
                        row.assessmentStatus(),
                        row.nextReviewDate()
                );

        boolean eligible =
                effectiveStatus
                                == SustainabilityAssessmentStatus.APPROVED
                        &&
                        row.rating()
                                != null
                        &&
                        scoreService
                                .ratingEligibleForResponsibleSourcing(
                                        row.rating()
                                )
                        &&
                        row.mandatoryDeclarations()
                                ==
                                row.verifiedMandatoryDeclarations()
                        &&
                        row.onboardingClearance();

        return new SustainabilityPortfolioResponse(
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.category(),
                row.country(),
                row.supplierRiskLevel(),
                currency,
                money(
                        row.spend()
                ),
                row.assessmentId(),
                row.assessmentNumber(),
                effectiveStatus,
                row.rating(),
                scoreNullable(
                        row.environmentalScore()
                ),
                scoreNullable(
                        row.socialScore()
                ),
                scoreNullable(
                        row.governanceScore()
                ),
                scoreNullable(
                        row.overallScore()
                ),
                row.nextReviewDate(),
                row.onboardingClearance(),
                eligible,
                row.openActions(),
                row.overdueActions()
        );
    }

    private SustainabilityAssessmentResponse assessmentResponse(
            SustainabilityRepository.AssessmentRow row
    ) {
        SustainabilityAssessmentStatus effectiveStatus =
                effectiveStatus(
                        row.status(),
                        row.nextReviewDate()
                );

        List<SustainabilityDeclarationResponse> declarations =
                repository
                        .findDeclarations(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::declarationResponse
                        )
                        .toList();

        long mandatory =
                declarations.stream()
                        .filter(
                                SustainabilityDeclarationResponse::
                                        mandatory
                        )
                        .count();

        long verified =
                declarations.stream()
                        .filter(
                                SustainabilityDeclarationResponse::
                                        mandatory
                        )
                        .filter(
                                declaration ->
                                        declaration.status()
                                                == SustainabilityDeclarationStatus.VERIFIED
                        )
                        .count();

        boolean eligible =
                effectiveStatus
                                == SustainabilityAssessmentStatus.APPROVED
                        &&
                        scoreService
                                .ratingEligibleForResponsibleSourcing(
                                        row.rating()
                                )
                        &&
                        mandatory
                                ==
                                verified
                        &&
                        row.onboardingClearance();

        return new SustainabilityAssessmentResponse(
                row.id(),
                row.assessmentNumber(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.supplierCategory(),
                row.supplierCountry(),
                row.supplierRiskLevel(),
                effectiveStatus,
                score(
                        row.environmentalScore()
                ),
                score(
                        row.socialScore()
                ),
                score(
                        row.governanceScore()
                ),
                score(
                        row.overallScore()
                ),
                row.rating(),
                row.assessmentDate(),
                row.nextReviewDate(),
                row.ownerUserId(),
                row.ownerName(),
                row.reviewedByName(),
                row.reviewNote(),
                row.reviewedAt(),
                row.notes(),
                Math.toIntExact(
                        mandatory
                ),
                Math.toIntExact(
                        verified
                ),
                row.onboardingClearance(),
                eligible,
                row.openActions(),
                row.overdueActions(),
                declarations,
                repository
                        .findActions(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::actionResponse
                        )
                        .toList(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private SustainabilityDeclarationResponse declarationResponse(
            SustainabilityRepository.DeclarationRow row
    ) {
        SustainabilityDeclarationStatus effectiveStatus =
                row.status();

        if (
                row.expiryDate()
                        != null
                &&
                row.expiryDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
                &&
                row.status()
                        == SustainabilityDeclarationStatus.VERIFIED
        ) {
            effectiveStatus =
                    SustainabilityDeclarationStatus.EXPIRED;
        }

        return new SustainabilityDeclarationResponse(
                row.id(),
                row.declarationType(),
                row.mandatory(),
                row.documentReference(),
                row.expiryDate(),
                effectiveStatus,
                row.reviewedByName(),
                row.reviewNote(),
                row.reviewedAt()
        );
    }

    private SustainabilityActionResponse actionResponse(
            SustainabilityRepository.ActionRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == SustainabilityActionStatus.OPEN
                        ||
                        row.status()
                                == SustainabilityActionStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new SustainabilityActionResponse(
                row.id(),
                row.assessmentId(),
                row.actionType(),
                row.title(),
                row.description(),
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

    private SustainabilityAssessmentStatus effectiveStatus(
            SustainabilityAssessmentStatus status,
            LocalDate nextReviewDate
    ) {
        if (
                status
                        == SustainabilityAssessmentStatus.APPROVED
                &&
                nextReviewDate
                        != null
                &&
                nextReviewDate
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            return SustainabilityAssessmentStatus.EXPIRED;
        }

        return status;
    }

    private void seedDeclarations(
            UUID assessmentId
    ) {
        repository.seedDeclaration(
                assessmentId,
                SustainabilityDeclarationType.HUMAN_RIGHTS,
                true
        );

        repository.seedDeclaration(
                assessmentId,
                SustainabilityDeclarationType.MODERN_SLAVERY,
                true
        );

        repository.seedDeclaration(
                assessmentId,
                SustainabilityDeclarationType.ANTI_BRIBERY,
                true
        );

        repository.seedDeclaration(
                assessmentId,
                SustainabilityDeclarationType.ENVIRONMENTAL_POLICY,
                true
        );

        repository.seedDeclaration(
                assessmentId,
                SustainabilityDeclarationType.RESPONSIBLE_SOURCING,
                true
        );

        repository.seedDeclaration(
                assessmentId,
                SustainabilityDeclarationType.DIVERSITY_INCLUSION,
                false
        );
    }

    private SustainabilityRepository.AssessmentRow requireAssessment(
            UUID assessmentId
    ) {
        SustainabilityRepository.AssessmentRow assessment =
                repository
                        .findAssessment(
                                assessmentId
                        );

        if (assessment == null) {
            throw new ResourceNotFoundException(
                    "Supplier sustainability assessment not found: "
                            + assessmentId
            );
        }

        return assessment;
    }

    private SustainabilityRepository.AssessmentRow requireEditableAssessment(
            UUID assessmentId
    ) {
        SustainabilityRepository.AssessmentRow assessment =
                requireAssessment(
                        assessmentId
                );

        if (
                assessment.status()
                        != SustainabilityAssessmentStatus.DRAFT
                &&
                assessment.status()
                        != SustainabilityAssessmentStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "This sustainability assessment can no longer be edited."
            );
        }

        return assessment;
    }

    private SustainabilityRepository.DeclarationRow requireDeclaration(
            UUID declarationId
    ) {
        SustainabilityRepository.DeclarationRow declaration =
                repository
                        .findDeclaration(
                                declarationId
                        );

        if (declaration == null) {
            throw new ResourceNotFoundException(
                    "Sustainability declaration not found: "
                            + declarationId
            );
        }

        return declaration;
    }

    private SustainabilityRepository.ActionRow requireAction(
            UUID actionId
    ) {
        SustainabilityRepository.ActionRow action =
                repository
                        .findAction(
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Sustainability improvement action not found: "
                            + actionId
            );
        }

        return action;
    }

    private String nextAssessmentNumber() {
        Long sequence =
                repository
                        .nextAssessmentSequence();

        return String.format(
                "ESG-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private BigDecimal sumSpend(
            List<SustainabilityPortfolioResponse> portfolio
    ) {
        return portfolio.stream()
                .map(
                        SustainabilityPortfolioResponse::
                                spend
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                );
    }

    private BigDecimal percentage(
            BigDecimal numerator,
            BigDecimal denominator
    ) {
        if (
                denominator == null
                ||
                denominator.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return numerator
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        denominator,
                        2,
                        RoundingMode.HALF_UP
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

    private BigDecimal score(
            BigDecimal value
    ) {
        return value
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal scoreNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : score(
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
                    "Sustainability currency must contain exactly three characters."
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
                    "Sustainability governance ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access sustainability intelligence."
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
                    "Your ProcureIQ role cannot manage sustainability assessments."
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
                    "Only administrators and procurement managers can approve sustainability assessments."
            );
        }
    }
}
