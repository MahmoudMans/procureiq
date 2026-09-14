package com.procureiq.supplier;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SupplierServiceTest {

    private SupplierRepository supplierRepository;
    private SupplierService supplierService;

    @BeforeEach
    void setUp() {
        supplierRepository =
                mock(SupplierRepository.class);

        supplierService =
                new SupplierService(
                        supplierRepository
                );
    }

    @Test
    void createSupplierShouldPersistNormalizedSupplier() {

        SupplierCreateRequest request =
                new SupplierCreateRequest(
                        " sup-9000 ",
                        " Example Industrial SAS ",
                        " Example ",
                        "procurement@example.test",
                        "+33 1 00 00 00 00",
                        "https://example.test",
                        " France ",
                        " Paris ",
                        " Industrial Components ",
                        null,
                        null,
                        new BigDecimal("4.50"),
                        new BigDecimal("95.00")
                );

        when(
                supplierRepository
                        .existsBySupplierCodeIgnoreCase(
                                "sup-9000"
                        )
        ).thenReturn(false);

        when(
                supplierRepository.save(
                        any(SupplierEntity.class)
                )
        ).thenAnswer(
                invocation ->
                        invocation.getArgument(0)
        );

        SupplierResponse response =
                supplierService
                        .createSupplier(request);

        assertEquals(
                "SUP-9000",
                response.supplierCode()
        );

        assertEquals(
                "Example Industrial SAS",
                response.legalName()
        );

        assertEquals(
                "France",
                response.country()
        );

        assertEquals(
                SupplierStatus.ACTIVE,
                response.status()
        );

        assertEquals(
                SupplierRiskLevel.LOW,
                response.riskLevel()
        );

        assertEquals(
                BigDecimal.ZERO,
                response.totalSpend()
        );

        verify(
                supplierRepository
        ).save(
                any(SupplierEntity.class)
        );
    }

    @Test
    void createSupplierShouldRejectDuplicateCode() {

        SupplierCreateRequest request =
                new SupplierCreateRequest(
                        "SUP-0001",
                        "Duplicate Supplier",
                        null,
                        null,
                        null,
                        null,
                        "France",
                        null,
                        "Technology",
                        SupplierStatus.ACTIVE,
                        SupplierRiskLevel.LOW,
                        null,
                        null
                );

        when(
                supplierRepository
                        .existsBySupplierCodeIgnoreCase(
                                "SUP-0001"
                        )
        ).thenReturn(true);

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () ->
                                supplierService
                                        .createSupplier(
                                                request
                                        )
                );

        assertEquals(
                "Supplier code already exists: SUP-0001",
                exception.getMessage()
        );
    }
}
