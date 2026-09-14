package com.procureiq.activity;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class NotificationService {

    private final NotificationRepository
            notificationRepository;

    private final AppUserRepository
            appUserRepository;

    public NotificationService(
            NotificationRepository notificationRepository,
            AppUserRepository appUserRepository
    ) {
        this.notificationRepository =
                notificationRepository;

        this.appUserRepository =
                appUserRepository;
    }

    public List<NotificationResponse> find(
            UUID currentUserId,
            boolean unreadOnly
    ) {
        AppUserEntity user =
                findUser(
                        currentUserId
                );

        notificationRepository
                .refreshForUser(
                        currentUserId,
                        user.getRole()
                );

        return notificationRepository
                .findForUser(
                        currentUserId,
                        unreadOnly
                )
                .stream()
                .map(
                        row ->
                                new NotificationResponse(
                                        row.id(),
                                        row.notificationType(),
                                        row.severity(),
                                        row.title(),
                                        row.message(),
                                        row.entityType(),
                                        row.entityId(),
                                        row.href(),
                                        row.readAt() != null,
                                        row.readAt(),
                                        row.createdAt()
                                )
                )
                .toList();
    }

    public UnreadNotificationCountResponse
    unreadCount(
            UUID currentUserId
    ) {
        AppUserEntity user =
                findUser(
                        currentUserId
                );

        notificationRepository
                .refreshForUser(
                        currentUserId,
                        user.getRole()
                );

        return new UnreadNotificationCountResponse(
                notificationRepository
                        .unreadCount(
                                currentUserId
                        )
        );
    }

    public void markRead(
            UUID currentUserId,
            long notificationId
    ) {
        findUser(
                currentUserId
        );

        notificationRepository
                .markRead(
                        currentUserId,
                        notificationId
                );
    }

    public void markAllRead(
            UUID currentUserId
    ) {
        findUser(
                currentUserId
        );

        notificationRepository
                .markAllRead(
                        currentUserId
                );
    }

    private AppUserEntity findUser(
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
}
