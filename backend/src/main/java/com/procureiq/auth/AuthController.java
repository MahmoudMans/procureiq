package com.procureiq.auth;

import com.procureiq.user.UserResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthenticationService authenticationService;

    public AuthController(
            AuthenticationService authenticationService
    ) {
        this.authenticationService =
                authenticationService;
    }

    @PostMapping("/login")
    public AuthLoginResponse login(
            @Valid
            @RequestBody
            AuthLoginRequest request
    ) {
        return authenticationService.login(request);
    }

    @GetMapping("/me")
    public UserResponse currentUser(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return authenticationService
                .findCurrentUser(
                        jwt.getSubject()
                );
    }
}
