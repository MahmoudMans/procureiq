package com.procureiq.supplierportal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupplierPortalSecurityServiceTest {

    private SupplierPortalSecurityService service;

    @BeforeEach
    void setUp() {
        service =
                new SupplierPortalSecurityService();
    }

    @Test
    void shouldHashTokenDeterministicallyWithoutPersistingRawSecret() {
        String token =
                "supplier-portal-token";

        String first =
                service.hashToken(
                        token
                );

        String second =
                service.hashToken(
                        token
                );

        assertEquals(
                first,
                second
        );

        assertNotEquals(
                token,
                first
        );

        assertEquals(
                64,
                first.length()
        );
    }

    @Test
    void shouldGenerateDistinctOpaqueTokens() {
        String first =
                service.newOpaqueToken();

        String second =
                service.newOpaqueToken();

        assertNotEquals(
                first,
                second
        );
    }

    @Test
    void shouldHashAndVerifyPasswords() {
        String password =
                "ProcureIQ-Supplier-2026!";

        String hash =
                service.hashPassword(
                        password
                );

        assertTrue(
                service.matchesPassword(
                        password,
                        hash
                )
        );

        assertFalse(
                service.matchesPassword(
                        "wrong-password",
                        hash
                )
        );
    }
}
