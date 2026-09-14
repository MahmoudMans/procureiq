package com.procureiq.controltower;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/control-tower")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','APPROVER')"
)
public class ControlTowerController {

    private final ControlTowerService service;

    public ControlTowerController(
            ControlTowerService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public ControlTowerDashboardResponse dashboard(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.dashboard(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @PostMapping("/scan")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ControlTowerScanResponse scan(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(
                    defaultValue = "EUR"
            )
            String currency
    ) {
        return service.scan(
                currentUserId(
                        jwt
                ),
                currency
        );
    }

    @GetMapping("/context-options")
    public ControlTowerContextResponse contextOptions(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return service.contextOptions(
                currentUserId(
                        jwt
                )
        );
    }

    @GetMapping("/items/{itemId}")
    public ControlTowerItemResponse item(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId
    ) {
        return service.item(
                currentUserId(
                        jwt
                ),
                itemId
        );
    }

    @PutMapping("/items/{itemId}/owner")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ControlTowerItemResponse assignOwner(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            ControlTowerOwnerInput input
    ) {
        return service.assignOwner(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/acknowledge")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ControlTowerItemResponse acknowledge(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            ControlTowerNoteInput input
    ) {
        return service.acknowledge(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/start")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ControlTowerItemResponse start(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId
    ) {
        return service.start(
                currentUserId(
                        jwt
                ),
                itemId
        );
    }

    @PostMapping("/items/{itemId}/resolve")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ControlTowerItemResponse resolve(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            ControlTowerNoteInput input
    ) {
        return service.resolve(
                currentUserId(
                        jwt
                ),
                itemId,
                input
        );
    }

    @PostMapping("/items/{itemId}/dismiss")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ControlTowerItemResponse dismiss(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID itemId,

            @Valid
            @RequestBody
            ControlTowerNoteInput input
    ) {
        return service.dismiss(
                currentUserId(
                        jwt
                ),
                itemId,
                input
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
