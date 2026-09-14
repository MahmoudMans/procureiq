package com.procureiq.commandcenter;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/command-center")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ProcurementCommandCenterController {

    private final ProcurementCommandCenterService service;

    public ProcurementCommandCenterController(
            ProcurementCommandCenterService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public CommandCenterResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            Integer daysAhead,

            @RequestParam(required = false)
            String currency
    ) {
        return service.dashboard(
                currentUserId(jwt),
                daysAhead,
                currency
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
