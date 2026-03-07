/**
 * ╔════════════════════════════════════════════════════╗
 * ║  AURA AI — Three.js Climate Digital Twin Visual   ║
 * ║  Rotating dark globe with glowing network nodes    ║
 * ║  + Dynamic risk-level color/speed binding          ║
 * ╚════════════════════════════════════════════════════╝
 */

(function () {
    const canvas = document.getElementById("three-canvas");
    if (!canvas || typeof THREE === "undefined") return;

    // ── Scene Setup ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 3.8);

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // ── Colors (mutable for dynamic updates) ──
    let currentColor = new THREE.Color(0x00ff88);  // Default: emerald
    let targetRotationSpeed = 0.001;                // Default: slow
    let currentRotationSpeed = 0.001;

    const AURA_CYAN = new THREE.Color(0x00d4ff);

    // ── Globe (wireframe sphere) ──
    const globeGeo = new THREE.SphereGeometry(1.2, 36, 18);
    const globeMat = new THREE.MeshBasicMaterial({
        color: 0x0a0a0a,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // ── Inner glow sphere ──
    const glowGeo = new THREE.SphereGeometry(1.18, 32, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: currentColor,
        transparent: true,
        opacity: 0.02,
    });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowSphere);

    // ── Latitude/Longitude rings ──
    const ringMaterials = [];
    function createRing(radius, segments, rotX, rotY, opacity) {
        const geo = new THREE.RingGeometry(radius - 0.003, radius, segments);
        const mat = new THREE.MeshBasicMaterial({
            color: currentColor,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide,
        });
        ringMaterials.push(mat);
        const ring = new THREE.Mesh(geo, mat);
        ring.rotation.x = rotX;
        ring.rotation.y = rotY;
        return ring;
    }

    scene.add(createRing(1.22, 64, Math.PI / 2, 0, 0.06));
    scene.add(createRing(1.22, 64, Math.PI / 3, Math.PI / 4, 0.04));
    scene.add(createRing(1.22, 64, -Math.PI / 6, Math.PI / 2, 0.04));

    // ── Network Nodes (scattered on globe surface) ──
    const nodesGroup = new THREE.Group();
    const nodeMaterials = [];   // Track for color updates
    const pulseMaterials = [];  // Track for color updates

    function latLonToVec3(lat, lon, r) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
    }

    // Major climate/tech hub locations
    const hubs = [
        { lat: 37.7, lon: -122.4, size: 0.03 },   // San Francisco
        { lat: 51.5, lon: -0.1, size: 0.025 },     // London
        { lat: 35.7, lon: 139.7, size: 0.025 },    // Tokyo
        { lat: 1.3, lon: 103.8, size: 0.02 },      // Singapore
        { lat: -33.9, lon: 18.4, size: 0.02 },     // Cape Town
        { lat: 48.9, lon: 2.3, size: 0.02 },       // Paris
        { lat: 30.3, lon: -97.7, size: 0.025 },    // Austin
        { lat: 22.3, lon: 114.2, size: 0.02 },     // Hong Kong
        { lat: 52.5, lon: 13.4, size: 0.02 },      // Berlin
        { lat: -23.5, lon: -46.6, size: 0.018 },   // São Paulo
        { lat: 55.8, lon: 37.6, size: 0.018 },     // Moscow
        { lat: 28.6, lon: 77.2, size: 0.022 },     // New Delhi
        { lat: 39.9, lon: 116.4, size: 0.022 },    // Beijing
        { lat: -37.8, lon: 144.9, size: 0.018 },   // Melbourne
        { lat: 59.3, lon: 18.1, size: 0.018 },     // Stockholm
    ];

    const nodePositions = [];

    hubs.forEach((hub) => {
        const pos = latLonToVec3(hub.lat, hub.lon, 1.22);
        nodePositions.push(pos);

        // Glowing node dot
        const dotGeo = new THREE.SphereGeometry(hub.size, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({
            color: currentColor,
            transparent: true,
            opacity: 0.8,
        });
        nodeMaterials.push(dotMat);
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(pos);
        nodesGroup.add(dot);

        // Outer pulse ring
        const pulseGeo = new THREE.RingGeometry(hub.size * 1.5, hub.size * 2.5, 16);
        const pulseMat = new THREE.MeshBasicMaterial({
            color: currentColor,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
        });
        pulseMaterials.push(pulseMat);
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.copy(pos);
        pulse.lookAt(0, 0, 0);
        pulse.userData = { baseOpacity: 0.2, phase: Math.random() * Math.PI * 2 };
        nodesGroup.add(pulse);
    });

    scene.add(nodesGroup);

    // ── Network Connections (lines between nearby nodes) ──
    const lineMaterials = [];
    for (let i = 0; i < nodePositions.length; i++) {
        for (let j = i + 1; j < nodePositions.length; j++) {
            const dist = nodePositions[i].distanceTo(nodePositions[j]);
            if (dist < 2.0) {
                const mid = new THREE.Vector3()
                    .addVectors(nodePositions[i], nodePositions[j])
                    .multiplyScalar(0.5)
                    .normalize()
                    .multiplyScalar(1.35);

                const curve = new THREE.QuadraticBezierCurve3(nodePositions[i], mid, nodePositions[j]);
                const curvePoints = curve.getPoints(20);
                const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
                const lMat = new THREE.LineBasicMaterial({
                    color: currentColor,
                    transparent: true,
                    opacity: 0.08,
                });
                lineMaterials.push(lMat);
                const line = new THREE.Line(curveGeo, lMat);
                nodesGroup.add(line);
            }
        }
    }

    // ── Floating Particles ──
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const particleSpeeds = [];

    for (let i = 0; i < particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1.4 + Math.random() * 0.8;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        particleSpeeds.push(0.001 + Math.random() * 0.003);
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
        color: AURA_CYAN,
        size: 0.015,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ── Dynamic Risk Color Update ──
    function updateAllColors(newColor) {
        currentColor = newColor;
        glowMat.color.copy(newColor);
        ringMaterials.forEach(m => m.color.copy(newColor));
        nodeMaterials.forEach(m => m.color.copy(newColor));
        pulseMaterials.forEach(m => m.color.copy(newColor));
        lineMaterials.forEach(m => m.color.copy(newColor));
        particleMat.color.copy(newColor);
    }

    // ── Exposed Global API ──
    window.updateDigitalTwin = function (riskLevel) {
        const level = (riskLevel || "Medium").toLowerCase();
        if (level === "high") {
            updateAllColors(new THREE.Color(0xef4444));   // Red
            targetRotationSpeed = 0.004;                   // Fast
        } else if (level === "medium") {
            updateAllColors(new THREE.Color(0xeab308));   // Amber
            targetRotationSpeed = 0.002;                   // Normal
        } else {
            updateAllColors(new THREE.Color(0x10b981));   // Emerald
            targetRotationSpeed = 0.0008;                  // Slow
        }
    };

    // ── Animation Loop ──
    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        time += 0.008;

        // Lerp rotation speed for smooth transitions
        currentRotationSpeed += (targetRotationSpeed - currentRotationSpeed) * 0.02;

        // Rotate globe
        globe.rotation.y += currentRotationSpeed;
        glowSphere.rotation.y += currentRotationSpeed;
        nodesGroup.rotation.y += currentRotationSpeed;

        // Pulse node rings
        nodesGroup.children.forEach((child) => {
            if (child.userData && child.userData.baseOpacity !== undefined) {
                const pulse = Math.sin(time * 2 + child.userData.phase) * 0.5 + 0.5;
                child.material.opacity = child.userData.baseOpacity * (0.3 + pulse * 0.7);
            }
        });

        // Orbit particles
        const posArr = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const idx = i * 3;
            const x = posArr[idx];
            const z = posArr[idx + 2];
            const speed = particleSpeeds[i];
            const cos = Math.cos(speed);
            const sin = Math.sin(speed);
            posArr[idx] = x * cos - z * sin;
            posArr[idx + 2] = x * sin + z * cos;
        }
        particles.geometry.attributes.position.needsUpdate = true;

        // Subtle camera sway
        camera.position.x = Math.sin(time * 0.3) * 0.15;
        camera.position.y = Math.cos(time * 0.2) * 0.1;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    animate();

    // ── Resize Handler ──
    window.addEventListener("resize", () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
})();
