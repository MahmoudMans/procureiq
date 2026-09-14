package com.procureiq.planning;

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
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class ProcurementPlanningService {

    private final ProcurementPlanningRepository
            repository;

    private final PlanningCalculationService
            calculationService;

    private final AppUserRepository
            appUserRepository;

    public ProcurementPlanningService(
            ProcurementPlanningRepository repository,
            PlanningCalculationService calculationService,
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
    public List<ProcurementPlanResponse> plans(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        PlanningContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return repository
                .findPlans(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        this::planResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public ProcurementPlanDetailResponse detail(
            UUID currentUserId,
            UUID planId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ProcurementPlanningRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        return new ProcurementPlanDetailResponse(
                planResponse(plan),
                repository
                        .findItems(
                                planId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList()
        );
    }

    public ProcurementPlanResponse createPlan(
            UUID currentUserId,
            ProcurementPlanInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        UUID ownerId =
                input.ownerUserId() == null
                        ? currentUserId
                        : requirePlanningOwner(
                                input.ownerUserId()
                        )
                                .getId();

        UUID id =
                UUID.randomUUID();

        repository.createPlan(
                id,
                nextPlanNumber(),
                input,
                ownerId,
                normalizeCurrency(
                        input.currency()
                )
        );

        return planResponse(
                requirePlan(id)
        );
    }

    public ProcurementPlanResponse activatePlan(
            UUID currentUserId,
            UUID planId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ProcurementPlanningRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        if (
                plan.status()
                        != ProcurementPlanStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft plans can be activated."
            );
        }

        repository.activatePlan(
                planId
        );

        return planResponse(
                requirePlan(
                        planId
                )
        );
    }

    public ProcurementPlanResponse closePlan(
            UUID currentUserId,
            UUID planId
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ProcurementPlanningRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        if (
                plan.status()
                        == ProcurementPlanStatus.CLOSED
                ||
                plan.status()
                        == ProcurementPlanStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Plan is already closed."
            );
        }

        repository.closePlan(
                planId
        );

        return planResponse(
                requirePlan(
                        planId
                )
        );
    }

    public ProcurementPlanItemResponse addItem(
            UUID currentUserId,
            UUID planId,
            ProcurementPlanItemInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ProcurementPlanningRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        if (
                plan.status()
                        == ProcurementPlanStatus.CLOSED
                ||
                plan.status()
                        == ProcurementPlanStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Closed plans cannot receive new initiatives."
            );
        }

        if (
                input.targetSourcingDate()
                        .getYear()
                        != plan.fiscalYear()
        ) {
            throw new IllegalArgumentException(
                    "Initiative target sourcing date must fall inside the plan fiscal year."
            );
        }

        UUID itemId =
                UUID.randomUUID();

        repository.createItem(
                itemId,
                planId,
                input
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ProcurementPlanItemResponse markReady(
            UUID currentUserId,
            UUID itemId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ProcurementPlanningRepository.ItemRow item =
                requireItem(
                        itemId
                );

        if (
                item.status()
                        != ProcurementPlanItemStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned initiatives can be marked ready."
            );
        }

        repository.updateItemStatus(
                itemId,
                ProcurementPlanItemStatus.READY
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ProcurementPlanItemResponse linkRequest(
            UUID currentUserId,
            UUID itemId,
            PlanRequestLinkInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ProcurementPlanningRepository.ItemRow item =
                requireItem(
                        itemId
                );

        ProcurementPlanningRepository.PlanRow plan =
                requirePlan(
                        item.planId()
                );

        PlanningRequestOptionResponse request =
                repository
                        .purchaseRequests()
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.id()
                                                .equals(
                                                        input.purchaseRequestId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Purchase request is unavailable for planning linkage: "
                                                        + input.purchaseRequestId()
                                        )
                        );

        if (
                !request.departmentId()
                        .equals(
                                item.departmentId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Linked purchase request must belong to the same department as the planned initiative."
            );
        }

        if (
                !request.currency()
                        .equalsIgnoreCase(
                                plan.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Linked purchase request currency must match the procurement plan currency."
            );
        }

        try {
            repository.linkRequest(
                    itemId,
                    request.id()
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "This purchase request is already linked to another planning initiative."
            );
        }

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ProcurementPlanItemResponse completeItem(
            UUID currentUserId,
            UUID itemId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ProcurementPlanningRepository.ItemRow item =
                requireItem(
                        itemId
                );

        if (
                item.status()
                        != ProcurementPlanItemStatus.CONVERTED
        ) {
            throw new IllegalArgumentException(
                    "Only converted initiatives can be completed."
            );
        }

        repository.updateItemStatus(
                itemId,
                ProcurementPlanItemStatus.COMPLETED
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public ProcurementPlanItemResponse cancelItem(
            UUID currentUserId,
            UUID itemId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ProcurementPlanningRepository.ItemRow item =
                requireItem(
                        itemId
                );

        if (
                item.status()
                        == ProcurementPlanItemStatus.COMPLETED
                ||
                item.status()
                        == ProcurementPlanItemStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Completed or cancelled initiatives cannot be cancelled."
            );
        }

        repository.updateItemStatus(
                itemId,
                ProcurementPlanItemStatus.CANCELLED
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    @Transactional(readOnly = true)
    public PlanningSummaryResponse summary(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        List<ProcurementPlanResponse> plans =
                plans(
                        currentUserId,
                        requestedYear,
                        requestedCurrency
                );

        PlanningContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        List<PlanningUpcomingDemandResponse> upcoming =
                upcomingDemand(
                        currentUserId,
                        requestedYear,
                        requestedCurrency
                );

        long items =
                plans.stream()
                        .mapToLong(
                                ProcurementPlanResponse::
                                        totalItems
                        )
                        .sum();

        long converted =
                plans.stream()
                        .mapToLong(
                                ProcurementPlanResponse::
                                        convertedItems
                        )
                        .sum();

        BigDecimal planned =
                plans.stream()
                        .map(
                                ProcurementPlanResponse::
                                        plannedValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal actual =
                plans.stream()
                        .map(
                                ProcurementPlanResponse::
                                        linkedActualValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        long overdue =
                upcoming.stream()
                        .filter(
                                item ->
                                        item.daysUntilTarget()
                                                < 0
                        )
                        .count();

        long upcomingCount =
                upcoming.stream()
                        .filter(
                                item ->
                                        item.daysUntilTarget()
                                                >= 0
                                        &&
                                        item.daysUntilTarget()
                                                <= 60
                        )
                        .count();

        long activePlans =
                plans.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                == ProcurementPlanStatus.ACTIVE
                        )
                        .count();

        return new PlanningSummaryResponse(
                context.fiscalYear(),
                context.currency(),
                activePlans,
                items,
                upcomingCount,
                overdue,
                converted,
                money(planned),
                money(actual),
                calculationService
                        .variance(
                                planned,
                                actual
                        ),
                calculationService
                        .conversionRate(
                                converted,
                                items
                        )
        );
    }

    @Transactional(readOnly = true)
    public List<PlanningMonthlyForecastResponse>
    monthlyForecast(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        PlanningContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return repository
                .monthlyForecast(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        row ->
                                new PlanningMonthlyForecastResponse(
                                        row.month(),
                                        money(
                                                row.plannedValue()
                                        ),
                                        money(
                                                row.actualValue()
                                        ),
                                        row.initiativeCount()
                                )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlanningCategoryVarianceResponse>
    categoryVariance(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        PlanningContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return repository
                .categoryVariance(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        row ->
                                new PlanningCategoryVarianceResponse(
                                        row.category(),
                                        money(
                                                row.plannedValue()
                                        ),
                                        money(
                                                row.actualValue()
                                        ),
                                        calculationService
                                                .variance(
                                                        row.plannedValue(),
                                                        row.actualValue()
                                                ),
                                        row.initiativeCount()
                                )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlanningUpcomingDemandResponse>
    upcomingDemand(
            UUID currentUserId,
            Integer requestedYear,
            String requestedCurrency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        PlanningContext context =
                context(
                        requestedYear,
                        requestedCurrency
                );

        return repository
                .upcomingDemand(
                        context.fiscalYear(),
                        context.currency()
                )
                .stream()
                .map(
                        row ->
                                new PlanningUpcomingDemandResponse(
                                        row.itemId(),
                                        row.planId(),
                                        row.planNumber(),
                                        row.title(),
                                        row.departmentName(),
                                        row.category(),
                                        row.priority(),
                                        row.status(),
                                        money(
                                                row.plannedValue()
                                        ),
                                        row.targetSourcingDate(),
                                        row.daysUntilTarget()
                                )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public PlanningContextOptionsResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new PlanningContextOptionsResponse(
                repository.departments(),
                repository.users(),
                repository.purchaseRequests(),
                repository.categories()
        );
    }

    private ProcurementPlanResponse planResponse(
            ProcurementPlanningRepository.PlanRow row
    ) {
        BigDecimal planned =
                money(
                        row.plannedValue()
                );

        BigDecimal actual =
                money(
                        row.actualValue()
                );

        return new ProcurementPlanResponse(
                row.id(),
                row.planNumber(),
                row.name(),
                row.fiscalYear(),
                row.currency(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                row.notes(),
                row.totalItems(),
                row.convertedItems(),
                row.completedItems(),
                planned,
                actual,
                calculationService
                        .variance(
                                planned,
                                actual
                        ),
                calculationService
                        .conversionRate(
                                row.convertedItems(),
                                row.totalItems()
                        ),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private ProcurementPlanItemResponse itemResponse(
            ProcurementPlanningRepository.ItemRow row
    ) {
        BigDecimal planned =
                money(
                        row.plannedValue()
                );

        BigDecimal actual =
                money(
                        row.linkedRequestValue()
                );

        return new ProcurementPlanItemResponse(
                row.id(),
                row.planId(),
                row.title(),
                row.description(),
                row.departmentId(),
                row.departmentName(),
                row.category(),
                planned,
                row.targetSourcingDate(),
                row.priority(),
                row.status(),
                row.linkedPurchaseRequestId(),
                row.linkedRequestNumber(),
                row.linkedRequestStatus(),
                row.linkedPurchaseRequestId()
                        == null
                        ? null
                        : actual,
                row.linkedPurchaseRequestId()
                        == null
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : calculationService
                                .variance(
                                        planned,
                                        actual
                                ),
                (
                        row.status()
                                == ProcurementPlanItemStatus.PLANNED
                        ||
                        row.status()
                                == ProcurementPlanItemStatus.READY
                )
                &&
                row.targetSourcingDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        ),
                row.notes(),
                row.convertedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private ProcurementPlanningRepository.PlanRow requirePlan(
            UUID planId
    ) {
        ProcurementPlanningRepository.PlanRow row =
                repository.findPlan(
                        planId
                );

        if (row == null) {
            throw new ResourceNotFoundException(
                    "Procurement plan not found: "
                            + planId
            );
        }

        return row;
    }

    private ProcurementPlanningRepository.ItemRow requireItem(
            UUID itemId
    ) {
        ProcurementPlanningRepository.ItemRow row =
                repository.findItem(
                        itemId
                );

        if (row == null) {
            throw new ResourceNotFoundException(
                    "Planning initiative not found: "
                            + itemId
            );
        }

        return row;
    }

    private String nextPlanNumber() {
        Long sequence =
                repository.nextPlanSequence();

        return String.format(
                "PLAN-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private PlanningContext context(
            Integer requestedYear,
            String requestedCurrency
    ) {
        int year =
                requestedYear == null
                        ? Year.now(
                                ZoneOffset.UTC
                        )
                                .getValue()
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

        return new PlanningContext(
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
                    "Planning currency must contain exactly three characters."
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
                        .findById(userId)
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

    private AppUserEntity requirePlanningOwner(
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
                    "Procurement plans must be owned by a procurement governance user."
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
                    "Your ProcureIQ role cannot access procurement planning."
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
                    "Your ProcureIQ role cannot manage procurement plans."
            );
        }
    }

    private record PlanningContext(
            int fiscalYear,
            String currency
    ) {
    }
}
