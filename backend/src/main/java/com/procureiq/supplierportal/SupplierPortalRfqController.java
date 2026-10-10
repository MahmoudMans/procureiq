package com.procureiq.supplierportal;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Supplier self-service on RFQs. Like the rest of /api/v1/supplier-portal, access is
 * decided by the portal session token, not by a staff JWT.
 */
@RestController
@RequestMapping("/api/v1/supplier-portal/rfqs")
public class SupplierPortalRfqController {

    private final SupplierPortalRfqService service;

    public SupplierPortalRfqController(
            SupplierPortalRfqService service
    ) {
        this.service =
                service;
    }

    @GetMapping
    public List<SupplierPortalRfqSummaryResponse> rfqs(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization
    ) {
        return service.rfqs(
                bearerToken(
                        authorization
                )
        );
    }

    @GetMapping("/{rfqId}")
    public SupplierPortalRfqDetailResponse rfq(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID rfqId
    ) {
        return service.rfq(
                bearerToken(
                        authorization
                ),
                rfqId
        );
    }

    @PutMapping("/{rfqId}/quotation")
    public SupplierPortalRfqDetailResponse saveQuotation(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID rfqId,

            @Valid
            @RequestBody
            SupplierPortalQuotationInput input
    ) {
        return service.saveQuotation(
                bearerToken(
                        authorization
                ),
                rfqId,
                input
        );
    }

    @PostMapping("/{rfqId}/quotation/submit")
    public SupplierPortalRfqDetailResponse submitQuotation(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID rfqId
    ) {
        return service.submitQuotation(
                bearerToken(
                        authorization
                ),
                rfqId
        );
    }

    @PostMapping("/{rfqId}/quotation/withdraw")
    public SupplierPortalRfqDetailResponse withdrawQuotation(
            @RequestHeader(
                    value = "Authorization",
                    required = false
            )
            String authorization,

            @PathVariable
            UUID rfqId
    ) {
        return service.withdrawQuotation(
                bearerToken(
                        authorization
                ),
                rfqId
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
