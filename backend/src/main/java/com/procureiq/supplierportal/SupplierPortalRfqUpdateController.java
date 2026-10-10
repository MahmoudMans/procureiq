package com.procureiq.supplierportal;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Recent RFQ outcomes for the signed-in supplier. Access is decided by the portal session
 * token, like the rest of /api/v1/supplier-portal.
 */
@RestController
@RequestMapping("/api/v1/supplier-portal/rfq-updates")
public class SupplierPortalRfqUpdateController {

    private final SupplierPortalRfqUpdateService service;

    public SupplierPortalRfqUpdateController(
            SupplierPortalRfqUpdateService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<SupplierPortalRfqUpdateResponse> updates(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization
    ) {
        return service.updates(
                bearerToken(
                        authorization
                )
        );
    }

    private String bearerToken(
            String authorization
    ) {
        if (
                authorization == null
                ||
                !authorization.startsWith(
                        "Bearer "
                )
        ) {
            throw new IllegalArgumentException(
                    "Supplier portal bearer token is required."
            );
        }

        String token =
                authorization
                        .substring(
                                7
                        )
                        .trim();

        if (token.isEmpty()) {
            throw new IllegalArgumentException(
                    "Supplier portal bearer token is required."
            );
        }

        return token;
    }
}
