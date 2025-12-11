// ----------------- Particle Animation with Hand Tracking -----------------
let scene, camera, renderer, particles;
const count = 12000;
let currentState = 'sphere';
let handDetected = false;
let lastGesture = null;
let lastGestureTime = 0;
const gestureCooldown = 400;

// Backend API URL - Aapka deployed backend URL
const BACKEND_API_URL = "https://editing2213.vercel.app";

// Debug element
let debugElement = null;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    document.getElementById('container').appendChild(renderer.domElement);

    camera.position.z = 25;

    createParticles();
    setupEventListeners();
    setupHandTracking();
    createDebugElement();
    animate();
    
    // Check backend connection
    checkBackendConnection();
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    function sphericalDistribution(i) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        
        return {
            x: 8 * Math.cos(theta) * Math.sin(phi),
            y: 8 * Math.sin(theta) * Math.sin(phi),
            z: 8 * Math.cos(phi)
        };
    }

    for (let i = 0; i < count; i++) {
        const point = sphericalDistribution(i);
        
        positions[i * 3] = point.x + (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 1] = point.y + (Math.random() - 0.5) * 0.5;
        positions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.5;

        const color = new THREE.Color();
        const depth = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z) / 8;
        color.setHSL(0.5 + depth * 0.2, 0.7, 0.4 + depth * 0.3);

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.08,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });

    if (particles) scene.remove(particles);
    particles = new THREE.Points(geometry, material);
    particles.rotation.x = 0;
    particles.rotation.y = 0;
    particles.rotation.z = 0;
    scene.add(particles);
}

function setupEventListeners() {
    const typeBtn = document.getElementById('typeBtn');
    const input = document.getElementById('morphText');

    typeBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            morphToText(text);
        }
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const text = input.value.trim();
            if (text) {
                morphToText(text);
            }
        }
    });
}

function createTextPoints(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 100;
    const padding = 20;

    ctx.font = `bold ${fontSize}px Arial`;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    canvas.width = textWidth + padding * 2;
    canvas.height = textHeight + padding * 2;

    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const points = [];
    const threshold = 128;

    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > threshold) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            
            if (Math.random() < 0.3) {
                points.push({
                    x: (x - canvas.width / 2) / (fontSize / 10),
                    y: -(y - canvas.height / 2) / (fontSize / 10)
                });
            }
        }
    }

    return points;
}

function morphToText(text) {
    currentState = 'text';
    const textPoints = createTextPoints(text);
    const positions = particles.geometry.attributes.position.array;
    const targetPositions = new Float32Array(count * 3);

    gsap.to(particles.rotation, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.5
    });

    for (let i = 0; i < count; i++) {
        if (i < textPoints.length) {
            targetPositions[i * 3] = textPoints[i].x;
            targetPositions[i * 3 + 1] = textPoints[i].y;
            targetPositions[i * 3 + 2] = 0;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 20 + 10;
            targetPositions[i * 3] = Math.cos(angle) * radius;
            targetPositions[i * 3 + 1] = Math.sin(angle) * radius;
            targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
        }
    }

    const duration = 1200;
    const start = performance.now();
    const startPositions = positions.slice();

    function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const easeT = 0.5 - 0.5 * Math.cos(Math.PI * t);
        for (let i = 0; i < positions.length; i++) {
            positions[i] = startPositions[i] + (targetPositions[i] - startPositions[i]) * easeT;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        if (t < 1) {
            requestAnimationFrame(frame);
        }
    }
    requestAnimationFrame(frame);
}

function morphToCircle() {
    currentState = 'sphere';
    const positions = particles.geometry.attributes.position.array;
    const targetPositions = new Float32Array(count * 3);
    const colors = particles.geometry.attributes.color.array;

    function sphericalDistribution(i) {
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;
        
        return {
            x: 8 * Math.cos(theta) * Math.sin(phi),
            y: 8 * Math.sin(theta) * Math.sin(phi),
            z: 8 * Math.cos(phi)
        };
    }

    for (let i = 0; i < count; i++) {
        const point = sphericalDistribution(i);
        
        targetPositions[i * 3] = point.x + (Math.random() - 0.5) * 0.5;
        targetPositions[i * 3 + 1] = point.y + (Math.random() - 0.5) * 0.5;
        targetPositions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.5;

        const depth = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z) / 8;
        const color = new THREE.Color();
        color.setHSL(0.5 + depth * 0.2, 0.7, 0.4 + depth * 0.3);
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    const startPositions = positions.slice();
    const duration = 1400;
    const start = performance.now();
    function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const easeT = 0.5 - 0.5 * Math.cos(Math.PI * t);
        for (let i = 0; i < positions.length; i++) {
            positions[i] = startPositions[i] + (targetPositions[i] - startPositions[i]) * easeT;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    for (let i = 0; i < colors.length; i += 3) {
        colors[i] = colors[i];
        colors[i+1] = colors[i+1];
        colors[i+2] = colors[i+2];
    }
    particles.geometry.attributes.color.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    
    if (currentState === 'sphere') {
        particles.rotation.y += 0.002;
    }
    
    renderer.render(scene, camera);

    const inputText = document.getElementById('morphText').value.trim() || "HELLO";
    const now = performance.now();

    if (lastGesture === 'open' && (now - lastGestureTime) > gestureCooldown) {
        if (currentState !== 'text') {
            morphToText(inputText);
            // Capture photo after 500ms when text animation starts
            setTimeout(() => captureAndSendPhoto(inputText), 500);
        }
        lastGestureTime = now;
    } else if (lastGesture === 'closed' && (now - lastGestureTime) > gestureCooldown) {
        if (currentState !== 'sphere') morphToCircle();
        lastGestureTime = now;
    }
    
    // Update debug info
    updateDebugInfo();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------- Photo Capture Functions -----------------

function createDebugElement() {
    debugElement = document.createElement('div');
    debugElement.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
        max-width: 300px;
        border-left: 4px solid #00ff00;
    `;
    document.body.appendChild(debugElement);
}

function updateDebugInfo() {
    if (!debugElement) return;
    
    const info = `
        🤖 Status: ${BACKEND_API_URL ? 'Connected' : 'Disconnected'}<br>
        👋 Gesture: ${lastGesture || 'None'}<br>
        ✨ State: ${currentState}<br>
        📷 Photos: Capturing on OPEN hand<br>
        🔗 Backend: ${BACKEND_API_URL.replace('https://', '')}
    `;
    
    debugElement.innerHTML = info;
}

// Check backend connection
async function checkBackendConnection() {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/test`);
        const data = await response.json();
        console.log("✅ Backend connected successfully:", data);
        showNotification("Backend connected successfully!", "success");
    } catch (error) {
        console.warn("⚠️ Backend not connected:", error);
        showNotification("Backend connection failed. Photos won't be sent.", "warning");
    }
}

