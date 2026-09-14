package com.procureiq.common.exception;

import com.procureiq.auth.AccountInactiveException;
import com.procureiq.auth.InvalidCredentialsException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(
            ResourceNotFoundException.class
    )
    public ResponseEntity<ProblemDetail>
    handleNotFound(
            ResourceNotFoundException exception
    ) {
        ProblemDetail problem =
                ProblemDetail
                        .forStatusAndDetail(
                                HttpStatus.NOT_FOUND,
                                exception.getMessage()
                        );

        problem.setTitle(
                "Resource not found"
        );

        problem.setType(
                URI.create(
                        "https://procureiq.local/problems/not-found"
                )
        );

        return ResponseEntity
                .status(
                        HttpStatus.NOT_FOUND
                )
                .body(problem);
    }

    @ExceptionHandler(
            InvalidCredentialsException.class
    )
    public ResponseEntity<ProblemDetail>
    handleInvalidCredentials(
            InvalidCredentialsException exception
    ) {
        ProblemDetail problem =
                ProblemDetail
                        .forStatusAndDetail(
                                HttpStatus.UNAUTHORIZED,
                                exception.getMessage()
                        );

        problem.setTitle(
                "Authentication failed"
        );

        problem.setType(
                URI.create(
                        "https://procureiq.local/problems/authentication"
                )
        );

        return ResponseEntity
                .status(
                        HttpStatus.UNAUTHORIZED
                )
                .body(problem);
    }

    @ExceptionHandler(
            AccountInactiveException.class
    )
    public ResponseEntity<ProblemDetail>
    handleInactiveAccount(
            AccountInactiveException exception
    ) {
        ProblemDetail problem =
                ProblemDetail
                        .forStatusAndDetail(
                                HttpStatus.FORBIDDEN,
                                exception.getMessage()
                        );

        problem.setTitle(
                "Account unavailable"
        );

        problem.setType(
                URI.create(
                        "https://procureiq.local/problems/account-inactive"
                )
        );

        return ResponseEntity
                .status(
                        HttpStatus.FORBIDDEN
                )
                .body(problem);
    }

    @ExceptionHandler(
            MethodArgumentNotValidException.class
    )
    public ResponseEntity<ProblemDetail>
    handleValidation(
            MethodArgumentNotValidException exception
    ) {
        Map<String, String> errors =
                new LinkedHashMap<>();

        exception.getBindingResult()
                .getFieldErrors()
                .forEach(
                        error ->
                                errors.putIfAbsent(
                                        error.getField(),
                                        error.getDefaultMessage()
                                )
                );

        ProblemDetail problem =
                ProblemDetail
                        .forStatusAndDetail(
                                HttpStatus.BAD_REQUEST,
                                "One or more request fields are invalid."
                        );

        problem.setTitle(
                "Validation failed"
        );

        problem.setType(
                URI.create(
                        "https://procureiq.local/problems/validation"
                )
        );

        problem.setProperty(
                "errors",
                errors
        );

        return ResponseEntity
                .badRequest()
                .body(problem);
    }

    @ExceptionHandler(
            IllegalArgumentException.class
    )
    public ResponseEntity<ProblemDetail>
    handleIllegalArgument(
            IllegalArgumentException exception
    ) {
        ProblemDetail problem =
                ProblemDetail
                        .forStatusAndDetail(
                                HttpStatus.BAD_REQUEST,
                                exception.getMessage()
                        );

        problem.setTitle(
                "Invalid request"
        );

        problem.setType(
                URI.create(
                        "https://procureiq.local/problems/invalid-request"
                )
        );

        return ResponseEntity
                .badRequest()
                .body(problem);
    }

    @ExceptionHandler(
            DataIntegrityViolationException.class
    )
    public ResponseEntity<ProblemDetail>
    handleConflict(
            DataIntegrityViolationException exception
    ) {
        ProblemDetail problem =
                ProblemDetail
                        .forStatusAndDetail(
                                HttpStatus.CONFLICT,
                                "The operation conflicts with existing ProcureIQ data."
                        );

        problem.setTitle(
                "Data conflict"
        );

        problem.setType(
                URI.create(
                        "https://procureiq.local/problems/conflict"
                )
        );

        return ResponseEntity
                .status(
                        HttpStatus.CONFLICT
                )
                .body(problem);
    }
}
