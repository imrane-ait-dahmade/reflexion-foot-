"""Shared application exceptions.

Domain modules may define more specific errors. HTTP mapping belongs in presentation.
"""


class AppError(Exception):
    """Base error for expected application failures."""

    def __init__(self, message: str, *, code: str = "app_error") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, code="not_found")


class ValidationError(AppError):
    def __init__(self, message: str = "Validation failed") -> None:
        super().__init__(message, code="validation_error")
