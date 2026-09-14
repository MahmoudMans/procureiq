package com.procureiq.security;

import com.procureiq.organization.DepartmentEntity;
import com.procureiq.organization.DepartmentRepository;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SecurityDataInitializer
        implements ApplicationRunner {

    private final AppUserRepository appUserRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final String demoPassword;

    public SecurityDataInitializer(
            AppUserRepository appUserRepository,
            DepartmentRepository departmentRepository,
            PasswordEncoder passwordEncoder,
            @Value(
                    "${app.security.demo-password}"
            )
            String demoPassword
    ) {
        this.appUserRepository =
                appUserRepository;

        this.departmentRepository =
                departmentRepository;

        this.passwordEncoder =
                passwordEncoder;

        this.demoPassword =
                demoPassword;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args
    ) {
        ensureUser(
                "ProcureIQ Administrator",
                "admin@procureiq.local",
                ProcurementRole.ADMIN,
                "Platform Administrator",
                "PROC-EX"
        );

        ensureUser(
                "Sarah Mitchell",
                "manager@procureiq.local",
                ProcurementRole.PROCUREMENT_MANAGER,
                "Procurement Manager",
                "SOURCING"
        );

        ensureUser(
                "Daniel Moreau",
                "buyer@procureiq.local",
                ProcurementRole.BUYER,
                "Strategic Buyer",
                "SOURCING"
        );

        ensureUser(
                "Emma Laurent",
                "requester@procureiq.local",
                ProcurementRole.REQUESTER,
                "Operations Requester",
                "OPS"
        );

        ensureUser(
                "Victor Bernard",
                "approver@procureiq.local",
                ProcurementRole.APPROVER,
                "Finance Approver",
                "FIN"
        );
    }

    private void ensureUser(
            String fullName,
            String email,
            ProcurementRole role,
            String jobTitle,
            String departmentCode
    ) {
        if (
                appUserRepository
                        .existsByEmailIgnoreCase(
                                email
                        )
        ) {
            return;
        }

        DepartmentEntity department =
                departmentRepository
                        .findByCode(
                                departmentCode
                        )
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "Required department not found: "
                                                        + departmentCode
                                        )
                        );

        AppUserEntity user =
                new AppUserEntity();

        user.setFullName(fullName);
        user.setEmail(email);
        user.setRole(role);
        user.setJobTitle(jobTitle);
        user.setDepartment(department);
        user.setActive(true);

        user.setPasswordHash(
                passwordEncoder.encode(
                        demoPassword
                )
        );

        appUserRepository.save(user);
    }
}
