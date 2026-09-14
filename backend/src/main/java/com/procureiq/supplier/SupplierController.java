package com.procureiq.supplier;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/v1/suppliers")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(
            SupplierService supplierService
    ) {
        this.supplierService =
                supplierService;
    }

    @GetMapping
    public List<SupplierResponse>
    findSuppliers(
            @RequestParam(required = false)
            String query,

            @RequestParam(required = false)
            SupplierStatus status,

            @RequestParam(required = false)
            SupplierRiskLevel riskLevel
    ) {
        return supplierService
                .findSuppliers(
                        query,
                        status,
                        riskLevel
                );
    }

    @GetMapping("/summary")
    public SupplierSummaryResponse
    getSummary() {
        return supplierService
                .getSummary();
    }

    @GetMapping("/{id}")
    public SupplierResponse
    findSupplier(
            @PathVariable
            UUID id
    ) {
        return supplierService
                .findSupplier(id);
    }

    @PostMapping
    @ResponseStatus(
            HttpStatus.CREATED
    )
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierResponse
    createSupplier(
            @Valid
            @RequestBody
            SupplierCreateRequest request
    ) {
        return supplierService
                .createSupplier(
                        request
                );
    }

    @PutMapping("/{id}")
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER','BUYER')"
    )
    public SupplierResponse
    updateSupplier(
            @PathVariable
            UUID id,

            @Valid
            @RequestBody
            SupplierUpdateRequest request
    ) {
        return supplierService
                .updateSupplier(
                        id,
                        request
                );
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(
            HttpStatus.NO_CONTENT
    )
    @PreAuthorize(
            "hasAnyRole('ADMIN','PROCUREMENT_MANAGER')"
    )
    public void archiveSupplier(
            @PathVariable
            UUID id
    ) {
        supplierService
                .archiveSupplier(id);
    }
}
