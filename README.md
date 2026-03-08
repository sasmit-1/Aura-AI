# ⚡ Aura AI

**Deterministic Capital Deployment & Deep-Tech Due Diligence**

Aura AI is a venture capital operating system designed to eliminate the bottlenecks in climate tech funding. By leveraging Large Language Models (LLMs) and WebSocket-driven smart contracts, Aura AI autonomously ingests highly technical whitepapers, evaluates their physics, prices the risk, and deploys capital based on real-world milestones.

## 🚀 The Core Engine

* **Deep-Tech RAG Pipeline:** Powered by Groq and Llama 3, the platform reads dense scientific PDFs and extracts CAPEX, Technical Readiness Levels (TRL), and ESG impacts in milliseconds.
* **The "Bullshit Detector":** Built-in thermodynamic validation. If a startup uploads a pitch containing pseudoscientific buzzwords or claims that violate the laws of physics (e.g., "over-unity efficiency"), the AI instantly red-flags the discrepancies.
* **Autonomous Escrow:** Capital is locked against AI-generated "Smart Milestones". A live WebSocket architecture simulates an Oracle/IoT sensor feed—the moment physical physics are verified, the UI updates and capital is disbursed instantly without human intervention.
* **3D Digital Twin:** Real-time Three.js data binding visually represents supply chain and technical risk profiles.

## 🛠️ Tech Stack

**Backend:**
* **Python / FastAPI:** High-performance asynchronous API routing.
* **Groq API (Llama 3):** Ultra-low latency inference for complex physics and financial extraction.
* **WebSockets:** Bi-directional, real-time communication for instant escrow execution and cross-portal notifications.
* **SQLite / Pydantic:** Strict data validation and local persistence.

**Frontend:**
* **Vanilla JS / HTML / CSS:** Zero-dependency, ultra-fast Amoled Black UI.
* **Three.js:** Interactive 3D visualization.
* **html2pdf.js:** High-fidelity, client-side PDF dossier generation.

## 💻 Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/sasmit-1/aura-ai.git](https://github.com/sasmit-1/aura-ai.git)
   cd aura-ai

2. **Set up the virtual environment:**

Bash
python -m venv venv
source venv/bin/activate  # On Windows use: .\venv\Scripts\activate

3. **Install dependencies:**

Bash
pip install fastapi uvicorn groq pydantic python-multipart

4. **Environment Variables:**

Create a .env file in the root directory and add your Groq API key

5. **Run the server:**

Bash
cd backend
python main.py

The Founder Portal will run on http://localhost:8000/founder.html and the Investor Deal Matrix on http://localhost:8000/index.html.

6. **Testing the Escrow (WebSocket):**
To simulate the physical verification of a milestone and disburse funds, open a new terminal window while the server is running:

Bash
python backend/services/escrow_simulator.py
Enter the ID of the locked project to see the dashboards instantly update to "Disbursed".

Built by Sasmit Mondal | LinkedIn: https://www.linkedin.com/in/sasmit-mondal-361229390/