package com.procureiq.activity;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ActivityService {

    private final ActivityRepository
            activityRepository;

    private final AppUserRepository
            appUserRepository;

    public ActivityService(
            ActivityRepository activityRepository,
            AppUserRepository appUserRepository
    ) {
        this.activityRepository =
                activityRepository;

        this.appUserRepository =
                appUserRepository;
    }

    public List<ActivityEventResponse> findRecent(
            UUID currentUserId,
            int requestedLimit
    ) {
        AppUserEntity user =
                findUser(
                        currentUserId
                );

        int limit =
                Math.max(
                        1,
                        Math.min(
                                requestedLimit,
                                200
                        )
                );

        boolean privileged =
                user.getRole()
                        != ProcurementRole.REQUESTER;

        return activityRepository
                .findRecent(
                        currentUserId,
                        privileged,
                        limit
                )
                .stream()
                .map(
                        this::toResponse
                )
                .toList();
    }

    private ActivityEventResponse toResponse(
            ActivityRepository.ActivityRow row
    ) {
        return new ActivityEventResponse(
                row.id(),
                row.entityType(),
                row.entityId(),
                row.action(),
                row.status(),
                row.actorUserId(),
                row.actorName(),
                summary(row),
                href(
                        row.entityType(),
                        row.entityId()
                ),
                row.occurredAt()
        );
    }

    private String summary(
            ActivityRepository.ActivityRow row
    ) {
        String entity =
                switch (
                        row.entityType()
                ) {
                    case "PURCHASE_REQUEST" ->
                            "Purchase request";

                    case "APPROVAL" ->
                            "Approval task";

                    case "RFQ" ->
                            "RFQ";

                    case "QUOTATION" ->
                            "Supplier quotation";

                    case "AWARD_DECISION" ->
                            "Award decision";

                    case "PURCHASE_ORDER" ->
                            "Purchase order";

                    case "GOODS_RECEIPT" ->
                            "Goods receipt";

                    default ->
                            row.entityType()
                                    .replace(
                                            '_',
                                            ' '
                                    );
                };

        String action =
                row.action()
                        .toLowerCase();

        if (
                row.status() == null
                ||
                row.status().isBlank()
        ) {
            return entity
                    + " "
                    + action
                    + ".";
        }

        return entity
                + " "
                + action
                + " — status "
                + row.status()
                        .replace(
                                '_',
                                ' '
                        )
                        .toLowerCase()
                + ".";
    }

    private String href(
            String entityType,
            UUID entityId
    ) {
        return switch (entityType) {
            case "PURCHASE_REQUEST" ->
                    "/purchase-requests/"
                            + entityId;

            case "APPROVAL" ->
                    "/approvals";

            case "RFQ",
                 "QUOTATION",
                 "AWARD_DECISION" ->
                    "/rfqs";

            case "PURCHASE_ORDER",
                 "GOODS_RECEIPT" ->
                    "/purchase-orders";

            default ->
                    null;
        };
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
