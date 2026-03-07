"""
Aura AI — Database Models
SQLAlchemy ORM for Users, Projects, and Milestones.
Uses SQLite as the backing store.
"""

import os
import json
from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Text,
    DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# ---------------------------------------------------------------------------
# Database path — resolves to  backend/data/aura.db
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'aura.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    role = Column(SAEnum("investor", "founder", name="user_role"), nullable=False, default="founder")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    projects = relationship("Project", back_populates="founder", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.name} ({self.role})>"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    founder_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Core fields populated by the RAG engine
    project_name = Column(String(255), nullable=False, default="Untitled Project")
    pdf_path = Column(Text, nullable=True)
    capex_estimate = Column(String(100), nullable=True)
    target_efficiency = Column(String(100), nullable=True)
    ai_feasibility_score = Column(Float, nullable=True)

    # Founder contact info
    phone = Column(String(50), nullable=True)
    linkedin = Column(String(500), nullable=True)

    # Deep AI analysis fields
    scientific_summary = Column(Text, nullable=True)
    key_strengths = Column(Text, nullable=True)       # JSON-encoded list
    critical_risks = Column(Text, nullable=True)       # JSON-encoded list
    technical_readiness_level = Column(Integer, nullable=True)
    esg_impact_score = Column(Integer, nullable=True)
    supply_chain_risk = Column(String(20), nullable=True)
    market_tam_estimate = Column(String(100), nullable=True)

    # Deep-tech due diligence fields
    thesis_match_score = Column(Integer, nullable=True)
    smart_milestone = Column(String(500), nullable=True)
    competitor_landscape = Column(Text, nullable=True)       # JSON-encoded list
    ip_defensibility_score = Column(Integer, nullable=True)
    security_vulnerabilities = Column(Text, nullable=True)   # JSON-encoded list

    # Red flag detection
    red_flag_warnings = Column(Text, nullable=True)          # JSON-encoded list

    status = Column(
        SAEnum("pending", "analyzed", "funded", "completed", name="project_status"),
        nullable=False,
        default="pending",
    )
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    founder = relationship("User", back_populates="projects")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")

    def _parse_json_list(self, val):
        """Safely parse a JSON-encoded list, or return empty list."""
        if not val:
            return []
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return [val] if isinstance(val, str) else []

    def to_dict(self):
        """Serialize for JSON API responses."""
        return {
            "id": self.id,
            "founder_id": self.founder_id,
            "project_name": self.project_name,
            "pdf_path": self.pdf_path,
            "capex_estimate": self.capex_estimate,
            "target_efficiency": self.target_efficiency,
            "ai_feasibility_score": self.ai_feasibility_score,
            "phone": self.phone,
            "linkedin": self.linkedin,
            "scientific_summary": self.scientific_summary,
            "key_strengths": self._parse_json_list(self.key_strengths),
            "critical_risks": self._parse_json_list(self.critical_risks),
            "technical_readiness_level": self.technical_readiness_level,
            "esg_impact_score": self.esg_impact_score,
            "supply_chain_risk": self.supply_chain_risk,
            "market_tam_estimate": self.market_tam_estimate,
            "thesis_match_score": self.thesis_match_score,
            "smart_milestone": self.smart_milestone,
            "competitor_landscape": self._parse_json_list(self.competitor_landscape),
            "ip_defensibility_score": self.ip_defensibility_score,
            "security_vulnerabilities": self._parse_json_list(self.security_vulnerabilities),
            "red_flag_warnings": self._parse_json_list(self.red_flag_warnings),
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "milestones": [m.to_dict() for m in self.milestones],
        }

    def __repr__(self):
        return f"<Project {self.project_name} (score={self.ai_feasibility_score})>"


class Milestone(Base):
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    description = Column(Text, nullable=False, default="Prototype delivered")
    funding_amount = Column(Float, nullable=False, default=0.0)
    escrow_status = Column(
        SAEnum("locked", "disbursed", name="escrow_status"),
        nullable=False,
        default="locked",
    )
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    project = relationship("Project", back_populates="milestones")

    def to_dict(self):
        """Serialize for JSON API responses."""
        return {
            "id": self.id,
            "project_id": self.project_id,
            "description": self.description,
            "funding_amount": self.funding_amount,
            "escrow_status": self.escrow_status,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Milestone '{self.description}' — {self.escrow_status}>"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def init_db():
    """Create all tables if they don't already exist."""
    Base.metadata.create_all(bind=engine)
    print("✅  Database initialized — tables created in data/aura.db")


def get_db():
    """FastAPI dependency — yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
