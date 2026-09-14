package com.procureiq.supplier;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "suppliers")
public class SupplierEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(
            name = "supplier_code",
            nullable = false,
            unique = true,
            length = 20
    )
    private String supplierCode;

    @Column(
            name = "legal_name",
            nullable = false,
            length = 160
    )
    private String legalName;

    @Column(name = "trading_name", length = 160)
    private String tradingName;

    @Column(name = "contact_email", length = 200)
    private String contactEmail;

    @Column(name = "phone", length = 50)
    private String phone;

    @Column(name = "website", length = 300)
    private String website;

    @Column(
            name = "country",
            nullable = false,
            length = 100
    )
    private String country;

    @Column(name = "city", length = 100)
    private String city;

    @Column(
            name = "category",
            nullable = false,
            length = 120
    )
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private SupplierStatus status;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "risk_level",
            nullable = false,
            length = 30
    )
    private SupplierRiskLevel riskLevel;

    @Column(
            name = "rating",
            precision = 3,
            scale = 2
    )
    private BigDecimal rating;

    @Column(
            name = "on_time_delivery_rate",
            precision = 5,
            scale = 2
    )
    private BigDecimal onTimeDeliveryRate;

    @Column(
            name = "total_spend",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal totalSpend;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (status == null) {
            status = SupplierStatus.ACTIVE;
        }

        if (riskLevel == null) {
            riskLevel = SupplierRiskLevel.LOW;
        }

        if (totalSpend == null) {
            totalSpend = BigDecimal.ZERO;
        }

        active = true;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getSupplierCode() {
        return supplierCode;
    }

    public void setSupplierCode(String supplierCode) {
        this.supplierCode = supplierCode;
    }

    public String getLegalName() {
        return legalName;
    }

    public void setLegalName(String legalName) {
        this.legalName = legalName;
    }

    public String getTradingName() {
        return tradingName;
    }

    public void setTradingName(String tradingName) {
        this.tradingName = tradingName;
    }

    public String getContactEmail() {
        return contactEmail;
    }

    public void setContactEmail(String contactEmail) {
        this.contactEmail = contactEmail;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getWebsite() {
        return website;
    }

    public void setWebsite(String website) {
        this.website = website;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public SupplierStatus getStatus() {
        return status;
    }

    public void setStatus(SupplierStatus status) {
        this.status = status;
    }

    public SupplierRiskLevel getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(
            SupplierRiskLevel riskLevel
    ) {
        this.riskLevel = riskLevel;
    }

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public BigDecimal getOnTimeDeliveryRate() {
        return onTimeDeliveryRate;
    }

    public void setOnTimeDeliveryRate(
            BigDecimal onTimeDeliveryRate
    ) {
        this.onTimeDeliveryRate =
                onTimeDeliveryRate;
    }

    public BigDecimal getTotalSpend() {
        return totalSpend;
    }

    public void setTotalSpend(
            BigDecimal totalSpend
    ) {
        this.totalSpend = totalSpend;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
