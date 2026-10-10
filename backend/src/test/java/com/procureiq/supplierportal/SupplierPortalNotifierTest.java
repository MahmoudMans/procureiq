package com.procureiq.supplierportal;

import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.when;

class SupplierPortalNotifierTest {

    private JdbcTemplate jdbcTemplate;

    private AppUserRepository appUserRepository;

    private SupplierPortalNotifier notifier;

    private UUID rfqId;

    @BeforeEach
    void setUp() {
        jdbcTemplate =
                mock(
                        JdbcTemplate.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        notifier =
                new SupplierPortalNotifier(
                        jdbcTemplate,
                        appUserRepository
                );

        rfqId =
                UUID.randomUUID();
    }

    private AppUserEntity user(
            UUID id,
            ProcurementRole role,
            boolean active
    ) {
        AppUserEntity user =
                mock(
                        AppUserEntity.class
                );

        when(
                user.getId()
        ).thenReturn(
                id
        );

        when(
                user.getRole()
        ).thenReturn(
                role
        );

        when(
                user.isActive()
        ).thenReturn(
                active
        );

        return user;
    }

    /**
     * Stubs the user lookup. The users must be fully built before this is called: Mockito does
     * not allow a mock to be stubbed while another stubbing is still in progress.
     */
    private void givenUsers(
            List<AppUserEntity> users
    ) {
        when(
                appUserRepository.findAllByOrderByFullNameAsc()
        ).thenReturn(
                users
        );
    }

    /** The user_id passed to each INSERT, in order. */
    private List<UUID> recipients() {
        return mockingDetails(
                jdbcTemplate
        )
                .getInvocations()
                .stream()
                .filter(
                        invocation ->
                                invocation.getMethod()
                                        .getName()
                                        .equals(
                                                "update"
                                        )
                )
                .map(
                        invocation ->
                                (UUID) invocation.getArguments()[1]
                )
                .toList();
    }

    private void send(
            UUID owner
    ) {
        notifier.notifyRfqTeam(
                owner,
                rfqId,
                "SUPPLIER_QUOTATION_SUBMITTED",
                "INFO",
                "Supplier quotation received",
                "A supplier submitted a quotation."
        );
    }

    @Test
    void notifiesTheOwnerAndActiveManagersOnly() {
        UUID owner =
                UUID.randomUUID();

        UUID activeManager =
                UUID.randomUUID();

        AppUserEntity ownerUser =
                user(
                        owner,
                        ProcurementRole.BUYER,
                        true
                );

        AppUserEntity activeManagerUser =
                user(
                        activeManager,
                        ProcurementRole.PROCUREMENT_MANAGER,
                        true
                );

        AppUserEntity inactiveManagerUser =
                user(
                        UUID.randomUUID(),
                        ProcurementRole.PROCUREMENT_MANAGER,
                        false
                );

        AppUserEntity otherBuyerUser =
                user(
                        UUID.randomUUID(),
                        ProcurementRole.BUYER,
                        true
                );

        AppUserEntity requesterUser =
                user(
                        UUID.randomUUID(),
                        ProcurementRole.REQUESTER,
                        true
                );

        givenUsers(
                List.of(
                        ownerUser,
                        activeManagerUser,
                        inactiveManagerUser,
                        otherBuyerUser,
                        requesterUser
                )
        );

        send(
                owner
        );

        assertEquals(
                Set.of(
                        owner,
                        activeManager
                ),
                Set.copyOf(
                        recipients()
                )
        );

        assertEquals(
                2,
                recipients().size()
        );
    }

    @Test
    void anOwnerWhoIsAlsoAManagerIsNotifiedOnce() {
        UUID owner =
                UUID.randomUUID();

        AppUserEntity ownerAsManager =
                user(
                        owner,
                        ProcurementRole.PROCUREMENT_MANAGER,
                        true
                );

        givenUsers(
                List.of(
                        ownerAsManager
                )
        );

        send(
                owner
        );

        assertEquals(
                List.of(
                        owner
                ),
                recipients()
        );
    }

    @Test
    void stillNotifiesTheOwnerWhenTheTeamLookupFails() {
        UUID owner =
                UUID.randomUUID();

        when(
                appUserRepository.findAllByOrderByFullNameAsc()
        ).thenThrow(
                new RuntimeException(
                        "database unavailable"
                )
        );

        send(
                owner
        );

        assertEquals(
                List.of(
                        owner
                ),
                recipients()
        );
    }
}
