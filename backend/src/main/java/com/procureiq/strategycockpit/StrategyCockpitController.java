package com.procureiq.strategycockpit;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/strategy-cockpit")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class StrategyCockpitController {

    private final StrategyCockpitService service;

    public StrategyCockpitController(
            StrategyCockpitService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public StrategyCockpitDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear
        );
    }

    @PostMapping("/snapshots")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public BoardSnapshotDetailResponse captureSnapshot(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency,

            @RequestParam(
                    required = false
            )
            Integer fiscalYear,

            @Valid
            @RequestBody(
                    required = false
            )
            BoardScorecardCaptureInput input
    ) {
        return service.captureSnapshot(
                currentUserId(
                        jwt
                ),
                currency,
                fiscalYear == null
                        ? Year.now()
                                .getValue()
                        : fiscalYear,
                input == null
                        ? new BoardScorecardCaptureInput(
                                null
                        )
                        : input
        );
    }

    @GetMapping("/snapshots/{snapshotId}")
    public BoardSnapshotDetailResponse snapshot(
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
