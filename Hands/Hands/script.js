let scene, camera, renderer, particles, particleCount = 18000;
let currentShapeIndex = 0;
let isTransitioning = false;
let targetPositions = new Float32Array(particleCount * 3);

const videoElement = document.getElementById('video-preview');
const statusTxt = document.getElementById('status');

// --- EQUAÇÕES MATEMÁTICAS DAS FORMAS ---
const shapes = [
    { name: "Cubo", color: 0x00d4ff, func: () => ({ 
        x: (Math.random() - 0.5) * 16, y: (Math.random() - 0.5) * 16, z: (Math.random() - 0.5) * 16 
    })},
    { name: "Coração", color: 0xff3366, func: (i) => {
        const t = (i / particleCount) * Math.PI * 2 * 10;
        return {
            x: 0.6 * (16 * Math.pow(Math.sin(t), 3)),
            y: 0.6 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)),
            z: (Math.random() - 0.5) * 5
        };
    }},
    { name: "Planeta Terra", color: 0x22ffaa, func: (i) => {
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;
        return { x: 10 * Math.cos(theta) * Math.sin(phi), y: 10 * Math.sin(theta) * Math.sin(phi), z: 10 * Math.cos(phi) };
    }},
    { name: "Terra Aberta", color: 0xffaa00, func: (i) => {
        const phi = Math.acos(-1 + (2 * i) / particleCount);
        const theta = Math.sqrt(particleCount * Math.PI) * phi;
        let r = 10, y = 10 * Math.sin(theta) * Math.sin(phi);
        if (y > 0) { r = 13; y += 4; } // Afasta a metade de cima
        return { x: r * Math.cos(theta) * Math.sin(phi), y: y, z: r * Math.cos(phi) };
    }},
    { name: "Borboleta", color: 0xcc88ff, func: (i) => {
        const t = (i / particleCount) * Math.PI * 2 * 15;
        const r = Math.exp(Math.sin(t)) - 2 * Math.cos(4*t) + Math.pow(Math.sin((2*t - Math.PI)/24), 5);
        return { x: r * Math.sin(t) * 4, y: r * Math.cos(t) * 4, z: Math.sin(Date.now() * 0.002) * r * 2 };
    }}
];

function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    particles = new THREE.Points(geometry, new THREE.PointsMaterial({
        size: 0.07, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending
    }));
    
    scene.add(particles);
    camera.position.z = 35;
    updateTargetPositions();
}

function updateTargetPositions() {
    const colorArray = particles.geometry.attributes.color.array;
    const newCol = new THREE.Color(shapes[currentShapeIndex].color);
    for (let i = 0; i < particleCount; i++) {
        const p = shapes[currentShapeIndex].func(i);
        targetPositions[i*3] = p.x; targetPositions[i*3+1] = p.y; targetPositions[i*3+2] = p.z;
        colorArray[i*3] = newCol.r; colorArray[i*3+1] = newCol.g; colorArray[i*3+2] = newCol.b;
    }
    particles.geometry.attributes.color.needsUpdate = true;
}

window.changeShape = (index) => {
    currentShapeIndex = index;
    statusTxt.innerText = "FORMA: " + shapes[index].name;
    updateTargetPositions();
};

function onResults(results) {
    const posArray = particles.geometry.attributes.position.array;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const hand = results.multiHandLandmarks[0];
        
        // --- 1. PONTOS DE REFERÊNCIA ---
        const wrist = hand[0];      // Pulso
        const middleBase = hand[9]; // Base do dedo médio
        const indexTip = hand[8];   // Ponta do indicador
        const thumbTip = hand[4];   // Ponta do polegar
        const pinkyTip = hand[20];  // Ponta do mindinho

        // --- 2. LÓGICA DE ROTAÇÃO (VIRAR PARA QUALQUER LADO) ---
        // Calcula o ângulo da mão em relação ao pulso
        const rotY = (indexTip.x - 0.5) * Math.PI * 2; // Giro horizontal
        const rotX = (indexTip.y - 0.5) * Math.PI;     // Giro vertical
        
        // Aplicamos a rotação suavemente ao objeto de partículas
        particles.rotation.y += (rotY - particles.rotation.y) * 0.1;
        particles.rotation.x += (rotX - particles.rotation.x) * 0.1;

        // --- 3. POSIÇÃO E ZOOM (O que você já tinha) ---
        const targetX = (0.5 - indexTip.x) * 50;
        const targetY = (0.5 - indexTip.y) * 40;
        const handSize = Math.sqrt(
            Math.pow(thumbTip.x - pinkyTip.x, 2) + 
            Math.pow(thumbTip.y - pinkyTip.y, 2)
        );

        // --- 4. ATUALIZAR PARTÍCULAS ---
        for (let i = 0; i < particleCount; i++) {
            const ix = i * 3;
            const mult = handSize * 5; 
            
            // Aqui as partículas mantêm a forma original mas seguem o centro da mão
            posArray[ix] += (targetX + targetPositions[ix] * mult - posArray[ix]) * 0.1;
            posArray[ix+1] += (targetY + targetPositions[ix+1] * mult - posArray[ix+1]) * 0.1;
            posArray[ix+2] += (targetPositions[ix+2] * mult - posArray[ix+2]) * 0.1;
        }
        statusTxt.innerText = "CONTROLE TOTAL ATIVO";
    } else {
        statusTxt.innerText = "MOSTRAR MÃO PARA GIRAR";
        // Rotação automática lenta quando não há mão
        particles.rotation.y += 0.005;
    }
    particles.geometry.attributes.position.needsUpdate = true;
}

function initMediaPipe() {
    const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
    hands.setOptions({maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6});
    hands.onResults(onResults);
    new Camera(videoElement, {onFrame: async () => {await hands.send({image: videoElement})}, width: 640, height: 480}).start();
}

document.getElementById('start-btn').onclick = () => {
    document.getElementById('overlay').style.display = 'none';
    initThree(); initMediaPipe();
    (function animate() { requestAnimationFrame(animate); renderer.render(scene, camera); })();
};