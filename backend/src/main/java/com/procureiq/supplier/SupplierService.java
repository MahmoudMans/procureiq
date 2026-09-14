package com.procureiq.supplier;

import com.procureiq.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(
            SupplierRepository supplierRepository
    ) {
        this.supplierRepository = supplierRepository;
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> findSuppliers(
            String query,
            SupplierStatus status,
            SupplierRiskLevel riskLevel
    ) {
        String normalizedQuery =
                normalizeOptional(query);

        return supplierRepository
                .search(
                        normalizedQuery,
                        status,
                        riskLevel
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierResponse findSupplier(UUID id) {
        return toResponse(findActiveEntity(id));
    }

    public SupplierResponse createSupplier(
            SupplierCreateRequest request
    ) {
        String supplierCode =
                normalizeRequired(
                        request.supplierCode()
                );

        if (
                supplierRepository
                        .existsBySupplierCodeIgnoreCase(
                                supplierCode
                        )
        ) {
            throw new IllegalArgumentException(
                    "Supplier code already exists: "
                            + supplierCode
            );
        }

        SupplierEntity supplier =
                new SupplierEntity();

        supplier.setSupplierCode(
                supplierCode.toUpperCase()
        );

        supplier.setLegalName(
                normalizeRequired(
                        request.legalName()
                )
        );

        supplier.setTradingName(
                normalizeOptional(
                        request.tradingName()
                )
        );

        supplier.setContactEmail(
                normalizeOptional(
                        request.contactEmail()
                )
        );

        supplier.setPhone(
                normalizeOptional(
                        request.phone()
                )
        );

        supplier.setWebsite(
                normalizeOptional(
                        request.website()
                )
        );

        supplier.setCountry(
                normalizeRequired(
                        request.country()
                )
        );

        supplier.setCity(
                normalizeOptional(
                        request.city()
                )
        );

        supplier.setCategory(
                normalizeRequired(
                        request.category()
                )
        );

        supplier.setStatus(
                request.status() == null
                        ? SupplierStatus.ACTIVE
                        : request.status()
        );

        supplier.setRiskLevel(
                request.riskLevel() == null
                        ? SupplierRiskLevel.LOW
                        : request.riskLevel()
        );

        supplier.setRating(
                request.rating()
        );

        supplier.setOnTimeDeliveryRate(
                request.onTimeDeliveryRate()
        );

        supplier.setTotalSpend(
                BigDecimal.ZERO
        );

        supplier.setActive(true);

        return toResponse(
                supplierRepository.save(supplier)
        );
    }

    public SupplierResponse updateSupplier(
            UUID id,
            SupplierUpdateRequest request
    ) {
        SupplierEntity supplier =
                findActiveEntity(id);

        supplier.setLegalName(
                normalizeRequired(
                        request.legalName()
                )
        );

        supplier.setTradingName(
                normalizeOptional(
                        request.tradingName()
                )
        );

        supplier.setContactEmail(
                normalizeOptional(
                        request.contactEmail()
                )
        );

        supplier.setPhone(
                normalizeOptional(
                        request.phone()
                )
        );

        supplier.setWebsite(
                normalizeOptional(
                        request.website()
                )
        );

        supplier.setCountry(
                normalizeRequired(
                        request.country()
                )
        );

        supplier.setCity(
                normalizeOptional(
                        request.city()
                )
        );

        supplier.setCategory(
                normalizeRequired(
                        request.category()
                )
        );

        supplier.setStatus(
                request.status()
        );

        supplier.setRiskLevel(
                request.riskLevel()
        );

        supplier.setRating(
                request.rating()
        );

        supplier.setOnTimeDeliveryRate(
                request.onTimeDeliveryRate()
        );

        return toResponse(
                supplierRepository.save(supplier)
        );
    }

    public void archiveSupplier(UUID id) {
        SupplierEntity supplier =
                findActiveEntity(id);

        supplier.setActive(false);
        supplier.setStatus(
                SupplierStatus.INACTIVE
        );

        supplierRepository.save(supplier);
    }

    @Transactional(readOnly = true)
    public SupplierSummaryResponse getSummary() {
        List<SupplierEntity> suppliers =
                supplierRepository
                        .findAllByActiveTrueOrderByLegalNameAsc();

        long total = suppliers.size();

        long active =
                suppliers.stream()
                        .filter(
                                supplier ->
                                        supplier.getStatus()
                                                == SupplierStatus.ACTIVE
                        )
                        .count();

        long onboarding =
                suppliers.stream()
                        .filter(
                                supplier ->
                                        supplier.getStatus()
                                                == SupplierStatus.ONBOARDING
                        )
                        .count();

        long highRisk =
                suppliers.stream()
                        .filter(
                                supplier ->
                                        supplier.getRiskLevel()
                                                == SupplierRiskLevel.HIGH
                                                ||
                                                supplier.getRiskLevel()
                                                        == SupplierRiskLevel.CRITICAL
                        )
                        .count();

        BigDecimal totalSpend =
                suppliers.stream()
                        .map(
                                SupplierEntity::getTotalSpend
                        )
                        .filter(
                                value -> value != null
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal averageRating =
                average(
                        suppliers.stream()
                                .map(
                                        SupplierEntity::getRating
                                )
                                .filter(
                                        value -> value != null
                                )
                                .toList()
                );

        BigDecimal averageDelivery =
                average(
                        suppliers.stream()
                                .map(
                                        SupplierEntity::
                                                getOnTimeDeliveryRate
                                )
                                .filter(
                                        value -> value != null
                                )
                                .toList()
                );

        return new SupplierSummaryResponse(
                total,
                active,
                onboarding,
                highRisk,
                averageRating,
                totalSpend,
                averageDelivery
        );
    }

    private SupplierEntity findActiveEntity(
            UUID id
    ) {
        return supplierRepository
                .findByIdAndActiveTrue(id)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Supplier not found: "
                                                + id
                                )
                );
    }

    private SupplierResponse toResponse(
            SupplierEntity supplier
    ) {
        return new SupplierResponse(
                supplier.getId(),
                supplier.getSupplierCode(),
                supplier.getLegalName(),
                supplier.getTradingName(),
                supplier.getContactEmail(),
                supplier.getPhone(),
                supplier.getWebsite(),
                supplier.getCountry(),
                supplier.getCity(),
                supplier.getCategory(),
                supplier.getStatus(),
                supplier.getRiskLevel(),
                supplier.getRating(),
                supplier.getOnTimeDeliveryRate(),
                supplier.getTotalSpend(),
                supplier.getCreatedAt(),
                supplier.getUpdatedAt()
        );
    }

    private BigDecimal average(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal sum =
                values.stream()
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return sum.divide(
                BigDecimal.valueOf(
                        values.size()
                ),
                2,
                RoundingMode.HALF_UP
        );
    }

    private String normalizeRequired(
            String value
    ) {
        return value.trim();
    }

    private String normalizeOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized = value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }
}
