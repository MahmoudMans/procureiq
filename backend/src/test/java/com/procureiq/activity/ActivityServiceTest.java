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
import static org.mockito.Mockito.when;

class ActivityServiceTest {

    private ActivityRepository
            activityRepository;

    private AppUserRepository
            appUserRepository;

    private ActivityService
            activityService;

    private UUID userId;

    @BeforeEach
    void setUp() {
        activityRepository =
                mock(
                        ActivityRepository.class
                );

        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        activityService =
                new ActivityService(
                        activityRepository,
                        appUserRepository
                );

        userId =
                UUID.randomUUID();
    }

    @Test
    void managerShouldReceiveGlobalActivityTimeline() {
        AppUserEntity user =
                mock(
                        AppUserEntity.class
                );

        UUID entityId =
                UUID.randomUUID();

        when(
                user.isActive()
        ).thenReturn(true);

        when(
                user.getRole()
        ).thenReturn(
                ProcurementRole.PROCUREMENT_MANAGER
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        when(
                activityRepository
                        .findRecent(
                                userId,
                                true,
                                100
                        )
        ).thenReturn(
                List.of(
                        new ActivityRepository.ActivityRow(
                                1L,
                                "PURCHASE_ORDER",
                                entityId,
                                "UPDATED",
                                "ISSUED",
                                userId,
                                "Daniel Moreau",
                                Instant.parse(
                                        "2026-09-14T10:00:00Z"
                                )
                        )
                )
        );

        List<ActivityEventResponse> response =
                activityService
                        .findRecent(
                                userId,
                                100
                        );

        assertEquals(
                1,
                response.size()
        );

        assertEquals(
                "Purchase order updated — status issued.",
                response.getFirst()
                        .summary()
        );
    }

    @Test
    void requesterShouldReceiveOwnActivityOnly() {
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
                ProcurementRole.REQUESTER
        );

        when(
                appUserRepository
                        .findById(userId)
        ).thenReturn(
                Optional.of(user)
        );

        when(
                activityRepository
                        .findRecent(
                                userId,
                                false,
                                25
                        )
        ).thenReturn(
                List.of()
        );

        assertEquals(
                0,
                activityService
                        .findRecent(
                                userId,
                                25
                        )
                        .size()
        );
    }
}
