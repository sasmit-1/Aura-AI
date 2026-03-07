/**
 * ╔════════════════════════════════════════════════════╗
 * ║  AURA AI — Frontend Application Logic             ║
 * ║  Fetch API calls + WebSocket real-time updates     ║
 * ║  Bloomberg Modal + Terminal UX + 3D Binding        ║
 * ╚════════════════════════════════════════════════════╝
 */

const API_BASE = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws`;

// Global project data cache (for modal injection)
let _projectsCache = [];
let _currentModalProjectId = null;

// ──────────────────────────────────────────────
// WebSocket Connection
// ──────────────────────────────────────────────

let ws = null;
let wsReconnectTimer = null;

function initWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log("[AURA WS] Connected");
        updateWSStatus(true);
        addActivityLog("WebSocket connected — listening for oracle events");
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("[AURA WS] Message:", data);

            if (data.event === "milestone_verified") {
                handleMilestoneVerified(data);
            }
        } catch (e) {
            console.warn("[AURA WS] Parse error:", e);
        }
    };

    ws.onclose = () => {
        console.log("[AURA WS] Disconnected");
        updateWSStatus(false);
        // Auto-reconnect after 3s
        wsReconnectTimer = setTimeout(initWebSocket, 3000);
    };

    ws.onerror = (err) => {
        console.error("[AURA WS] Error:", err);
        updateWSStatus(false);
    };
}

function updateWSStatus(connected) {
    const dot = document.getElementById("ws-dot");
    const label = document.getElementById("ws-label");
    if (!dot || !label) return;

    if (connected) {
        dot.className = "w-2 h-2 rounded-full bg-green-400 animate-pulse";
        label.textContent = "Live";
        label.className = "text-green-400";
    } else {
        dot.className = "w-2 h-2 rounded-full bg-red-400";
        label.textContent = "Reconnecting...";
        label.className = "text-red-400";
    }
}

// ──────────────────────────────────────────────
// WebSocket Event: milestone_verified
// ──────────────────────────────────────────────

function handleMilestoneVerified(data) {
    const projectId = data.project_id;
    const milestoneId = data.milestone_id;
    const verificationSource = data.verification_source || "Earth Engine API";

    addActivityLog(`🔔 ORACLE: Milestone ${milestoneId || ""} verified for project #${projectId} — escrow DISBURSED`);

    // Find the project card in the DOM
    const card = document.getElementById(`project-card-${projectId}`);
    if (card) {
        // Flash the card green
        card.classList.add("flash-update");
        setTimeout(() => card.classList.remove("flash-update"), 1500);

        // Update ALL milestone badges on this card
        const badges = card.querySelectorAll(".escrow-badge");
        badges.forEach((badge) => {
            const mId = badge.dataset.milestoneId;
            if (!milestoneId || String(mId) === String(milestoneId)) {
                badge.classList.remove("escrow-locked");
                badge.classList.add("escrow-disbursed", "success-pulse");
                badge.innerHTML = `
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Disbursed
                `;
                
                // Remove pulse class after animation to allow reuse
                setTimeout(() => { badge.classList.remove("success-pulse"); }, 600);
            }
        });

        // Update the deploy button + add verification sub-text
        const btn = card.querySelector(".deploy-btn");
        if (btn) {
            btn.disabled = true;
            btn.className = "deploy-btn w-full py-3 bg-green-500/10 border border-green-500/30 text-green-400 font-medium rounded-xl cursor-default text-sm";
            btn.textContent = "✓ Capital Deployed & Verified";

            // Inject verification source sub-text below button
            const btnContainer = btn.parentElement;
            if (btnContainer && !btnContainer.querySelector(".verified-source-tag")) {
                const tag = document.createElement("p");
                tag.className = "verified-source-tag text-center text-[10px] text-emerald-400/70 font-mono mt-2";
                tag.textContent = `✓ Verified via: ${verificationSource}`;
                btnContainer.appendChild(tag);
            }
        }
    }

    // Refresh stats
    loadProjects();
}

// ──────────────────────────────────────────────
// Activity Log
// ──────────────────────────────────────────────

