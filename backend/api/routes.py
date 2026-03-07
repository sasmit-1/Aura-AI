"""
Aura AI — API Routes
POST /api/upload      → Process pitch deck PDF & save to DB
GET  /api/projects    → Fetch all projects for the investor deal matrix
POST /api/webhook     → Oracle webhook — disburse escrow & broadcast via WS
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.models import get_db, User, Project, Milestone
from services.rag_engine import process_pitch_deck

logger = logging.getLogger("aura.api")

router = APIRouter(tags=["Aura API"])

# ---------------------------------------------------------------------------
# Upload directory
# ---------------------------------------------------------------------------
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------

@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "Aura AI"}


# ---------------------------------------------------------------------------
# POST /api/upload  — Founder uploads a pitch deck PDF (multipart/form-data)
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_pitch_deck(
    file: UploadFile = File(...),
    founder_name: str = Form("Demo Founder"),
    founder_email: str = Form(""),
    milestone_desc: str = Form("Phase 1: Lab Prototype Verification"),
    funding_amount: float = Form(500_000.0),
    phone: str = Form(""),
    linkedin: str = Form(""),
    db: Session = Depends(get_db),
):
    """
    1. Save the uploaded PDF to data/uploads/
    2. Run the RAG engine to extract ProjectMetrics
    3. Create (or find) a Founder user
    4. Save the extracted project + a linked milestone
    5. Return the full project JSON
    """

    # --- Save the file ---
    ext = os.path.splitext(file.filename or "upload.pdf")[1] or ".pdf"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    logger.info("Saved upload → %s (%d bytes)", file_path, len(contents))

    # --- RAG engine: extract structured metrics ---
    metrics = await process_pitch_deck(file_path)
    logger.info("RAG metrics: %s", metrics)

    # --- Create or find the founder ---
    email = founder_email or f"{founder_name.lower().replace(' ', '.')}@aura.demo"

    founder = db.query(User).filter(User.email == email).first()
    if not founder:
        founder = User(name=founder_name, email=email, role="founder")
        db.add(founder)
        db.flush()  # get founder.id before creating project

    # --- Encode list fields as JSON strings for SQLite storage ---
    key_strengths_json = json.dumps(metrics.get("key_strengths", []))
    critical_risks_json = json.dumps(metrics.get("critical_risks", []))
    competitor_landscape_json = json.dumps(metrics.get("competitor_landscape", []))
    security_vulnerabilities_json = json.dumps(metrics.get("security_vulnerabilities", []))
    red_flag_warnings_json = json.dumps(metrics.get("red_flag_warnings", []))

    # --- Create the project ---
    project = Project(
        founder_id=founder.id,
        project_name=metrics.get("project_name", "Untitled Project"),
        pdf_path=file_path,
        capex_estimate=metrics.get("capex_estimate"),
        target_efficiency=metrics.get("target_efficiency"),
        ai_feasibility_score=metrics.get("ai_feasibility_score"),
        phone=phone,
        linkedin=linkedin,
        scientific_summary=metrics.get("scientific_summary"),
        key_strengths=key_strengths_json,
        critical_risks=critical_risks_json,
        technical_readiness_level=metrics.get("technical_readiness_level"),
        esg_impact_score=metrics.get("esg_impact_score"),
        supply_chain_risk=metrics.get("supply_chain_risk"),
        market_tam_estimate=metrics.get("market_tam_estimate"),
        thesis_match_score=metrics.get("thesis_match_score"),
        smart_milestone=metrics.get("smart_milestone"),
        competitor_landscape=competitor_landscape_json,
        ip_defensibility_score=metrics.get("ip_defensibility_score"),
        security_vulnerabilities=security_vulnerabilities_json,
        red_flag_warnings=red_flag_warnings_json,
        status="analyzed",
    )
    db.add(project)
    db.flush()  # get project.id before creating milestone

    # --- Create linked milestone (escrow locked) ---
    milestone = Milestone(
        project_id=project.id,
        description=milestone_desc,
        funding_amount=funding_amount,
        escrow_status="locked",
    )
    db.add(milestone)
    db.commit()

    # Refresh to load relationships
    db.refresh(project)

    return {
        "message": "Pitch deck analyzed successfully",
        "project": project.to_dict(),
    }


# ---------------------------------------------------------------------------
# GET /api/projects  — Investor deal matrix data
# ---------------------------------------------------------------------------

@router.get("/projects")
async def get_projects(db: Session = Depends(get_db)):
    """Fetch all projects with their milestones for the investor dashboard."""
    projects = db.query(Project).all()
    return {"projects": [p.to_dict() for p in projects]}


# ---------------------------------------------------------------------------
# POST /api/webhook  — Oracle verification → disburse escrow
# ---------------------------------------------------------------------------

class WebhookPayload(BaseModel):
    project_id: int
    milestone_id: int | None = None
    verification_source: str = "Earth Engine API"
    status: str = "verified"


@router.post("/webhook")
async def oracle_webhook(payload: WebhookPayload, db: Session = Depends(get_db)):
    """
    Simulate an oracle verification event.
    1. Find the milestone (or the first locked milestone for the project)
    2. Update escrow_status → "disbursed"
    3. Broadcast the event via WebSocket to all connected frontends
    """
    # Import the manager here to avoid circular imports
    from main import manager

    # --- Find the target milestone ---
    if payload.milestone_id:
        milestone = db.query(Milestone).filter(
            Milestone.id == payload.milestone_id,
            Milestone.project_id == payload.project_id,
        ).first()
    else:
        # Pick the first locked milestone for this project
        milestone = db.query(Milestone).filter(
            Milestone.project_id == payload.project_id,
            Milestone.escrow_status == "locked",
        ).first()

    if not milestone:
        raise HTTPException(
            status_code=404,
            detail=f"No locked milestone found for project {payload.project_id}",
        )

    # --- Disburse ---
    milestone.escrow_status = "disbursed"
    milestone.verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(milestone)

    logger.info(
        "💰 Milestone %d disbursed for project %d (source: %s)",
        milestone.id, payload.project_id, payload.verification_source,
    )

    # --- 🔥 The Magic Trick: Real-time WebSocket broadcast ---
    await manager.broadcast({
        "event": "milestone_verified",
        "project_id": payload.project_id,
        "milestone_id": milestone.id,
        "verification_source": payload.verification_source,
        "escrow_status": "disbursed",
    })

    return {
        "message": "Milestone verified — funds disbursed",
        "milestone": milestone.to_dict(),
    }


# ---------------------------------------------------------------------------
# POST /api/projects/{project_id}/request-call  — Investor requests a call
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/request-call")
async def request_call(project_id: int):
    """
    Investor clicks 'Request Call' — broadcast a real-time notification
    to all connected founders via WebSocket.
    """
    from main import manager

    await manager.broadcast({
        "event": "call_requested",
        "project_id": project_id,
    })

    logger.info("📞 Call requested for project %d — broadcasted to all WS clients", project_id)

    return {"status": "notification_sent"}
