package com.procureiq.contract;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize(
        "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER','REQUESTER','APPROVER')"
)
public class ContractComplianceController {

    private final ContractComplianceService
            contractComplianceService;

    public ContractComplianceController(
            ContractComplianceService contractComplianceService
    ) {
        this.contractComplianceService =
                contractComplianceService;
    }

    @GetMapping("/contracts")
    public List<ContractResponse> contracts(
            @AuthenticationPrincipal
            Jwt jwt,

            @RequestParam(required = false)
            String query,

            @RequestParam(required = false)
            ContractStatus status,

            @RequestParam(required = false)
            UUID supplierId
    ) {
        return contractComplianceService
                .findContracts(
                        currentUserId(jwt),
                        query,
                        status,
                        supplierId
                );
    }

    @GetMapping("/contracts/summary")
    public ContractSummaryResponse summary(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return contractComplianceService
                .summary(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/contracts/alerts")
    public List<ContractAlertResponse> alerts(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return contractComplianceService
                .alerts(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/contracts/suppliers")
    public List<ContractSupplierOptionResponse>
    suppliers(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return contractComplianceService
                .supplierOptions(
                        currentUserId(jwt)
                );
    }

    @GetMapping("/contracts/{contractId}")
    public ContractResponse contract(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID contractId
    ) {
        return contractComplianceService
                .findContract(
                        currentUserId(jwt),
                        contractId
                );
    }

    @PostMapping("/contracts")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ContractResponse createContract(
            @AuthenticationPrincipal
            Jwt jwt,

            @Valid
            @RequestBody
            ContractCreateInput input
    ) {
        return contractComplianceService
                .createContract(
                        currentUserId(jwt),
                        input
                );
    }

    @PutMapping("/contracts/{contractId}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ContractResponse updateContract(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID contractId,

            @Valid
            @RequestBody
            ContractUpdateInput input
    ) {
        return contractComplianceService
                .updateContract(
                        currentUserId(jwt),
                        contractId,
                        input
                );
    }

    @PostMapping(
            "/contracts/{contractId}/activate"
    )
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ContractResponse activateContract(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID contractId
    ) {
        return contractComplianceService
                .activateContract(
                        currentUserId(jwt),
                        contractId
                );
    }

    @PostMapping(
            "/contracts/{contractId}/terminate"
    )
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public ContractResponse terminateContract(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID contractId
    ) {
        return contractComplianceService
                .terminateContract(
                        currentUserId(jwt),
                        contractId
                );
    }

    @GetMapping(
            "/suppliers/{supplierId}/compliance"
    )
    public SupplierComplianceResponse
    supplierCompliance(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId
    ) {
        return contractComplianceService
                .supplierCompliance(
                        currentUserId(jwt),
                        supplierId
                );
    }

    @PostMapping(
            "/suppliers/{supplierId}/compliance-documents"
    )
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public ComplianceDocumentResponse
    createComplianceDocument(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID supplierId,

            @Valid
            @RequestBody
            ComplianceDocumentInput input
    ) {
        return contractComplianceService
                .createComplianceDocument(
                        currentUserId(jwt),
                        supplierId,
                        input
                );
    }

    @PutMapping(
            "/compliance-documents/{documentId}"
    )
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public ComplianceDocumentResponse
    updateComplianceDocument(
            @AuthenticationPrincipal
            Jwt jwt,

            @PathVariable
            UUID documentId,

            @Valid
            @RequestBody
            ComplianceDocumentInput input
    ) {
        return contractComplianceService
                .updateComplianceDocument(
                        currentUserId(jwt),
                        documentId,
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
