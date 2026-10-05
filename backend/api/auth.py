from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.core.weak_auth import (
    AuthError,
    current_user_from_authorization,
    login_user,
    register_user,
)
from backend.storage.sqlite import SQLiteRepository

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    confirm_password: str


class LoginRequest(BaseModel):
    email: str
    password: str


def error_envelope(exc: AuthError) -> dict[str, object]:
    error: dict[str, object] = {"code": exc.code, "message": exc.message}
    if exc.fields:
        error["fields"] = exc.fields
    return {"error": error}


async def auth_error_handler(_request: Request, exc: AuthError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=error_envelope(exc))


def get_auth_repository() -> SQLiteRepository:
    return SQLiteRepository.from_path()


def require_current_user(
    authorization: Annotated[str | None, Header()] = None,
    repo: SQLiteRepository = Depends(get_auth_repository),
) -> dict[str, object]:
    return current_user_from_authorization(repo, authorization)


@router.post("/register")
def register(
    request: RegisterRequest,
    repo: SQLiteRepository = Depends(get_auth_repository),
) -> dict[str, str]:
    return register_user(
        repo,
        email=request.email,
        password=request.password,
        confirm_password=request.confirm_password,
    )


@router.post("/login")
def login(
    request: LoginRequest,
    repo: SQLiteRepository = Depends(get_auth_repository),
) -> dict[str, str]:
    return login_user(repo, email=request.email, password=request.password)


@router.get("/me")
def me(current_user: dict[str, object] = Depends(require_current_user)) -> dict[str, object]:
    return {"email": current_user["email"], "role": current_user["role"]}
