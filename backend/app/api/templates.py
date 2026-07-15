"""Private reusable watermark and border templates for authenticated users."""

from datetime import datetime
from typing import Any, Dict, List, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.operations import BorderParams, WatermarkStackParams
from app.core.database import get_db
from app.core.security import get_current_user_or_enforce
from app.models.user import User
from app.models.user_template import UserTemplate


router = APIRouter()
TemplateKind = Literal["border", "watermark"]


class TemplateWriteRequest(BaseModel):
    """A limited, validated payload; raw ImageMagick arguments are never stored."""

    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    kind: TemplateKind
    payload: Dict[str, Any]

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if not name:
            raise ValueError("Template name is required")
        return name

    def validated_payload(self) -> Dict[str, Any]:
        if self.kind == "border":
            return BorderParams.model_validate(self.payload).model_dump()
        return WatermarkStackParams.model_validate(self.payload).model_dump()


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    kind: TemplateKind
    payload: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


def require_template_owner(current_user: User | None) -> User:
    """Templates are account-private even when anonymous editing is enabled."""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to manage saved templates",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


async def get_owned_template(template_id: int, user: User, db: AsyncSession) -> UserTemplate:
    result = await db.execute(
        select(UserTemplate).where(
            UserTemplate.id == template_id,
            UserTemplate.user_id == user.id,
        )
    )
    template = result.scalar_one_or_none()
    if template is None:
        # Deliberately do not reveal another account's template identifiers.
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("", response_model=List[TemplateResponse], include_in_schema=False)
@router.get("/", response_model=List[TemplateResponse])
async def list_templates(
    kind: TemplateKind | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_or_enforce),
):
    user = require_template_owner(current_user)
    query = select(UserTemplate).where(UserTemplate.user_id == user.id)
    if kind:
        query = query.where(UserTemplate.kind == kind)
    result = await db.execute(query.order_by(UserTemplate.updated_at.desc(), UserTemplate.id.desc()))
    return result.scalars().all()


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    request: TemplateWriteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_or_enforce),
):
    user = require_template_owner(current_user)
    template = UserTemplate(
        user_id=user.id,
        name=request.name,
        kind=request.kind,
        payload=request.validated_payload(),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    request: TemplateWriteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_or_enforce),
):
    user = require_template_owner(current_user)
    template = await get_owned_template(template_id, user, db)
    template.name = request.name
    template.kind = request.kind
    template.payload = request.validated_payload()
    template.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user_or_enforce),
):
    user = require_template_owner(current_user)
    template = await get_owned_template(template_id, user, db)
    await db.delete(template)
    await db.commit()
