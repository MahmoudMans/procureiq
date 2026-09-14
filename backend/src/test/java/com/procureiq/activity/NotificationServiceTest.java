package com.procureiq.activity;

import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceTest {

    private NotificationRepository
            notificationRepository;

    private AppUserRepository
            appUserRepository;

    private NotificationService
            notificationService;

    private UUID userId;

    @BeforeEach
    void setUp() {
        notificationRepository =
                mock(
                        NotificationRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        notificationService =
                new NotificationService(
                        notificationRepository,
                        appUserRepository
                );

        userId =
                UUID.randomUUID();
    }

    @Test
    void notificationsShouldRefreshActionableAlerts() {
        AppUserEntity user =
                mock(
                        AppUserEntity.class
                );

        when(
                user.isActive()
        ).thenReturn(true);

        when(
                user.getRole()
        ).thenReturn(
                ProcurementRole.BUYER
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        when(
                notificationRepository
                        .findForUser(
                                userId,
                                false
                        )
        ).thenReturn(
                List.of(
                        new NotificationRepository.NotificationRow(
                                10L,
                                "OVERDUE_DELIVERY",
                                "HIGH",
                                "Delivery overdue",
                                "Purchase order is overdue.",
                                "PURCHASE_ORDER",
                                UUID.randomUUID(),
                                "/purchase-orders/1",
                                null,
                                Instant.parse(
                                        "2026-09-14T10:00:00Z"
                                )
                        )
                )
        );

        List<NotificationResponse> response =
                notificationService
                        .find(
                                userId,
                                false
                        );

        verify(
                notificationRepository
        ).refreshForUser(
                userId,
                ProcurementRole.BUYER
        );

        assertEquals(
                1,
                response.size()
        );

        assertEquals(
                false,
                response.getFirst()
                        .read()
        );
    }

    @Test
    void markAllReadShouldDelegateToRepository() {
        AppUserEntity user =
                mock(
                        AppUserEntity.class
                );

        when(
                user.isActive()
        ).thenReturn(true);

        when(
                user.getRole()
        ).thenReturn(
                ProcurementRole.ADMIN
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        notificationService
                .markAllRead(
                        userId
                );

        verify(
                notificationRepository
        ).markAllRead(
                userId
        );
    }
}
