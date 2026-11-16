"""Identity & authentication HTTP endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError
from app.modules.identity.application import auth_service, user_service
from app.modules.identity.application.schemas import (
    ChangePasswordRequest,
    CreateStaffUserRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UpdateStaffUserRequest,
    UpdateUserRolesRequest,
    UpdateUserStatusRequest,
    UserResponse,
)
from app.modules.identity.presentation.deps import (
    AuthenticatedUser,
    client_meta,
    get_current_user,
    require_permissions,
)
from app.shared.infrastructure.database.session import get_db

auth_router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])


@auth_router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user_agent, ip_address = client_meta(request)
    return await auth_service.login(
        session,
        email=str(payload.email),
        password=payload.password,
        user_agent=user_agent,
        ip_address=ip_address,
    )


@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user_agent, ip_address = client_meta(request)
    return await auth_service.refresh_session(
        session,
        refresh_token=payload.refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
    )


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: LogoutRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(get_current_user),
) -> None:
    await auth_service.logout(
        session,
        refresh_token=payload.refresh_token,
        user_id=current.id,
        all_sessions=payload.all_sessions,
    )


@auth_router.get("/me", response_model=UserResponse)
async def me(
    current: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> UserResponse:
    return await user_service.get_staff_user(session, current.id)


@auth_router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(get_current_user),
) -> None:
    await auth_service.change_password(
        session,
        user_id=current.id,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )


@users_router.get("", response_model=list[UserResponse])
async def list_users(
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("users.manage")),
) -> list[UserResponse]:
    return await user_service.list_staff_users(session)


@users_router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: CreateStaffUserRequest,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("users.manage")),
) -> UserResponse:
    return await user_service.create_staff_user(session, payload)


@users_router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(get_current_user),
) -> UserResponse:
    if current.id != user_id and "users.manage" not in current.permissions:
        raise AuthorizationError("Insufficient permissions")
    return await user_service.get_staff_user(session, user_id)


@users_router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    payload: UpdateStaffUserRequest,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("users.manage")),
) -> UserResponse:
    return await user_service.update_staff_user(session, user_id, payload)


@users_router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: uuid.UUID,
    payload: UpdateUserStatusRequest,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("users.manage")),
) -> UserResponse:
    return await user_service.set_user_status(
        session,
        user_id,
        is_active=payload.is_active,
    )


@users_router.put("/{user_id}/roles", response_model=UserResponse)
async def update_user_roles(
    user_id: uuid.UUID,
    payload: UpdateUserRolesRequest,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("users.manage")),
) -> UserResponse:
    return await user_service.set_user_roles(session, user_id, payload.roles)