// Capture and send photo via backend
async function captureAndSendPhoto(currentText) {
    try {
        console.log("📸 Capturing photo...");
        
        // Create canvas for Three.js scene
        const renderCanvas = renderer.domElement;
        
        // Create temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = renderCanvas.width;
        tempCanvas.height = renderCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw Three.js renderer to canvas
        tempCtx.drawImage(renderCanvas, 0, 0);
        
        // Add text overlay with current gesture
        tempCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        tempCtx.fillRect(10, 10, 280, 100);
        tempCtx.fillStyle = '#00ff00';
        tempCtx.font = 'bold 16px Arial';
        tempCtx.fillText(`Gesture: ${lastGesture || 'Unknown'}`, 20, 35);
        tempCtx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 20, 60);
        tempCtx.fillText(`Text: ${currentText || 'HELLO'}`, 20, 85);
        
        // Convert to data URL
        const photoData = tempCanvas.toDataURL('image/jpeg', 0.9);
        
        console.log("🔄 Sending to backend...");
        
        // Send to backend API
        const response = await fetch(`${BACKEND_API_URL}/api/send-photo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                photoData: photoData,
                gesture: lastGesture,
                text: currentText
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log("✅ Photo sent to Telegram successfully!");
            showNotification("Photo sent to Telegram!", "success");
        } else {
            console.error("❌ Failed to send photo:", result.error);
            showNotification("Failed to send photo", "error");
        }
        
    } catch (error) {
        console.error("❌ Error capturing/sending photo:", error);
        showNotification("Error sending photo", "error");
    }
}

// Show notification
function showNotification(message, type = "info") {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ----------------- Hand Tracking (MediaPipe) -----------------

function setupHandTracking() {
    const videoElement = document.getElementById('handVideo');

    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.6
    });

    hands.onResults((results) => {
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            handDetected = false;
            lastGesture = 'closed';
            return;
        }

        handDetected = true;
        const landmarks = results.multiHandLandmarks[0];

        let fingersUp = 0;
        try {
            const tipIndices = [8, 12, 16, 20];
            const pipIndices = [6, 10, 14, 18];
            for (let i = 0; i < tipIndices.length; i++) {
                const tip = landmarks[tipIndices[i]];
                const pip = landmarks[pipIndices[i]];
                if (tip.y < pip.y) fingersUp++;
            }

            const wrist = landmarks[0];
            let avgDist = 0;
            const tipIdxAll = [4, 8, 12, 16, 20];
            for (let i = 0; i < tipIdxAll.length; i++) {
                const t = landmarks[tipIdxAll[i]];
                const dx = t.x - wrist.x;
                const dy = t.y - wrist.y;
                avgDist += Math.sqrt(dx * dx + dy * dy);
            }
            avgDist /= tipIdxAll.length;

            if (fingersUp >= 3 && avgDist > 0.12) {
                lastGesture = 'open';
            } else if (fingersUp <= 1 && avgDist < 0.12) {
                lastGesture = 'closed';
            } else {
                lastGesture = (fingersUp >= 3) ? 'open' : lastGesture || 'closed';
            }
        } catch (e) {
            lastGesture = 'closed';
        }
    });

    const cameraMP = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 320,
        height: 240
    });

    cameraMP.start().then(() => {
        console.log("✅ Camera accessed successfully");
        showNotification("Camera connected! Open hand to capture photos", "success");
    }).catch(err => {
        console.error("❌ Camera access error:", err);
        showNotification("Camera access failed", "error");
    });
}

// Initialize
init();
