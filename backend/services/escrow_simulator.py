"""
╔══════════════════════════════════════════════════════════════╗
║        AURA AI  —  ORACLE ESCROW SIMULATOR  v1.0            ║
║        Autonomous Climate Capital Verification Engine       ║
╚══════════════════════════════════════════════════════════════╝

Standalone script that simulates a real-world oracle verification
event by firing a POST request to the /api/webhook endpoint.

Usage:
    python -m services.escrow_simulator
    # or
    python services/escrow_simulator.py
"""

import sys
import time
import requests

API_BASE = "http://localhost:8000"
WEBHOOK_URL = f"{API_BASE}/api/webhook"


def print_slow(text: str, delay: float = 0.03):
    """Print text character-by-character for dramatic effect."""
    for char in text:
        sys.stdout.write(char)
        sys.stdout.flush()
        time.sleep(delay)
    print()


def display_banner():
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║     🛰️  AURA AI  —  ORACLE VERIFICATION TERMINAL  🛰️       ║")
    print("║     Climate Capital Autonomous Disbursement Engine          ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()


def run_simulation(project_id: int, milestone_id: int | None = None):
    """Execute the oracle verification sequence."""

    print("─" * 62)
    print_slow("[ORACLE]  Initializing secure connection to Aura AI backend...")
    time.sleep(0.5)

    print_slow("[ORACLE]  Connecting to remote satellite feed ............ ✓")
    time.sleep(0.3)

    print_slow("[ORACLE]  Querying Earth Engine API for ground-truth data.. ✓")
    time.sleep(0.4)

    print_slow("[ORACLE]  Cross-referencing lab telemetry with on-chain hash")
    time.sleep(0.3)

    print_slow("[ORACLE]  Verifying milestone conditions ................. ✓")
    time.sleep(0.5)

    print()
    print_slow("[ORACLE]  ⚡ DATA VERIFIED — Triggering smart contract execution...")
    print()

    # --- Fire the webhook ---
    payload = {
        "project_id": project_id,
        "verification_source": "Earth Engine API + Lab Telemetry",
        "status": "verified",
    }
    if milestone_id:
        payload["milestone_id"] = milestone_id

    try:
        response = requests.post(WEBHOOK_URL, json=payload, timeout=10)

        if response.status_code == 200:
            data = response.json()
            print("─" * 62)
            print()
            print("  ✅  ESCROW DISBURSED SUCCESSFULLY")
            print(f"  📋  Project ID  : {project_id}")
            milestone_info = data.get("milestone", {})
            print(f"  🏷️   Milestone   : {milestone_info.get('description', 'N/A')}")
            print(f"  💰  Amount      : ${milestone_info.get('funding_amount', 0):,.0f}")
            print(f"  🕐  Verified at : {milestone_info.get('verified_at', 'N/A')}")
            print()
            print("  🔔  WebSocket broadcast sent to all connected investors")
            print("─" * 62)
        else:
            print(f"\n  ❌  WEBHOOK FAILED — HTTP {response.status_code}")
            print(f"  Response: {response.text}")

    except requests.ConnectionError:
        print("\n  ❌  CONNECTION FAILED")
        print("  Is the Aura AI backend running on http://localhost:8000?")
        print("  Start it with:  python -m uvicorn main:app --reload --port 8000")

    except Exception as exc:
        print(f"\n  ❌  UNEXPECTED ERROR: {exc}")


def main():
    display_banner()

    # --- Get project ID from user ---
    try:
        # First, show available projects
        try:
            resp = requests.get(f"{API_BASE}/api/projects", timeout=5)
            if resp.status_code == 200:
                projects = resp.json().get("projects", [])
                if projects:
                    print("  Available projects:")
                    print("  ─────────────────────────────────────────")
                    for p in projects:
                        locked = [m for m in p.get("milestones", []) if m["escrow_status"] == "locked"]
                        status_icon = "🟡" if locked else "🟢"
                        print(f"  {status_icon}  ID: {p['id']}  │  {p['project_name']}  │  Score: {p['ai_feasibility_score']}")
                        for m in p.get("milestones", []):
                            escrow_icon = "🔒" if m["escrow_status"] == "locked" else "💚"
                            print(f"       {escrow_icon}  Milestone {m['id']}: {m['description']} (${m['funding_amount']:,.0f})")
                    print("  ─────────────────────────────────────────")
                    print()
                else:
                    print("  ⚠️  No projects found. Upload a pitch deck first.\n")
                    return
        except Exception:
            pass  # If can't fetch projects, still allow manual entry

        project_id_input = input("  Enter Project ID to verify: ").strip()
        project_id = int(project_id_input)

        milestone_input = input("  Enter Milestone ID (press Enter for first locked): ").strip()
        milestone_id = int(milestone_input) if milestone_input else None

        print()
        run_simulation(project_id, milestone_id)

    except ValueError:
        print("\n  ❌  Invalid input — please enter a numeric ID")
    except KeyboardInterrupt:
        print("\n\n  [ORACLE]  Session terminated by operator.")


if __name__ == "__main__":
    main()
