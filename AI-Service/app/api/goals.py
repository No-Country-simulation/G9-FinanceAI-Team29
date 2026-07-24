from fastapi import APIRouter, HTTPException

from app.schemas.goals import (
    GoalAmountRequest,
    GoalCreate,
    GoalResponse,
    GoalSummaryResponse,
    GoalUpdate,
)
from app.services.goals.service import GoalService


router = APIRouter(
    prefix="/goals",
    tags=["Metas financieras"],
)

service = GoalService()


@router.get(
    "/users/{usuario_id}",
    response_model=list[GoalResponse],
)
def list_goals(
    usuario_id: str,
    estado: str | None = None,
):
    try:
        return service.list_goals(
            usuario_id,
            estado,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.get(
    "/{goal_id}",
    response_model=GoalResponse,
)
def get_goal(
    goal_id: str,
):
    try:
        return service.get_goal(goal_id)

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error


@router.post(
    "",
    response_model=GoalResponse,
)
def create_goal(
    request: GoalCreate,
):
    try:
        return service.create_goal(request)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.patch(
    "/{goal_id}",
    response_model=GoalResponse,
)
def update_goal(
    goal_id: str,
    request: GoalUpdate,
):
    try:
        return service.update_goal(
            goal_id,
            request,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.post(
    "/{goal_id}/reserve",
)
def reserve_money(
    goal_id: str,
    request: GoalAmountRequest,
):
    try:
        return service.reserve_money(
            goal_id,
            request.monto,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.post(
    "/{goal_id}/release",
)
def release_money(
    goal_id: str,
    request: GoalAmountRequest,
):
    try:
        return service.release_money(
            goal_id,
            request.monto,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.delete(
    "/{goal_id}",
)
def cancel_goal(
    goal_id: str,
):
    try:
        return service.cancel_goal(goal_id)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.get(
    "/users/{usuario_id}/summary",
    response_model=GoalSummaryResponse,
)
def summary(
    usuario_id: str,
):
    try:
        return service.get_summary(
            usuario_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error