package com.procureiq.auth;

import com.procureiq.security.JwtProperties;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthenticationServiceTest {

    private AppUserRepository appUserRepository;
    private PasswordEncoder passwordEncoder;
    private AuthenticationService authenticationService;

    @BeforeEach
    void setUp() {
        appUserRepository =
                mock(
                        AppUserRepository.class
                );

        passwordEncoder =
                mock(
                        PasswordEncoder.class
                );

        JwtEncoder jwtEncoder =
                mock(
                        JwtEncoder.class
                );

        JwtProperties jwtProperties =
                new JwtProperties(
                        "procureiq",
                        "procureiq-local-development-signing-key-for-tests",
                        480
                );

        authenticationService =
                new AuthenticationService(
                        appUserRepository,
                        passwordEncoder,
                        jwtEncoder,
                        jwtProperties
                );
    }

    @Test
    void loginShouldRejectUnknownEmail() {
        when(
                appUserRepository
                        .findByEmailIgnoreCase(
                                "missing@procureiq.local"
                        )
        ).thenReturn(
                Optional.empty()
        );

        InvalidCredentialsException exception =
                assertThrows(
                        InvalidCredentialsException.class,
                        () ->
                                authenticationService
                                        .login(
                                                new AuthLoginRequest(
                                                        "missing@procureiq.local",
                                                        "NotThePassword"
                                                )
                                        )
                );

        assertEquals(
                "Invalid email or password.",
                exception.getMessage()
        );
    }

    @Test
    void loginShouldRejectInvalidPassword() {
        AppUserEntity user =
                new AppUserEntity();

        user.setEmail(
                "buyer@procureiq.local"
        );

        user.setPasswordHash(
                "encoded-password"
        );

        user.setActive(true);

        when(
                appUserRepository
                        .findByEmailIgnoreCase(
                                "buyer@procureiq.local"
                        )
        ).thenReturn(
                Optional.of(user)
        );

        when(
                passwordEncoder.matches(
                        "wrong-password",
                        "encoded-password"
                )
        ).thenReturn(false);

        InvalidCredentialsException exception =
                assertThrows(
                        InvalidCredentialsException.class,
                        () ->
                                authenticationService
                                        .login(
                                                new AuthLoginRequest(
                                                        "buyer@procureiq.local",
                                                        "wrong-password"
                                                )
                                        )
                );

        assertEquals(
                "Invalid email or password.",
                exception.getMessage()
        );
    }

    @Test
    void loginShouldRejectInactiveAccount() {
        AppUserEntity user =
                new AppUserEntity();

        user.setEmail(
                "inactive@procureiq.local"
        );

        user.setPasswordHash(
                "encoded-password"
        );

        user.setActive(false);

        when(
                appUserRepository
                        .findByEmailIgnoreCase(
                                "inactive@procureiq.local"
                        )
        ).thenReturn(
                Optional.of(user)
        );

        AccountInactiveException exception =
                assertThrows(
                        AccountInactiveException.class,
                        () ->
                                authenticationService
                                        .login(
                                                new AuthLoginRequest(
                                                        "inactive@procureiq.local",
                                                        "ValidPassword1!"
                                                )
                                        )
                );

        assertEquals(
                "This ProcureIQ account is inactive.",
                exception.getMessage()
        );
    }
}
