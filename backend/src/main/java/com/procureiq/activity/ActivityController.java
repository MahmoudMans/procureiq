package com.procureiq.activity;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','REQUESTER','APPROVER')"
)
public class ActivityController {

    private final ActivityService
            activityService;

    private final NotificationService
            notificationService;

    public ActivityController(
            ActivityService activityService,
            NotificationService notificationService
    ) {
        this.activityService =
                activityService;

        this.notificationService =
                notificationService;
    }

    @GetMapping("/activity")
    public List<ActivityEventResponse> activity(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "100"
            )
            int limit
    ) {
        return activityService
                .findRecent(
                        currentUserId(jwt),
                        limit
                );
    }

    @GetMapping("/notifications")
    public List<NotificationResponse> notifications(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "false"
            )
            boolean unreadOnly
    ) {
        return notificationService
                .find(
                        currentUserId(jwt),
                        unreadOnly
                );
    }

    @GetMapping(
            "/notifications/unread-count"
    )
    public UnreadNotificationCountResponse
    unreadCount(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return notificationService
                .unreadCount(
                        currentUserId(jwt)
                );
    }

    @PostMapping(
            "/notifications/{notificationId}/read"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void markRead(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            long notificationId
    ) {
        notificationService
                .markRead(
                        currentUserId(jwt),
                        notificationId
                );
    }

    @PostMapping(
            "/notifications/read-all"
    )
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    public void markAllRead(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        notificationService
                .markAllRead(
                        currentUserId(jwt)
                );
    }

    private UUID currentUserId(
            Jwt jwt
    ) {
        try {
            return UUID.fromString(
                    jwt.getSubject()
            );
        } catch (
                IllegalArgumentException exception
        ) {
            throw new IllegalArgumentException(
                    "Invalid authenticated ProcureIQ identity."
            );
        }
    }
}
