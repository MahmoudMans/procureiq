package com.procureiq.demandconsolidation;

import com.procureiq.common.exception.ResourceNotFoundException;
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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class DemandConsolidationService {

    private final DemandConsolidationRepository repository;

    private final DemandConsolidationCalculationService calculationService;

    private final AppUserRepository appUserRepository;

    public DemandConsolidationService(
            DemandConsolidationRepository repository,
            DemandConsolidationCalculationService calculationService,
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
    public List<DemandConsolidationCandidateResponse> candidates(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<DemandConsolidationRepository.EligibleIntakeRow> eligible =
                repository
                        .eligibleIntakes();

        Map<String, List<DemandConsolidationRepository.EligibleIntakeRow>> groups =
                new LinkedHashMap<>();

        for (
                DemandConsolidationRepository.EligibleIntakeRow intake
                : eligible
        ) {
            String key =
                    candidateKey(
                            intake.category(),
                            intake.currency()
                    );

            groups.computeIfAbsent(
                    key,
                    ignored ->
                            new ArrayList<>()
            )
                    .add(
                            intake
                    );
        }

        List<DemandConsolidationCandidateResponse> result =
                new ArrayList<>();

        for (
                Map.Entry<
                        String,
                        List<DemandConsolidationRepository.EligibleIntakeRow>
                > entry
                : groups.entrySet()
        ) {
            List<DemandConsolidationRepository.EligibleIntakeRow> rows =
                    entry.getValue();

            Set<UUID> departments =
                    new LinkedHashSet<>();

            for (
                    DemandConsolidationRepository.EligibleIntakeRow row
                    : rows
            ) {
                departments.add(
                        row.departmentId()
                );
            }

            if (
                    rows.size() < 2
                    ||
                    departments.size() < 2
            ) {
                continue;
            }

            BigDecimal total =
                    rows.stream()
                            .map(
                                    DemandConsolidationRepository.EligibleIntakeRow::
                                            estimatedAmount
                            )
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            )
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );

            BigDecimal leverage =
                    calculationService
                            .leveragePercentage(
                                    total,
                                    departments.size(),
                                    rows.size()
                            );

            BigDecimal savings =
                    calculationService
                            .expectedSavings(
                                    total,
                                    leverage
                            );

            DemandConsolidationRepository.EligibleIntakeRow first =
                    rows.getFirst();

            result.add(
                    new DemandConsolidationCandidateResponse(
                            entry.getKey(),
                            first.category(),
                            first.currency(),
                            rows.size(),
                            departments.size(),
                            total,
                            leverage,
                            savings,
                            rows.stream()
                                    .map(
                                            this::candidateIntakeResponse
                                    )
                                    .toList()
                    )
            );
        }

        result.sort(
                (
                        left,
                        right
                ) ->
                        right.totalValue()
                                .compareTo(
                                        left.totalValue()
                                )
        );

        return List.copyOf(
                result
        );
    }

    @Transactional(readOnly = true)
    public List<DemandBundleResponse> bundles(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return repository
                .findBundles()
                .stream()
                .map(
                        this::bundleResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public DemandBundleResponse bundle(
            UUID currentUserId,
            UUID bundleId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return bundleResponse(
                requireBundle(
                        bundleId
                )
        );
    }

    public DemandBundleResponse createBundle(
            UUID currentUserId,
            DemandBundleInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        Set<UUID> requestedIds =
                new LinkedHashSet<>(
                        input.intakeIds()
                );

        if (
                requestedIds.size() < 2
        ) {
            throw new IllegalArgumentException(
                    "A demand bundle requires at least two distinct guided-buying intakes."
            );
        }

        String normalizedCurrency =
                normalizeCurrency(
                        input.currency()
                );

        String normalizedCategory =
                input.category()
                        .trim();

        List<DemandConsolidationRepository.EligibleIntakeRow> selected =
                repository
                        .eligibleIntakes()
                        .stream()
                        .filter(
                                intake ->
                                        requestedIds.contains(
                                                intake.id()
                                        )
                        )
                        .toList();

        if (
                selected.size()
                        != requestedIds.size()
        ) {
            throw new IllegalArgumentException(
                    "One or more selected intakes are no longer eligible for consolidation."
            );
        }

        Set<UUID> departments =
                new LinkedHashSet<>();

        for (
                DemandConsolidationRepository.EligibleIntakeRow intake
                : selected
        ) {
            if (
                    !intake.category()
                            .equalsIgnoreCase(
                                    normalizedCategory
                            )
            ) {
                throw new IllegalArgumentException(
                        "All bundled intakes must belong to the same procurement category."
                );
            }

            if (
                    !intake.currency()
                            .equalsIgnoreCase(
                                    normalizedCurrency
                            )
            ) {
                throw new IllegalArgumentException(
                        "All bundled intakes must use the same currency."
                );
            }

            departments.add(
                    intake.departmentId()
            );
        }

        if (
                departments.size() < 2
        ) {
            throw new IllegalArgumentException(
                    "Demand consolidation requires demand from at least two departments."
            );
        }

        BigDecimal consolidatedValue =
                selected.stream()
                        .map(
                                DemandConsolidationRepository.EligibleIntakeRow::
                                        estimatedAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal leverage =
                calculationService
                        .leveragePercentage(
                                consolidatedValue,
                                departments.size(),
                                selected.size()
                        );

        BigDecimal savings =
                calculationService
                        .expectedSavings(
                                consolidatedValue,
                                leverage
                        );

        UUID ownerUserId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireGovernanceUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID bundleId =
                UUID.randomUUID();

        repository.createBundle(
                bundleId,
                nextBundleNumber(),
                input,
                ownerUserId,
                consolidatedValue,
                leverage,
                savings,
                selected.size(),
                departments.size(),
                normalizedCurrency
        );

        for (
                DemandConsolidationRepository.EligibleIntakeRow intake
                : selected
        ) {
            repository.createBundleItem(
                    bundleId,
                    intake
            );
        }

        return bundleResponse(
                requireBundle(
                        bundleId
                )
        );
    }

    public DemandBundleResponse submit(
            UUID currentUserId,
            UUID bundleId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        DemandConsolidationRepository.BundleRow bundle =
                requireBundle(
                        bundleId
                );

        if (
                bundle.status()
                        != DemandBundleStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft demand bundles can be submitted for review."
            );
        }

        repository.submitBundle(
                bundleId
        );

        return bundleResponse(
                requireBundle(
                        bundleId
                )
        );
    }

    public DemandBundleResponse approve(
            UUID currentUserId,
            UUID bundleId,
            DemandBundleDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        DemandConsolidationRepository.BundleRow bundle =
                requireBundle(
                        bundleId
                );

        if (
                bundle.status()
                        != DemandBundleStatus.UNDER_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only demand bundles under review can be approved."
            );
        }

        repository.approveBundle(
                bundleId,
                currentUserId,
                input.note()
        );

        return bundleResponse(
                requireBundle(
                        bundleId
                )
        );
    }

    public DemandBundleResponse cancel(
            UUID currentUserId,
            UUID bundleId,
            DemandBundleDecisionInput input
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        DemandConsolidationRepository.BundleRow bundle =
                requireBundle(
                        bundleId
                );

        if (
                bundle.status()
                        == DemandBundleStatus.SOURCING
                ||
                bundle.status()
                        == DemandBundleStatus.CLOSED
                ||
                bundle.status()
                        == DemandBundleStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "This demand bundle can no longer be cancelled."
            );
        }

        repository.cancelBundle(
                bundleId,
                currentUserId,
                input.note()
        );

        return bundleResponse(
                requireBundle(
                        bundleId
                )
        );
    }

    public DemandBundleResponse linkRfq(
            UUID currentUserId,
            UUID bundleId,
            DemandBundleRfqLinkInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        DemandConsolidationRepository.BundleRow bundle =
                requireBundle(
                        bundleId
                );

        if (
                bundle.status()
                        != DemandBundleStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only approved demand bundles can enter sourcing."
            );
        }

        DemandConsolidationRepository.RfqRow rfq =
                repository
                        .findRfq(
                                input.rfqId()
                        );

        if (rfq == null) {
            throw new ResourceNotFoundException(
                    "RFQ not found: "
                            + input.rfqId()
            );
        }

        if (
                "CANCELLED".equals(
                        rfq.status()
                )
        ) {
            throw new IllegalArgumentException(
                    "Cancelled RFQs cannot be linked to demand bundles."
            );
        }

        if (
                !bundle.currency()
                        .equalsIgnoreCase(
                                rfq.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "RFQ currency must match the consolidated demand bundle currency."
            );
        }

        repository.linkRfq(
                bundleId,
                rfq.id()
        );

        return bundleResponse(
                requireBundle(
                        bundleId
                )
        );
    }

    public DemandBundleResponse close(
            UUID currentUserId,
            UUID bundleId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        DemandConsolidationRepository.BundleRow bundle =
                requireBundle(
                        bundleId
                );

        if (
                bundle.status()
                        != DemandBundleStatus.SOURCING
        ) {
            throw new IllegalArgumentException(
                    "Only demand bundles in sourcing can be closed."
            );
        }

        repository.closeBundle(
                bundleId
        );

        return bundleResponse(
                requireBundle(
                        bundleId
                )
        );
    }

    @Transactional(readOnly = true)
    public DemandConsolidationSummaryResponse summary(
            UUID currentUserId
    ) {
        List<DemandConsolidationCandidateResponse> candidates =
                candidates(
                        currentUserId
                );

        List<DemandConsolidationRepository.BundleRow> bundles =
                repository
                        .findBundles();

        long candidateIntakes =
                candidates.stream()
                        .mapToLong(
                                DemandConsolidationCandidateResponse::
                                        intakeCount
                        )
                        .sum();

        BigDecimal candidateValue =
                candidates.stream()
                        .map(
                                DemandConsolidationCandidateResponse::
                                        totalValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        long openBundles =
                bundles.stream()
                        .filter(
                                bundle ->
                                        bundle.status()
                                                == DemandBundleStatus.DRAFT
                                        ||
                                        bundle.status()
                                                == DemandBundleStatus.UNDER_REVIEW
                        )
                        .count();

        long approvedBundles =
                bundles.stream()
                        .filter(
                                bundle ->
                                        bundle.status()
                                                == DemandBundleStatus.APPROVED
                        )
                        .count();

        long sourcingBundles =
                bundles.stream()
                        .filter(
                                bundle ->
                                        bundle.status()
                                                == DemandBundleStatus.SOURCING
                        )
                        .count();

        long closedBundles =
                bundles.stream()
                        .filter(
                                bundle ->
                                        bundle.status()
                                                == DemandBundleStatus.CLOSED
                        )
                        .count();

        BigDecimal bundledValue =
                bundles.stream()
                        .filter(
                                bundle ->
                                        bundle.status()
                                                != DemandBundleStatus.CANCELLED
                        )
                        .map(
                                DemandConsolidationRepository.BundleRow::
                                        consolidatedValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal expectedSavings =
                bundles.stream()
                        .filter(
                                bundle ->
                                        bundle.status()
                                                != DemandBundleStatus.CANCELLED
                        )
                        .map(
                                DemandConsolidationRepository.BundleRow::
                                        expectedSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new DemandConsolidationSummaryResponse(
                candidates.size(),
                candidateIntakes,
                candidateValue,
                openBundles,
                approvedBundles,
                sourcingBundles,
                closedBundles,
                bundledValue,
                expectedSavings
        );
    }

    @Transactional(readOnly = true)
    public DemandConsolidationContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return new DemandConsolidationContextResponse(
                repository.users(),
                repository.rfqs()
        );
    }

    private DemandCandidateIntakeResponse candidateIntakeResponse(
            DemandConsolidationRepository.EligibleIntakeRow row
    ) {
        return new DemandCandidateIntakeResponse(
                row.id(),
                row.intakeNumber(),
                row.title(),
                row.departmentId(),
                row.departmentName(),
                row.category(),
                row.currency(),
                money(
                        row.estimatedAmount()
                ),
                row.status(),
                row.guidanceRoute(),
                row.createdAt()
        );
    }

    private DemandBundleResponse bundleResponse(
            DemandConsolidationRepository.BundleRow row
    ) {
        return new DemandBundleResponse(
                row.id(),
                row.bundleNumber(),
                row.title(),
                row.category(),
                row.currency(),
                row.status(),
                row.targetSourcingDate(),
                money(
                        row.consolidatedValue()
                ),
                row.expectedLeveragePct()
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                money(
                        row.expectedSavings()
                ),
                row.intakeCount(),
                row.departmentCount(),
                row.ownerUserId(),
                row.ownerName(),
                row.rationale(),
                row.decisionNote(),
                row.decidedAt(),
                row.decidedByName(),
                row.linkedRfqId(),
                row.linkedRfqNumber(),
                row.linkedRfqTitle(),
                row.linkedRfqStatus(),
                row.sourcingStartedAt(),
                row.closedAt(),
                repository
                        .findBundleItems(
                                row.id()
                        )
                        .stream()
                        .map(
                                item ->
                                        new DemandBundleItemResponse(
                                                item.id(),
                                                item.intakeId(),
                                                item.intakeNumber(),
                                                item.title(),
                                                item.departmentId(),
                                                item.departmentName(),
                                                money(
                                                        item.estimatedAmount()
                                                ),
                                                item.intakeStatus(),
                                                item.guidanceRoute()
                                        )
                        )
                        .toList(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private DemandConsolidationRepository.BundleRow requireBundle(
            UUID bundleId
    ) {
        DemandConsolidationRepository.BundleRow bundle =
                repository
                        .findBundle(
                                bundleId
                        );

        if (bundle == null) {
            throw new ResourceNotFoundException(
                    "Demand consolidation bundle not found: "
                            + bundleId
            );
        }

        return bundle;
    }

    private String candidateKey(
            String category,
            String currency
    ) {
        return category
                .trim()
                .toLowerCase(
                        Locale.ROOT
                )
                + "::"
                + currency
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        );
    }

    private String nextBundleNumber() {
        Long sequence =
                repository
                        .nextBundleSequence();

        return String.format(
                "BND-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
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
                    "Demand bundle currency must contain exactly three characters."
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
                    "Demand bundle ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access demand consolidation."
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
                    "Your ProcureIQ role cannot manage demand consolidation bundles."
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
                    "Only administrators and procurement managers can approve demand bundles."
            );
        }
    }
}
