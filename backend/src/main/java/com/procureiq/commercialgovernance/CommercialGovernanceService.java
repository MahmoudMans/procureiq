package com.procureiq.commercialgovernance;

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
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Transactional
public class CommercialGovernanceService {

    private final CommercialGovernanceRepository repository;

    private final CommercialLeakageCalculationService calculationService;

    private final AppUserRepository appUserRepository;

    public CommercialGovernanceService(
            CommercialGovernanceRepository repository,
            CommercialLeakageCalculationService calculationService,
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
    public List<CommercialGovernanceRecordResponse> governanceRecords(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return repository
                .findGovernanceRecords(
                        normalizeCurrency(
                                currency
                        )
                )
                .stream()
                .map(
                        this::governanceResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public CommercialGovernanceDetailResponse detail(
            UUID currentUserId,
            UUID governanceId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CommercialGovernanceRepository.GovernanceRow governance =
                requireGovernance(
                        governanceId
                );

        return new CommercialGovernanceDetailResponse(
                governanceResponse(
                        governance
                ),
                repository
                        .findObligations(
                                governanceId
                        )
                        .stream()
                        .map(
                                this::obligationResponse
                        )
                        .toList(),
                repository
                        .findLeakageForGovernance(
                                governanceId
                        )
                        .stream()
                        .map(
                                this::leakageResponse
                        )
                        .toList()
        );
    }

    public CommercialGovernanceDetailResponse createGovernance(
            UUID currentUserId,
            CommercialGovernanceInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        CommercialGovernanceRepository.ContractRow contract =
                repository
                        .findContract(
                                input.contractId()
                        );

        if (contract == null) {
            throw new ResourceNotFoundException(
                    "Supplier contract not found: "
                            + input.contractId()
            );
        }

        if (contract.endDate() == null) {
            throw new IllegalArgumentException(
                    "Commercial renewal governance requires a contract end date."
            );
        }

        if (contract.governanceConfigured()) {
            throw new IllegalArgumentException(
                    "Commercial governance is already configured for this contract."
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

        LocalDate noticeDeadline =
                contract
                        .endDate()
                        .minusDays(
                                input.noticePeriodDays()
                        );

        UUID governanceId =
                UUID.randomUUID();

        try {
            repository.createGovernance(
                    governanceId,
                    contract,
                    input,
                    ownerId,
                    normalizeCurrency(
                            input.currency()
                    ),
                    noticeDeadline
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "Commercial governance could not be created for this contract."
            );
        }

        return detail(
                currentUserId,
                governanceId
        );
    }

    public CommercialGovernanceRecordResponse startRenewalReview(
            UUID currentUserId,
            UUID governanceId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CommercialGovernanceRepository.GovernanceRow governance =
                requireGovernance(
                        governanceId
                );

        if (
                governance.renewalStatus()
                        != ContractRenewalStatus.UPCOMING
        ) {
            throw new IllegalArgumentException(
                    "Only upcoming contract renewals can enter review."
            );
        }

        repository.startRenewalReview(
                governanceId
        );

        return governanceResponse(
                requireGovernance(
                        governanceId
                )
        );
    }

    public CommercialGovernanceRecordResponse decideRenewal(
            UUID currentUserId,
            UUID governanceId,
            ContractRenewalDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CommercialGovernanceRepository.GovernanceRow governance =
                requireGovernance(
                        governanceId
                );

        if (
                governance.renewalStatus()
                        != ContractRenewalStatus.UPCOMING
                &&
                governance.renewalStatus()
                        != ContractRenewalStatus.UNDER_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Renewal decisions require an upcoming or under-review contract."
            );
        }

        repository.decideRenewal(
                governanceId,
                input.decision(),
                currentUserId,
                input.note()
        );

        return governanceResponse(
                requireGovernance(
                        governanceId
                )
        );
    }

    public CommercialGovernanceRecordResponse completeRenewal(
            UUID currentUserId,
            UUID governanceId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CommercialGovernanceRepository.GovernanceRow governance =
                requireGovernance(
                        governanceId
                );

        if (
                governance.renewalStatus()
                        != ContractRenewalStatus.RENEW
                &&
                governance.renewalStatus()
                        != ContractRenewalStatus.RENEGOTIATE
                &&
                governance.renewalStatus()
                        != ContractRenewalStatus.TERMINATE
        ) {
            throw new IllegalArgumentException(
                    "A renewal decision must exist before the renewal workflow can be completed."
            );
        }

        repository.completeRenewal(
                governanceId
        );

        return governanceResponse(
                requireGovernance(
                        governanceId
                )
        );
    }

    public CommercialGovernanceRecordResponse deactivateGovernance(
            UUID currentUserId,
            UUID governanceId
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireGovernance(
                governanceId
        );

        repository.deactivateGovernance(
                governanceId
        );

        return governanceResponse(
                requireGovernance(
                        governanceId
                )
        );
    }

    public ContractObligationResponse createObligation(
            UUID currentUserId,
            UUID governanceId,
            ContractObligationInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        CommercialGovernanceRepository.GovernanceRow governance =
                requireGovernance(
                        governanceId
                );

        if (
                governance.governanceStatus()
                        != CommercialGovernanceStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Contract obligations require active commercial governance."
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

        UUID obligationId =
                UUID.randomUUID();

        repository.createObligation(
                obligationId,
                governanceId,
                input,
                ownerId
        );

        return obligationResponse(
                requireObligation(
                        obligationId
                )
        );
    }

    public ContractObligationResponse completeObligation(
            UUID currentUserId,
            UUID obligationId,
            ContractObligationCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CommercialGovernanceRepository.ObligationRow obligation =
                requireObligation(
                        obligationId
                );

        if (
                obligation.status()
                        != ContractObligationStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open contract obligations can be completed."
            );
        }

        repository.completeObligation(
                obligationId,
                input.note()
        );

        return obligationResponse(
                requireObligation(
                        obligationId
                )
        );
    }

    public ContractObligationResponse waiveObligation(
            UUID currentUserId,
            UUID obligationId,
            ContractObligationCompletionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CommercialGovernanceRepository.ObligationRow obligation =
                requireObligation(
                        obligationId
                );

        if (
                obligation.status()
                        != ContractObligationStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open contract obligations can be waived."
            );
        }

        repository.waiveObligation(
                obligationId,
                input.note()
        );

        return obligationResponse(
                requireObligation(
                        obligationId
                )
        );
    }

    public CommercialLeakageDiscoveryResponse discoverLeakage(
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

        List<CommercialGovernanceRepository.LeakageCandidateRow> candidates =
                new ArrayList<>();

        candidates.addAll(
                repository
                        .noActiveContractCandidates(
                                normalizedCurrency
                        )
        );

        candidates.addAll(
                repository
                        .expiredContractCandidates(
                                normalizedCurrency
                        )
        );

        candidates.addAll(
                repository
                        .poVarianceCandidates(
                                normalizedCurrency
                        )
        );

        candidates.addAll(
                repository
                        .priceEscalationCandidates(
                                normalizedCurrency
                        )
        );

        candidates.addAll(
                repository
                        .negotiatedValueCandidates(
                                normalizedCurrency
                        )
        );

        AtomicLong created =
                new AtomicLong();

        AtomicLong refreshed =
                new AtomicLong();

        for (
                CommercialGovernanceRepository.LeakageCandidateRow candidate
                : candidates
        ) {
            CommercialLeakageSeverity severity =
                    candidate.findingType()
                                    == CommercialLeakageType.NO_ACTIVE_CONTRACT
                            ||
                            candidate.findingType()
                                    == CommercialLeakageType.EXPIRED_CONTRACT
                            ? candidate.severity()
                            : calculationService
                                    .severity(
                                            candidate.expectedValue(),
                                            candidate.actualValue()
                                    );

            CommercialGovernanceRepository.LeakageRow existing =
                    repository
                            .findLeakageBySourceKey(
                                    candidate.sourceKey()
                            );

            if (existing == null) {
                repository.createLeakageFinding(
                        UUID.randomUUID(),
                        candidate,
                        severity
                );

                created.incrementAndGet();
            } else {
                repository.refreshLeakageFinding(
                        existing.id(),
                        candidate,
                        severity
                );

                refreshed.incrementAndGet();
            }
        }

        return new CommercialLeakageDiscoveryResponse(
                candidates.size(),
                created.get(),
                refreshed.get()
        );
    }

    @Transactional(readOnly = true)
    public List<CommercialLeakageFindingResponse> leakageFindings(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return repository
                .findLeakageFindings(
                        normalizeCurrency(
                                currency
                        )
                )
                .stream()
                .map(
                        this::leakageResponse
                )
                .toList();
    }

    public CommercialLeakageFindingResponse resolveLeakage(
            UUID currentUserId,
            UUID findingId,
            CommercialLeakageDecisionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CommercialGovernanceRepository.LeakageRow finding =
                requireLeakage(
                        findingId
                );

        if (
                finding.status()
                        != CommercialLeakageStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open commercial leakage findings can be resolved."
            );
        }

        repository.resolveLeakage(
                findingId,
                currentUserId,
                input.note(),
                CommercialLeakageStatus.RESOLVED
        );

        return leakageResponse(
                requireLeakage(
                        findingId
                )
        );
    }

    public CommercialLeakageFindingResponse dismissLeakage(
            UUID currentUserId,
            UUID findingId,
            CommercialLeakageDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CommercialGovernanceRepository.LeakageRow finding =
                requireLeakage(
                        findingId
                );

        if (
                finding.status()
                        != CommercialLeakageStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open commercial leakage findings can be dismissed."
            );
        }

        repository.resolveLeakage(
                findingId,
                currentUserId,
                input.note(),
                CommercialLeakageStatus.DISMISSED
        );

        return leakageResponse(
                requireLeakage(
                        findingId
                )
        );
    }

    @Transactional(readOnly = true)
    public CommercialGovernanceSummaryResponse summary(
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

        List<CommercialGovernanceRepository.GovernanceRow> governance =
                repository
                        .findGovernanceRecords(
                                normalizedCurrency
                        );

        List<CommercialGovernanceRepository.LeakageRow> leakage =
                repository
                        .findLeakageFindings(
                                normalizedCurrency
                        );

        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        LocalDate thirtyDays =
                today.plusDays(
                        30
                );

        long active =
                governance.stream()
                        .filter(
                                row ->
                                        row.governanceStatus()
                                                == CommercialGovernanceStatus.ACTIVE
                        )
                        .count();

        long renewalReviews =
                governance.stream()
                        .filter(
                                row ->
                                        row.renewalStatus()
                                                == ContractRenewalStatus.UNDER_REVIEW
                        )
                        .count();

        long noticesDue =
                governance.stream()
                        .filter(
                                row ->
                                        row.governanceStatus()
                                                == CommercialGovernanceStatus.ACTIVE
                                        &&
                                        !row.noticeDeadline()
                                                .isBefore(
                                                        today
                                                )
                                        &&
                                        !row.noticeDeadline()
                                                .isAfter(
                                                        thirtyDays
                                                )
                        )
                        .count();

        long expired =
                governance.stream()
                        .filter(
                                row ->
                                        row.contractEndDate()
                                                .isBefore(
                                                        today
                                                )
                                        ||
                                        !"ACTIVE".equals(
                                                row.contractStatus()
                                        )
                        )
                        .count();

        long openObligations =
                governance.stream()
                        .mapToLong(
                                CommercialGovernanceRepository.GovernanceRow::
                                        openObligations
                        )
                        .sum();

        long overdueObligations =
                governance.stream()
                        .mapToLong(
                                CommercialGovernanceRepository.GovernanceRow::
                                        overdueObligations
                        )
                        .sum();

        List<CommercialGovernanceRepository.LeakageRow> openFindings =
                leakage.stream()
                        .filter(
                                row ->
                                        row.status()
                                                == CommercialLeakageStatus.OPEN
                        )
                        .toList();

        long criticalFindings =
                openFindings.stream()
                        .filter(
                                row ->
                                        row.severity()
                                                == CommercialLeakageSeverity.CRITICAL
                        )
                        .count();

        BigDecimal leakageExposure =
                openFindings.stream()
                        .map(
                                CommercialGovernanceRepository.LeakageRow::
                                        leakageAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal governedValue =
                governance.stream()
                        .filter(
                                row ->
                                        row.governanceStatus()
                                                == CommercialGovernanceStatus.ACTIVE
                        )
                        .map(
                                CommercialGovernanceRepository.GovernanceRow::
                                        baselineContractValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new CommercialGovernanceSummaryResponse(
                normalizedCurrency,
                governance.size(),
                active,
                renewalReviews,
                noticesDue,
                expired,
                openObligations,
                overdueObligations,
                openFindings.size(),
                criticalFindings,
                leakageExposure,
                governedValue
        );
    }

    @Transactional(readOnly = true)
    public CommercialGovernanceContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new CommercialGovernanceContextResponse(
                repository.contracts(),
                repository.users()
        );
    }

    private CommercialGovernanceRecordResponse governanceResponse(
            CommercialGovernanceRepository.GovernanceRow row
    ) {
        return new CommercialGovernanceRecordResponse(
                row.id(),
                row.contractId(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.contractStatus(),
                row.contractEndDate(),
                row.governanceStatus(),
                row.renewalStatus(),
                row.noticePeriodDays(),
                row.noticeDeadline(),
                money(
                        row.baselineContractValue()
                ),
                row.currency(),
                row.priceEscalationPct()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                row.maxPoVariancePct()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                row.autoRenewal(),
                row.ownerUserId(),
                row.ownerName(),
                row.renewalDecisionNote(),
                row.renewalDecidedAt(),
                row.renewalDecidedByName(),
                row.notes(),
                row.openObligations(),
                row.overdueObligations(),
                row.openLeakageFindings(),
                money(
                        row.leakageExposure()
                ),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private ContractObligationResponse obligationResponse(
            CommercialGovernanceRepository.ObligationRow row
    ) {
        boolean overdue =
                row.status()
                        == ContractObligationStatus.OPEN
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new ContractObligationResponse(
                row.id(),
                row.governanceId(),
                row.obligationType(),
                row.title(),
                row.description(),
                row.dueDate(),
                row.critical(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                overdue,
                row.completionNote(),
                row.completedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private CommercialLeakageFindingResponse leakageResponse(
            CommercialGovernanceRepository.LeakageRow row
    ) {
        return new CommercialLeakageFindingResponse(
                row.id(),
                row.governanceId(),
                row.contractId(),
                row.supplierId(),
                row.supplierName(),
                row.purchaseOrderId(),
                row.purchaseOrderNumber(),
                row.negotiationWorkspaceId(),
                row.negotiationNumber(),
                row.findingType(),
                row.severity(),
                row.status(),
                row.currency(),
                moneyNullable(
                        row.expectedValue()
                ),
                moneyNullable(
                        row.actualValue()
                ),
                money(
                        row.leakageAmount()
                ),
                row.sourceReference(),
                row.details(),
                row.detectedAt(),
                row.lastCheckedAt(),
                row.resolutionNote(),
                row.resolvedAt(),
                row.resolvedByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private CommercialGovernanceRepository.GovernanceRow requireGovernance(
            UUID governanceId
    ) {
        CommercialGovernanceRepository.GovernanceRow governance =
                repository
                        .findGovernance(
                                governanceId
                        );

        if (governance == null) {
            throw new ResourceNotFoundException(
                    "Contract commercial governance record not found: "
                            + governanceId
            );
        }

        return governance;
    }

    private CommercialGovernanceRepository.ObligationRow requireObligation(
            UUID obligationId
    ) {
        CommercialGovernanceRepository.ObligationRow obligation =
                repository
                        .findObligation(
                                obligationId
                        );

        if (obligation == null) {
            throw new ResourceNotFoundException(
                    "Contract obligation not found: "
                            + obligationId
            );
        }

        return obligation;
    }

    private CommercialGovernanceRepository.LeakageRow requireLeakage(
            UUID findingId
    ) {
        CommercialGovernanceRepository.LeakageRow finding =
                repository
                        .findLeakage(
                                findingId
                        );

        if (finding == null) {
            throw new ResourceNotFoundException(
                    "Commercial leakage finding not found: "
                            + findingId
            );
        }

        return finding;
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
                    "Commercial-governance currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
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
                    "Commercial governance ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access commercial governance."
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
                    "Your ProcureIQ role cannot manage commercial governance."
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
                    "Only administrators and procurement managers can make commercial governance decisions."
            );
        }
    }
}