function addActivityLog(message) {
    const log = document.getElementById("activity-log");
    if (!log) return;

    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    const entry = document.createElement("p");
    entry.className = "text-green-400/60";
    entry.textContent = `[${time}] ${message}`;
    log.prepend(entry);

    // Keep max 50 entries
    while (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
}

// ──────────────────────────────────────────────
// Load & Render Projects (Investor Dashboard)
// ──────────────────────────────────────────────

async function loadProjects() {
    const grid = document.getElementById("projects-grid");
    const emptyState = document.getElementById("empty-state");
    if (!grid) return;

    try {
        const resp = await fetch(`${API_BASE}/api/projects`);
        const data = await resp.json();
        const projects = data.projects || [];
        _projectsCache = projects;

        if (projects.length === 0) {
            grid.innerHTML = "";
            if (emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");
        updateStats(projects);
        renderProjectCards(grid, projects);

    } catch (err) {
        console.error("[AURA] Failed to load projects:", err);
        addActivityLog("ERROR: Failed to fetch projects from API");
    }
}

function updateStats(projects) {
    const statProjects = document.getElementById("stat-projects");
    const statAvgScore = document.getElementById("stat-avg-score");
    const statLocked = document.getElementById("stat-locked");
    const statDisbursed = document.getElementById("stat-disbursed");

    if (statProjects) statProjects.textContent = projects.length;

    const scores = projects.map(p => p.ai_feasibility_score).filter(Boolean);
    if (statAvgScore && scores.length) {
        statAvgScore.textContent = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    let locked = 0, disbursed = 0;
    projects.forEach(p => {
        (p.milestones || []).forEach(m => {
            if (m.escrow_status === "locked") locked++;
            if (m.escrow_status === "disbursed") disbursed++;
        });
    });
    if (statLocked) statLocked.textContent = locked;
    if (statDisbursed) statDisbursed.textContent = disbursed;
}

function renderProjectCards(container, projects) {
    container.innerHTML = projects.map((p, i) => {
        const score = p.ai_feasibility_score || 0;
        const scoreColor = score >= 70 ? "#00ff88" : score >= 40 ? "#ffb800" : "#ff3b5c";
        const milestones = p.milestones || [];
        const hasLocked = milestones.some(m => m.escrow_status === "locked");
        const allDisbursed = milestones.length > 0 && milestones.every(m => m.escrow_status === "disbursed");

        return `
        <div class="deal-card bg-[#111111] border border-[#1a1a1a] rounded-2xl overflow-hidden fade-up cursor-pointer"
             id="project-card-${p.id}" style="animation-delay: ${i * 0.1}s"
             onclick="openProjectModal(${p.id})">

            <!-- Card Header -->
            <div class="p-6 pb-4 relative">
                <!-- Thesis Match Badge (top-right) -->
                <div class="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide
                     bg-aura-green/10 border border-aura-green/30 text-aura-green"
                     style="box-shadow: 0 0 12px rgba(0,255,136,0.2), 0 0 4px rgba(0,255,136,0.3);">
                    ${p.thesis_match_score || 0}% Thesis Match
                </div>

                <div class="flex items-start justify-between mb-4 pr-28">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-white font-semibold text-lg truncate">${escapeHtml(p.project_name)}</h3>
                        <p class="text-[#737373] text-xs mt-1 font-mono">ID: ${p.id} · ${new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <!-- Score Ring -->
                    <div class="relative flex-shrink-0 ml-3">
                        <div class="w-14 h-14 rounded-full score-ring flex items-center justify-center"
                             style="--score: ${score}; --score-color: ${scoreColor}; padding: 3px;">
                            <div class="w-full h-full rounded-full bg-[#111111] flex items-center justify-center">
                                <span class="text-sm font-bold" style="color: ${scoreColor}">${score}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Groq Analyzed Tag -->
                <div class="flex items-center gap-2 mb-4">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono
                         bg-cyan-400/10 border border-cyan-400/20 text-cyan-400">
                        ⚡ Analyzed in 0.8s (Groq Llama 3)
                    </span>
                </div>

                <!-- Metrics Grid -->
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div class="bg-[#0a0a0a] rounded-xl p-3">
                        <p class="text-[#737373] text-[10px] uppercase tracking-wider mb-1">CAPEX</p>
                        <p class="text-white font-semibold text-sm">${escapeHtml(p.capex_estimate || "N/A")}</p>
                    </div>
                    <div class="bg-[#0a0a0a] rounded-xl p-3">
                        <p class="text-[#737373] text-[10px] uppercase tracking-wider mb-1">Target Efficiency</p>
                        <p class="text-white font-semibold text-sm">${escapeHtml(p.target_efficiency || "N/A")}</p>
                    </div>
                </div>
            </div>

            <!-- Milestones & Escrow -->
            <div class="border-t border-[#1a1a1a] px-6 py-4 space-y-3">
                ${milestones.map(m => `
                    <div class="flex items-center justify-between">
                        <p class="text-[#737373] text-xs truncate flex-1 mr-3">${escapeHtml(m.description)}</p>
                        <span class="escrow-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border whitespace-nowrap
                            ${m.escrow_status === "locked" ? "escrow-locked" : "escrow-disbursed"}"
                            data-milestone-id="${m.id}">
                            ${m.escrow_status === "locked"
                                ? `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> Locked · $${(m.funding_amount || 0).toLocaleString()}`
                                : `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Disbursed`
                            }
                        </span>
                    </div>
                `).join("")}
            </div>

            <!-- Deploy Button -->
            <div class="border-t border-[#1a1a1a] px-6 py-4">
                ${hasLocked
                    ? `<button class="deploy-btn w-full py-3 bg-[#ffb800]/10 border border-[#ffb800]/30 text-[#ffb800] font-medium rounded-xl hover:bg-[#ffb800]/20 transition-all text-sm"
                           onclick="event.stopPropagation(); deployCapital(${p.id})">
                        Deploy Capital to Escrow
                       </button>`
                    : `<button class="deploy-btn w-full py-3 bg-green-500/10 border border-green-500/30 text-green-400 font-medium rounded-xl cursor-default text-sm" disabled>
                        ✓ Capital Deployed & Verified
                       </button>${allDisbursed ? '<p class="verified-source-tag text-center text-[10px] text-emerald-400/70 font-mono mt-2">✓ Verified via: Earth Engine API</p>' : ''}`
                }
            </div>
        </div>`;
    }).join("");
}

// ──────────────────────────────────────────────
// Bloomberg Modal (investor deep-dive)
// ──────────────────────────────────────────────

function openProjectModal(projectId) {
    const project = _projectsCache.find(p => p.id === projectId);
    if (!project) return;

    const modal = document.getElementById("bloomberg-modal");
    if (!modal) return;

    // Populate header
    document.getElementById("modal-project-name").textContent = project.project_name;
    document.getElementById("modal-phone").textContent = project.phone || "Not provided";
    document.getElementById("modal-linkedin").textContent = project.linkedin || "Not provided";
    document.getElementById("modal-linkedin").href = project.linkedin || "#";

    // Populate body grid (with Typewriter logic for AI text)
    const summaryEl = document.getElementById("modal-summary");
    summaryEl.textContent = ""; // clear completely
    
    document.getElementById("modal-tam").textContent = project.market_tam_estimate || "N/A";
    document.getElementById("modal-trl").textContent = project.technical_readiness_level ? `TRL ${project.technical_readiness_level}/9` : "N/A";
    document.getElementById("modal-esg").textContent = project.esg_impact_score ? `${project.esg_impact_score}/100` : "N/A";

    // Supply chain risk — color-coded
    const riskEl = document.getElementById("modal-risk");
    const risk = project.supply_chain_risk || "N/A";
    riskEl.textContent = risk;
    riskEl.className = "font-bold text-lg";
    if (risk === "High") riskEl.classList.add("text-red-400");
    else if (risk === "Medium") riskEl.classList.add("text-amber-400");
    else riskEl.classList.add("text-emerald-400");

    // Key Strengths
    const strengthsList = document.getElementById("modal-strengths");
    strengthsList.innerHTML = (project.key_strengths || []).map(s =>
        `<li class="flex items-start gap-2"><span class="text-emerald-400 mt-0.5">✦</span><span class="text-gray-300 text-sm">${escapeHtml(s)}</span></li>`
    ).join("");

    // Critical Risks
    const risksList = document.getElementById("modal-risks");
    risksList.innerHTML = (project.critical_risks || []).map(r =>
        `<li class="flex items-start gap-2"><span class="text-red-400 mt-0.5">⚠</span><span class="text-gray-300 text-sm">${escapeHtml(r)}</span></li>`
    ).join("");

    // Deep-Tech Diligence: IP Defensibility
    const ipScoreEl = document.getElementById("modal-ip-score");
    if (ipScoreEl) {
        ipScoreEl.textContent = project.ip_defensibility_score ? `${project.ip_defensibility_score}/100` : "N/A";
    }

    // Security Vulnerabilities
    const vulnsList = document.getElementById("modal-vulns");
    if (vulnsList) {
        vulnsList.innerHTML = (project.security_vulnerabilities || []).map(v =>
            `<li class="flex items-start gap-2"><span class="text-orange-400 mt-0.5">🛡</span><span class="text-gray-300 text-sm">${escapeHtml(v)}</span></li>`
        ).join("");
    }

    // Competitor Landscape
    const compsContainer = document.getElementById("modal-competitors");
    if (compsContainer) {
        compsContainer.innerHTML = (project.competitor_landscape || []).map(c =>
            `<span class="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 text-xs font-mono">${escapeHtml(c)}</span>`
        ).join("");
    }

    // Show modal first so typewriter effect is visible
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // Smart Milestone (Typewriter)
    const milestoneEl = document.getElementById("modal-smart-milestone");
    if (milestoneEl) {
        milestoneEl.textContent = ""; // clear
    }

    // Trigger Typewriters
    typeWriter(summaryEl, project.scientific_summary || "No summary available.", 5);
    if (milestoneEl) {
        setTimeout(() => {
            typeWriter(milestoneEl, project.smart_milestone || "No milestone defined.", 8);
        }, 150);
    }
    // Red Flag Warnings
    const redFlagContainer = document.getElementById("red-flag-container");
    const redFlagList = document.getElementById("red-flag-list");
    if (redFlagContainer && redFlagList) {
        const flags = project.red_flag_warnings || [];
        if (flags.length > 0) {
            redFlagContainer.classList.remove("hidden");
            redFlagList.innerHTML = flags.map(f =>
                `<li class="flex items-start gap-2"><span class="text-red-300 mt-0.5">🚩</span><span class="text-red-200 text-sm">${escapeHtml(f)}</span></li>`
            ).join("");
        } else {
            redFlagContainer.classList.add("hidden");
            redFlagList.innerHTML = "";
        }
    }

    // Store current project ID for modal actions
    _currentModalProjectId = project.id;

    // Reset Request Call button state
    const callBtn = document.querySelector('[onclick="requestCall()"]');
    if (callBtn) {
        callBtn.disabled = false;
        callBtn.textContent = "Request Call";
        callBtn.classList.remove("opacity-60", "cursor-not-allowed");
    }

    // Show modal
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // Update 3D visualization
    if (window.updateDigitalTwin) {
        window.updateDigitalTwin(project.supply_chain_risk || "Medium");
    }
}

function closeProjectModal() {
    const modal = document.getElementById("bloomberg-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
}

function requestCall() {
    if (!_currentModalProjectId) return;
    const btn = document.querySelector('[onclick="requestCall()"]');

    fetch(`${API_BASE}/api/projects/${_currentModalProjectId}/request-call`, {
        method: "POST",
    }).then(resp => resp.json()).then(() => {
        if (btn) {
            btn.textContent = "Request Sent ✓";
            btn.disabled = true;
            btn.classList.add("opacity-60", "cursor-not-allowed");
        }
    }).catch(err => {
        console.error("Request call failed:", err);
        alert("Failed to send request. Please try again.");
    });
}

function exportPDF() {
    const content = document.getElementById("modal-content");
    if (!content) return;

    const opt = {
        margin:       [10, 10, 10, 10],
        filename:     'Aura_AI_Diligence.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(content).save();
}

// ──────────────────────────────────────────────
// Deploy Capital (trigger simulated deployment)
// ──────────────────────────────────────────────

async function deployCapital(projectId) {
    const card = document.getElementById(`project-card-${projectId}`);
    const btn = card?.querySelector(".deploy-btn");

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Deploying...";
        btn.className = "deploy-btn w-full py-3 bg-[#ffb800]/10 border border-[#ffb800]/30 text-[#ffb800] font-medium rounded-xl text-sm opacity-60 cursor-wait";
    }

    addActivityLog(`Deploying capital to escrow for project #${projectId}...`);

    // Simulate a small delay, then the button stays in "Locked — awaiting oracle"
    setTimeout(() => {
        if (btn) {
            btn.textContent = "🔒 Locked — Awaiting Oracle Verification";
            btn.className = "deploy-btn w-full py-3 bg-[#ffb800]/5 border border-[#ffb800]/20 text-[#ffb800]/70 font-medium rounded-xl text-sm cursor-default";
        }
        addActivityLog(`Capital locked in escrow for project #${projectId} — waiting for oracle webhook`);
    }, 1500);
}

// ──────────────────────────────────────────────
// Founder Upload (founder.html)
// ──────────────────────────────────────────────

function initFounderUpload() {
    const form = document.getElementById("upload-form");
    const uploadZone = document.getElementById("upload-zone");
    const fileInput = document.getElementById("pdf-file");
    const placeholder = document.getElementById("upload-placeholder");
    const selected = document.getElementById("upload-selected");
    const filenameEl = document.getElementById("selected-filename");
    const submitBtn = document.getElementById("submit-btn");
    const loadingState = document.getElementById("loading-state");
    const loadingStatus = document.getElementById("loading-status");
    const resultState = document.getElementById("result-state");
    const resultMetrics = document.getElementById("result-metrics");

    if (!form || !uploadZone) return;

    // Click to upload
    uploadZone.addEventListener("click", () => fileInput.click());

    // Drag & drop
    uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("drag-over");
    });
    uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("drag-over");
    });
    uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            showSelectedFile(e.dataTransfer.files[0].name);
        }
    });

    // File selected
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length) {
            showSelectedFile(fileInput.files[0].name);
        }
    });

    function showSelectedFile(name) {
        placeholder.classList.add("hidden");
        selected.classList.remove("hidden");
        filenameEl.textContent = name;
    }

    // ── Terminal Loading Sequence ──
    const terminalLines = [
        "> Parsing thermodynamics...",
        "> Connecting to Groq LPU...",
        "> Extracting CAPEX...",
        "> Generating Smart Escrow...",
    ];

    function showTerminalSequence() {
        // Hide form, show terminal
        form.classList.add("hidden");
        loadingState.classList.add("hidden");

        // Create or get terminal div
        let terminal = document.getElementById("hacker-terminal");
        if (!terminal) {
            terminal = document.createElement("div");
            terminal.id = "hacker-terminal";
            terminal.className = "mt-6 bg-black border border-aura-green/30 rounded-2xl p-6 font-mono text-sm";
            terminal.style.boxShadow = "0 0 40px rgba(0,255,136,0.08), inset 0 0 60px rgba(0,0,0,0.5)";
            form.parentNode.insertBefore(terminal, form.nextSibling);
        }
        terminal.innerHTML = `<p class="text-aura-green/60 mb-3">root@aura-ai:~$ analyze --pitch-deck</p>`;
        terminal.classList.remove("hidden");

        // Sequentially append lines every 600ms
        terminalLines.forEach((line, idx) => {
            setTimeout(() => {
                const p = document.createElement("p");
                p.className = "text-aura-green";
                p.style.opacity = "0";
                p.textContent = line;
                terminal.appendChild(p);
                // Fade in
                requestAnimationFrame(() => {
                    p.style.transition = "opacity 0.3s ease";
                    p.style.opacity = "1";
                });

                // Add blinking cursor on last line
                if (idx === terminalLines.length - 1) {
                    const cursor = document.createElement("span");
                    cursor.className = "inline-block w-2 h-4 bg-aura-green ml-1 animate-pulse";
                    p.appendChild(cursor);
                }
            }, (idx + 1) * 600);
        });
    }

    function hideTerminal() {
        const terminal = document.getElementById("hacker-terminal");
        if (terminal) terminal.classList.add("hidden");
    }

    // Form submission
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!fileInput.files.length) {
            // Show inline validation error on the upload zone
            uploadZone.style.borderColor = "#ff3b5c";
            uploadZone.style.boxShadow = "0 0 30px rgba(255, 59, 92, 0.15)";
            const existingError = uploadZone.querySelector(".upload-error");
            if (!existingError) {
                const errorMsg = document.createElement("p");
                errorMsg.className = "upload-error text-[#ff3b5c] text-sm mt-2 font-medium";
                errorMsg.textContent = "⚠ Please select a PDF file first";
                uploadZone.appendChild(errorMsg);
            }
            // Auto-clear after 3 seconds
            setTimeout(() => {
                uploadZone.style.borderColor = "";
                uploadZone.style.boxShadow = "";
                const err = uploadZone.querySelector(".upload-error");
                if (err) err.remove();
            }, 3000);
            return;
        }

        // Show terminal loading sequence
        showTerminalSequence();

        try {
            // Build FormData with all fields including phone & linkedin
            const formData = new FormData();
            formData.append("file", fileInput.files[0]);
            formData.append("founder_name", document.getElementById("company-name")?.value || "Demo Founder");
            formData.append("milestone_desc", document.getElementById("milestone-desc")?.value || "Phase 1: Lab Prototype Verification");
            formData.append("funding_amount", parseFloat(
                (document.getElementById("funding")?.value || "500000").replace(/[,$]/g, "")
            ) || 500000);
            formData.append("phone", document.getElementById("phone")?.value || "");
            formData.append("linkedin", document.getElementById("linkedin")?.value || "");

            const resp = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: formData });
            const data = await resp.json();

            if (resp.ok) {
                hideTerminal();
                showResult(data.project);
            } else {
                throw new Error(data.detail || "Upload failed");
            }
        } catch (err) {
            hideTerminal();
            form.classList.remove("hidden");
            alert(`Error: ${err.message}`);
        }
    });

    function showResult(project) {
        loadingState.classList.add("hidden");
        resultState.classList.remove("hidden");

        const metrics = [
            { label: "Project Name", value: project.project_name, color: "text-white" },
            { label: "CAPEX Estimate", value: project.capex_estimate || "N/A", color: "text-cyan-400" },
            { label: "Target Efficiency", value: project.target_efficiency || "N/A", color: "text-cyan-400" },
            { label: "AI Feasibility Score", value: `${project.ai_feasibility_score}/100`, color: "text-green-400" },
        ];

        resultMetrics.innerHTML = metrics.map(m => `
            <div class="bg-[#0a0a0a] rounded-xl p-3">
                <p class="text-[#737373] text-[10px] uppercase tracking-wider mb-1">${m.label}</p>
                <p class="${m.color} font-semibold text-sm">${escapeHtml(String(m.value))}</p>
            </div>
        `).join("");

        // Activate Founder Control Center (if on founder page)
        if (typeof window.populateFounderDashboard === "function") {
            window.populateFounderDashboard(project);
        }
    }
}

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// Global active typing intervals (to prevent overlap if user clicks fast)
let activeTypewriters = new Map();

function typeWriter(element, text, speed = 10) {
    if (!element) return;
    
    // Clear any existing typing animation on this element
    if (activeTypewriters.has(element)) {
        clearInterval(activeTypewriters.get(element));
    }
    
    element.textContent = "";
    let i = 0;
    
    const interval = setInterval(() => {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
        } else {
            clearInterval(interval);
            activeTypewriters.delete(element);
        }
    }, speed);
    
    activeTypewriters.set(element, interval);
}

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    // Initialize WebSocket on all pages
    initWebSocket();

    // Investor dashboard (index.html)
    if (document.getElementById("projects-grid")) {
        loadProjects();
        addActivityLog("Deal Matrix initialized — fetching projects");
    }

    // Founder portal (founder.html)
    if (document.getElementById("upload-form")) {
        initFounderUpload();
    }

    // Modal close on backdrop click
    const modal = document.getElementById("bloomberg-modal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeProjectModal();
        });
    }
});
