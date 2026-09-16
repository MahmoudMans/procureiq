package com.procureiq.flywheelsettlement;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/flywheel-settlement")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class FlywheelSettlementController {

    private final FlywheelSettlementService service;

    public FlywheelSettlementController(
            FlywheelSettlementService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public FlywheelSettlementDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                )
        );
    }

    @PostMapping("/cases")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelSettlementCaseDetailResponse createCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            FlywheelSettlementCaseInput input
    ) {
        return service.createCase(
                currentUserId(
                        jwt
                ),
                input
        );
    }

    @GetMapping("/cases/{caseId}")
    public FlywheelSettlementCaseDetailResponse settlementCase(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.settlementCase(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/cases/{caseId}/items")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelSettlementCaseDetailResponse addItem(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            FlywheelSettlementItemInput input
    ) {
        return service.addItem(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/ready-for-review")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public FlywheelSettlementCaseDetailResponse submitForReview(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.submitForReview(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @PostMapping("/cases/{caseId}/reconcile")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelSettlementCaseDetailResponse reconcile(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            FlywheelSettlementNoteInput input
    ) {
        return service.reconcile(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/close")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public FlywheelSettlementCaseDetailResponse close(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId,

            @Valid
            @RequestBody
            FlywheelSettlementNoteInput input
    ) {
        return service.close(
                currentUserId(
                        jwt
                ),
                caseId,
                input
        );
    }

    @PostMapping("/cases/{caseId}/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public FlywheelSettlementSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID caseId
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                caseId
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public FlywheelSettlementSnapshotDetailResponse snapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID snapshotId
    ) {
        return service.snapshot(
                currentUserId(
                        jwt
                ),
                snapshotId
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
