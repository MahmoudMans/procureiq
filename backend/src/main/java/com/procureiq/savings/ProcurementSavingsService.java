package com.procureiq.savings;

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
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Service
@Transactional
public class ProcurementSavingsService {

    private final ProcurementSavingsRepository repository;
    private final SavingsCalculationService calculationService;
    private final AppUserRepository appUserRepository;

    public ProcurementSavingsService(
            ProcurementSavingsRepository repository,
            SavingsCalculationService calculationService,
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
    public List<SavingsInitiativeResponse> initiatives(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SavingsContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return repository
                .findAll(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        this::toResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public SavingsInitiativeResponse find(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return toResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public SavingsInitiativeResponse create(
            UUID currentUserId,
            SavingsInitiativeInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        BigDecimal target =
                calculationService
                        .targetSavings(
                                input.baselineValue(),
                                input.negotiatedValue()
                        );

        UUID ownerId =
                input.ownerUserId() == null
                        ? currentUserId
                        : findAssignableUser(
                                input.ownerUserId()
                        ).getId();

        validateManualRelationships(
                input
        );

        UUID id =
                UUID.randomUUID();

        repository.createManualInitiative(
                id,
                nextSavingsNumber(),
                input,
                ownerId,
                target,
                normalizeCurrency(
                        input.currency()
                )
        );

        return toResponse(
                requireInitiative(
                        id
                )
        );
    }

    public SavingsInitiativeResponse submit(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        ProcurementSavingsRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != SavingsStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft savings initiatives can be submitted."
            );
        }

        repository.updateStatus(
                initiativeId,
                SavingsStatus.SUBMITTED
        );

        return toResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public SavingsInitiativeResponse validate(
            UUID currentUserId,
            UUID initiativeId,
            SavingsDecisionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertValidationRole(
                currentUser.getRole()
        );

        ProcurementSavingsRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != SavingsStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted savings initiatives can be validated."
            );
        }

        repository.recordDecision(
                initiativeId,
                SavingsStatus.VALIDATED,
                currentUserId,
                input.note()
        );

        return toResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public SavingsInitiativeResponse reject(
            UUID currentUserId,
            UUID initiativeId,
            SavingsDecisionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertValidationRole(
                currentUser.getRole()
        );

        ProcurementSavingsRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != SavingsStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted savings initiatives can be rejected."
            );
        }

        repository.recordDecision(
                initiativeId,
                SavingsStatus.REJECTED,
                currentUserId,
                input.note()
        );

        return toResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public SavingsInitiativeResponse close(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertValidationRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        ProcurementSavingsRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != SavingsStatus.VALIDATED
        ) {
            throw new IllegalArgumentException(
                    "Only validated savings initiatives can be closed."
            );
        }

        repository.updateStatus(
                initiativeId,
                SavingsStatus.CLOSED
        );

        return toResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public SavingsRealizationResponse addRealization(
            UUID currentUserId,
            UUID initiativeId,
            SavingsRealizationInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ProcurementSavingsRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != SavingsStatus.VALIDATED
        ) {
            throw new IllegalArgumentException(
                    "Savings realization can only be recorded for validated initiatives."
            );
        }

        UUID id =
                UUID.randomUUID();

        repository.createManualRealization(
                id,
                initiativeId,
                input,
                currentUserId
        );

        repository.syncRealizedSavings(
                initiativeId
        );

        return repository
                .realizations(
                        initiativeId
                )
                .stream()
                .filter(
                        row ->
                                row.id()
                                        .equals(id)
                )
                .map(
                        this::toRealizationResponse
                )
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalStateException(
                                        "Created savings realization could not be reloaded."
                                )
                );
    }

    public SavingsDiscoveryResponse discover(
            UUID currentUserId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        List<ProcurementSavingsRepository.OpportunityRow> opportunities =
                repository
                        .discoverOpportunities();

        AtomicLong created =
                new AtomicLong();

        AtomicLong updated =
                new AtomicLong();

        AtomicLong createdRealizations =
                new AtomicLong();

        AtomicLong updatedRealizations =
                new AtomicLong();

        for (
                ProcurementSavingsRepository.OpportunityRow opportunity
                : opportunities
        ) {
            ProcurementSavingsRepository.InitiativeRow existing =
                    repository
                            .findBySourceKey(
                                    opportunity.sourceKey()
                            );

            UUID initiativeId;

            if (existing == null) {
                initiativeId =
                        UUID.randomUUID();

                repository.createSystemInitiative(
                        initiativeId,
                        nextSavingsNumber(),
                        opportunity,
                        currentUserId
                );

                created.incrementAndGet();
            } else {
                initiativeId =
                        existing.id();

                repository.updateSystemInitiative(
                        initiativeId,
                        opportunity
                );

                updated.incrementAndGet();
            }

            if (
                    opportunity.purchaseOrderId()
                            != null
                    &&
                    opportunity.purchaseOrderTotal()
                            != null
                    &&
                    opportunity.purchaseOrderDate()
                            != null
            ) {
                BigDecimal realized =
                        opportunity.baselineValue()
                                .subtract(
                                        opportunity.purchaseOrderTotal()
                                )
                                .max(
                                        BigDecimal.ZERO
                                )
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                );

                boolean realizationCreated =
                        repository
                                .upsertPurchaseOrderRealization(
                                        initiativeId,
                                        opportunity.purchaseOrderId(),
                                        opportunity.purchaseOrderDate()
                                                .atZone(
                                                        ZoneOffset.UTC
                                                )
                                                .toLocalDate(),
                                        realized,
                                        currentUserId
                                );

                if (realizationCreated) {
                    createdRealizations
                            .incrementAndGet();
                } else {
                    updatedRealizations
                            .incrementAndGet();
                }

                repository.syncRealizedSavings(
                        initiativeId
                );
            }
        }

        return new SavingsDiscoveryResponse(
                opportunities.size(),
                created.get(),
                updated.get(),
                createdRealizations.get(),
                updatedRealizations.get()
        );
    }

    @Transactional(readOnly = true)
    public SavingsSummaryResponse summary(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        List<SavingsInitiativeResponse> initiatives =
                initiatives(
                        currentUserId,
                        requestedYear,
                        requestedCurrency
                );

        SavingsContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        List<SavingsInitiativeResponse> validated =
                initiatives.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SavingsStatus.VALIDATED
                                        ||
                                        item.status()
                                                == SavingsStatus.CLOSED
                        )
                        .toList();

        long pending =
                initiatives.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SavingsStatus.DRAFT
                                        ||
                                        item.status()
                                                == SavingsStatus.SUBMITTED
                        )
                        .count();

        long rejected =
                initiatives.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == SavingsStatus.REJECTED
                        )
                        .count();

        BigDecimal target =
                validated.stream()
                        .map(
                                SavingsInitiativeResponse::
                                        targetSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal realized =
                validated.stream()
                        .map(
                                SavingsInitiativeResponse::
                                        realizedSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal hardSavings =
                validated.stream()
                        .filter(
                                item ->
                                        item.savingsType()
                                                == SavingsType.HARD_SAVINGS
                        )
                        .map(
                                SavingsInitiativeResponse::
                                        realizedSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal costAvoidance =
                validated.stream()
                        .filter(
                                item ->
                                        item.savingsType()
                                                == SavingsType.COST_AVOIDANCE
                        )
                        .map(
                                SavingsInitiativeResponse::
                                        realizedSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new SavingsSummaryResponse(
                context.fiscalYear(),
                context.currency(),
                initiatives.size(),
                validated.size(),
                pending,
                rejected,
                money(target),
                money(realized),
                calculationService
                        .remaining(
                                target,
                                realized
                        ),
                calculationService
                        .realizationRate(
                                realized,
                                target
                        ),
                money(hardSavings),
                money(costAvoidance)
        );
    }

    @Transactional(readOnly = true)
    public List<SavingsMonthlyResponse> monthly(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SavingsContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return repository.monthly(
                context.fiscalYear(),
                context.currency()
        );
    }

    @Transactional(readOnly = true)
    public List<SavingsAttributionResponse>
    supplierAttribution(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SavingsContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return repository
                .supplierAttribution(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        this::toAttributionResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SavingsAttributionResponse>
    categoryAttribution(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        SavingsContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return repository
                .categoryAttribution(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        this::toAttributionResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public SavingsContextOptionsResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        return new SavingsContextOptionsResponse(
                repository.users(),
                repository.suppliers(),
                repository.rfqs(),
                repository.purchaseOrders(),
                repository.categories()
        );
    }

    private SavingsInitiativeResponse toResponse(
            ProcurementSavingsRepository.InitiativeRow row
    ) {
        List<SavingsRealizationResponse> realizations =
                repository
                        .realizations(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::toRealizationResponse
                        )
                        .toList();

        return new SavingsInitiativeResponse(
                row.id(),
                row.savingsNumber(),
                row.origin(),
                row.title(),
                row.savingsType(),
                row.status(),
                row.fiscalYear(),
                row.currency(),
                row.category(),
                row.rfqId(),
                row.rfqNumber(),
                row.supplierId(),
                row.supplierName(),
                row.purchaseOrderId(),
                row.purchaseOrderNumber(),
                money(
                        row.baselineValue()
                ),
                money(
                        row.negotiatedValue()
                ),
                money(
                        row.targetSavings()
                ),
                money(
                        row.realizedSavings()
                ),
                calculationService
                        .remaining(
                                row.targetSavings(),
                                row.realizedSavings()
                        ),
                calculationService
                        .realizationRate(
                                row.realizedSavings(),
                                row.targetSavings()
                        ),
                row.ownerUserId(),
                row.ownerName(),
                row.decisionNote(),
                row.decisionAt(),
                row.decidedByName(),
                row.notes(),
                realizations,
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private SavingsRealizationResponse
    toRealizationResponse(
            ProcurementSavingsRepository.RealizationRow row
    ) {
        return new SavingsRealizationResponse(
                row.id(),
                row.sourceType(),
                row.purchaseOrderId(),
                row.purchaseOrderNumber(),
                row.realizationDate(),
                money(
                        row.amount()
                ),
                row.notes(),
                row.createdByUserId(),
                row.createdByName(),
                row.createdAt()
        );
    }

    private SavingsAttributionResponse
    toAttributionResponse(
            ProcurementSavingsRepository.AttributionRow row
    ) {
        return new SavingsAttributionResponse(
                row.label(),
                money(
                        row.targetSavings()
                ),
                money(
                        row.realizedSavings()
                ),
                row.initiativeCount(),
                calculationService
                        .realizationRate(
                                row.realizedSavings(),
                                row.targetSavings()
                        )
        );
    }

    private ProcurementSavingsRepository.InitiativeRow
    requireInitiative(
            UUID initiativeId
    ) {
        ProcurementSavingsRepository.InitiativeRow row =
                repository.findById(
                        initiativeId
                );

        if (row == null) {
            throw new ResourceNotFoundException(
                    "Savings initiative not found: "
                            + initiativeId
            );
        }

        return row;
    }

    private void validateManualRelationships(
            SavingsInitiativeInput input
    ) {
        if (
                input.purchaseOrderId()
                        == null
        ) {
            return;
        }

        SavingsPurchaseOrderOptionResponse order =
                repository
                        .purchaseOrders()
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.id()
                                                .equals(
                                                        input.purchaseOrderId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Purchase order not found: "
                                                        + input.purchaseOrderId()
                                        )
                        );

        if (
                input.supplierId()
                        != null
                &&
                !input.supplierId()
                        .equals(
                                order.supplierId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Selected purchase order does not belong to the selected supplier."
            );
        }

        if (
                !order.currency()
                        .equalsIgnoreCase(
                                input.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Selected purchase-order currency must match the savings initiative currency."
            );
        }
    }

    private String nextSavingsNumber() {
        Long sequence =
                repository
                        .nextSavingsSequence();

        return String.format(
                "SVG-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                sequence
        );
    }

    private SavingsContext context(
            Integer requestedYear,
            String requestedCurrency
    ) {
        int year =
                requestedYear == null
                        ? Year.now(
                                ZoneOffset.UTC
                        ).getValue()
                        : requestedYear;

        String currency =
                requestedCurrency == null
                        ||
                        requestedCurrency
                                .isBlank()
                        ? "EUR"
                        : normalizeCurrency(
                                requestedCurrency
                        );

        return new SavingsContext(
                year,
                currency
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
                    "Savings currency must contain exactly three characters."
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

    private AppUserEntity findAssignableUser(
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
                    "Savings initiatives must be owned by a procurement governance user."
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
                    "Your ProcureIQ role cannot access savings management."
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
                    "Your ProcureIQ role cannot manage savings initiatives."
            );
        }
    }

    private void assertValidationRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can validate savings."
            );
        }
    }

    private record SavingsContext(
            int fiscalYear,
            String currency
    ) {
    }
}
