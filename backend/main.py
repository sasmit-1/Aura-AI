"""
Aura AI — FastAPI Application Entry Point
Handles CORS, WebSocket broadcasting, DB init, and route mounting.
"""

import os
import json
import webbrowser
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from database.models import init_db, get_db, Project
from services.rag_engine import client


# ---------------------------------------------------------------------------
# WebSocket Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"🔌  WebSocket connected — {len(self.active_connections)} active")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"🔌  WebSocket disconnected — {len(self.active_connections)} active")

    async def broadcast(self, message: dict):
        """Send a JSON message to every connected client."""
        payload = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                # Silently skip stale connections
                pass


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Lifespan — DB initialisation on startup
# ---------------------------------------------------------------------------

def open_browser_tabs():
    if not os.environ.get("BROWSER_OPENED"):
        os.environ["BROWSER_OPENED"] = "1"
        try:
            webbrowser.open("http://localhost:8000/index.html")
            webbrowser.open("http://localhost:8000/landing.html")
        except Exception as e:
            print(f"Could not open browser: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    print("🚀  Aura AI backend is live")
    threading.Timer(1.5, open_browser_tabs).start()
    yield
    # Shutdown
    print("👋  Aura AI backend shutting down")


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Aura AI — Climate Capital OS",
    description="AI-driven climate tech investment platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — wide open for hackathon speed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive; we only broadcast FROM the server
            data = await websocket.receive_text()
            # Echo back for debugging (optional)
            await websocket.send_text(json.dumps({"echo": data}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# API Router — will be populated in Phase 3
# ---------------------------------------------------------------------------

from api.routes import router as api_router        # noqa: E402
app.include_router(api_router, prefix="/api")

# ---------------------------------------------------------------------------
# POST /api/ask_aura — Token-Saver RAG Chat
# ---------------------------------------------------------------------------

class AskAuraRequest(BaseModel):
    project_id: int
    question: str

@app.post("/api/ask_aura")
async def ask_aura(payload: AskAuraRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_json = json.dumps(project.to_dict())
    
    prompt = f"You are Aura AI. Answer the user's question based ONLY on this project data: {project_json}. Keep the answer to 1-2 short sentences.\nQuestion: {payload.question}"
    
    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": prompt}],
            temperature=0.2,
            max_tokens=200,
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        answer = "I'm sorry, I'm having trouble connecting to my knowledge base right now."
        
    return {"answer": answer}


# ---------------------------------------------------------------------------
# Serve Frontend Static Files
# ---------------------------------------------------------------------------

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


# ---------------------------------------------------------------------------
# Dev Server
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
