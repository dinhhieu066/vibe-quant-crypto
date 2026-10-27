/**
 * POODLE 3D QUANT AGENT // Authentic Realistic 3D Poodle Mascot
 * Features:
 * - 3D Poodle Dog with authentic Teddy Bear cut & curly fur texture
 * - Big fluffy curly ears, teddy cheeks, crown topknot, and snout matching reference image
 * - Stylish glowing cyberpunk neon glasses & dark blue hoodie with golden Bitcoin medallion
 * - 100% SILENT visual dialogue (typewriter text typing in speech bubble, NO audio/sound voice)
 * - Interactive head tracking, breathing, blinking, ear bounce, and happy tail wagging
 * - Interactive petting & quick-chat buttons
 */

class Poodle3DAgent {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // 3D Model Groups
    this.poodleGroup = null;
    this.headGroup = null;
    this.jawMesh = null;
    this.tongueMesh = null;
    this.leftEye = null;
    this.rightEye = null;
    this.leftEyelid = null;
    this.rightEyelid = null;
    this.tailGroup = null;
    this.leftEar = null;
    this.rightEar = null;
    this.bodyMesh = null;

    // Animation & State
    this.isSpeaking = false;
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.blinkTimer = 0;
    this.nextBlink = 2.5;
    this.jumpOffset = 0;
    this.typewriterInterval = null;

    this.initThree();
    this.setupInteractions();
    this.animate();
  }

  // --- PROCEDURAL CURLY POODLE WOOL TEXTURE ---
  createPoodleFurTextures() {
    const size = 512;

    // 1. Color Map
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const cCtx = colorCanvas.getContext('2d');

    // Base warm apricot gradient
    const grad = cCtx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.7);
    grad.addColorStop(0, '#e69950');
    grad.addColorStop(0.5, '#da8b40');
    grad.addColorStop(1, '#c27329');
    cCtx.fillStyle = grad;
    cCtx.fillRect(0, 0, size, size);

    // Draw 1500 curly poodle ringlets
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 5 + Math.random() * 11;
      const startAngle = Math.random() * Math.PI * 2;
      const endAngle = startAngle + Math.PI * (1.1 + Math.random() * 0.8);

      // Deep curl shadow
      cCtx.beginPath();
      cCtx.arc(x + 1.2, y + 1.2, radius, startAngle, endAngle);
      cCtx.lineWidth = 2.4;
      cCtx.strokeStyle = 'rgba(110, 50, 10, 0.3)';
      cCtx.lineCap = 'round';
      cCtx.stroke();

      // Fluffy golden curly highlight
      cCtx.beginPath();
      cCtx.arc(x, y, radius, startAngle, endAngle);
      cCtx.lineWidth = 1.8;
      const tones = ['#f5b372', '#ffcca0', '#e09146', '#fcd2a8', '#ffdcb8'];
      cCtx.strokeStyle = tones[Math.floor(Math.random() * tones.length)];
      cCtx.stroke();
    }

    const furColorMap = new THREE.CanvasTexture(colorCanvas);
    furColorMap.wrapS = THREE.RepeatWrapping;
    furColorMap.wrapT = THREE.RepeatWrapping;
    furColorMap.repeat.set(3, 3);

    // 2. Bump Map (for genuine 3D tactile curly hair feel)
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d');
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 5 + Math.random() * 11;
      const startAngle = Math.random() * Math.PI * 2;
      const endAngle = startAngle + Math.PI * 1.3;

      bCtx.beginPath();
      bCtx.arc(x + 1, y + 1, radius, startAngle, endAngle);
      bCtx.lineWidth = 2.6;
      bCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      bCtx.stroke();

      bCtx.beginPath();
      bCtx.arc(x, y, radius, startAngle, endAngle);
      bCtx.lineWidth = 2;
      bCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      bCtx.stroke();
    }

    const furBumpMap = new THREE.CanvasTexture(bumpCanvas);
    furBumpMap.wrapS = THREE.RepeatWrapping;
    furBumpMap.wrapT = THREE.RepeatWrapping;
    furBumpMap.repeat.set(3, 3);

    return { furColorMap, furBumpMap };
  }

  initThree() {
    const width = this.container.clientWidth || 240;
    const height = this.container.clientHeight || 240;

    // Scene & Perspective Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    this.camera.position.set(0, 0.12, 3.4);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xfff6ea, 1.25);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffeed6, 1.6);
    keyLight.position.set(3.5, 4.5, 4);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    const cyanRim = new THREE.PointLight(0x00f2fe, 2.5, 7);
    cyanRim.position.set(-2.4, 1.6, -1.8);
    this.scene.add(cyanRim);

    const warmFill = new THREE.PointLight(0xff9900, 1.6, 6);
    warmFill.position.set(2.4, -0.6, 2.2);
    this.scene.add(warmFill);

    // Build the 3D Poodle Character
    this.buildPoodleModel();

    window.addEventListener('resize', () => this.onResize());
  }

  buildPoodleModel() {
    this.poodleGroup = new THREE.Group();
    this.poodleGroup.position.y = -0.22;

    const { furColorMap, furBumpMap } = this.createPoodleFurTextures();

    // 1. Realistic Curly Poodle Fur Material
    const furMaterial = new THREE.MeshStandardMaterial({
      map: furColorMap,
      bumpMap: furBumpMap,
      bumpScale: 0.1,
      roughness: 0.88,
      metalness: 0.02
    });

    // Lighter fluffy crown & cheek highlights
    const furFluffMaterial = new THREE.MeshStandardMaterial({
      map: furColorMap,
      bumpMap: furBumpMap,
      bumpScale: 0.08,
      roughness: 0.82,
      metalness: 0.02
    });

    // Dark Navy Cyber Hoodie (matching reference poodle.jpg)
    const hoodieMaterial = new THREE.MeshStandardMaterial({
      color: 0x141c2e,
      roughness: 0.6,
      metalness: 0.15
    });

    const hoodieRibMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c121e,
      roughness: 0.75,
      metalness: 0.1
    });

    // Gold Bitcoin Medallion
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.22,
      metalness: 0.9
    });

    // Big Glossy Puppy Eyes
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x050403,
      roughness: 0.05,
      metalness: 0.95
    });
    const glintMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Poodle Leather Nose
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0x16100b,
      roughness: 0.2,
      metalness: 0.25
    });

    // Cute Pink Tongue
    const tongueMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4071,
      roughness: 0.35
    });

    // Neon Glasses Frames (Cyan-Purple Gradient matching poodle.jpg)
    const neonFrameMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x7c3aed,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.8
    });

    const neonLensMat = new THREE.MeshPhysicalMaterial({
      color: 0xa855f7,
      transmission: 0.9,
      opacity: 0.7,
      transparent: true,
      roughness: 0.08,
      ior: 1.52
    });

    // --- 1. LUXURY TRADING DESK CUSHION ---
    const cushionGeo = new THREE.CylinderGeometry(1.45, 1.6, 0.22, 36);
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.5,
      metalness: 0.45
    });
    const cushion = new THREE.Mesh(cushionGeo, cushionMat);
    cushion.position.y = -0.96;
    this.poodleGroup.add(cushion);

    // Glowing Cyan Torus Ring
    const neonRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.035, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0x00f2fe })
    );
    neonRing.rotation.x = Math.PI / 2;
    neonRing.position.y = -0.84;
    this.poodleGroup.add(neonRing);

    // --- 2. BODY IN DARK NAVY HOODIE ---
    const bodyGeo = new THREE.SphereGeometry(0.76, 26, 26);
    bodyGeo.scale(0.95, 1.15, 0.92);
    this.bodyMesh = new THREE.Mesh(bodyGeo, hoodieMaterial);
    this.bodyMesh.position.y = -0.18;
    this.poodleGroup.add(this.bodyMesh);

    // Hoodie collar / hood trim around neck
    const hoodTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.12, 16, 32),
      hoodieRibMaterial
    );
    hoodTrim.rotation.x = Math.PI / 2.2;
    hoodTrim.position.set(0, 0.22, 0.02);
    this.poodleGroup.add(hoodTrim);

    // Drawstring cords
    const cordGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8);
    const leftCord = new THREE.Mesh(cordGeo, new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
    leftCord.position.set(-0.16, 0.08, 0.62);
    leftCord.rotation.z = -0.15;
    this.poodleGroup.add(leftCord);

    const rightCord = new THREE.Mesh(cordGeo, new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
    rightCord.position.set(0.16, 0.08, 0.62);
    rightCord.rotation.z = 0.15;
    this.poodleGroup.add(rightCord);

    // Large Golden Bitcoin Medallion on chest
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 28), goldMaterial);
    crest.rotation.x = Math.PI / 2.3;
    crest.position.set(0, -0.05, 0.72);
    this.poodleGroup.add(crest);

    // Front Paws (Fluffy curly poodle paws resting on cushion)
    const pawGeo = new THREE.SphereGeometry(0.25, 18, 18);
    pawGeo.scale(1, 0.65, 1.4);

    const leftPaw = new THREE.Mesh(pawGeo, furMaterial);
    leftPaw.position.set(-0.36, -0.76, 0.62);
    this.poodleGroup.add(leftPaw);

    const rightPaw = new THREE.Mesh(pawGeo, furMaterial);
    rightPaw.position.set(0.36, -0.76, 0.62);
    this.poodleGroup.add(rightPaw);

    // --- 3. WAGGING FLUFFY POODLE TAIL ---
    this.tailGroup = new THREE.Group();
    this.tailGroup.position.set(0, -0.28, -0.68);

    const tailStem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.36, 12), furMaterial);
    tailStem.position.y = 0.18;
    tailStem.rotation.x = -Math.PI / 4;
    this.tailGroup.add(tailStem);

    // Fluffy pom-pom on tail
    const tailPuff = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 18), furFluffMaterial);
    tailPuff.position.set(0, 0.38, -0.24);
    this.tailGroup.add(tailPuff);

    this.poodleGroup.add(this.tailGroup);

    // --- 4. HEAD GROUP (Dynamic look-at & lifelike puppy tilt) ---
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.72, 0.08);

    // Main Head Sphere
    const headGeo = new THREE.SphereGeometry(0.68, 28, 28);
    const headMesh = new THREE.Mesh(headGeo, furMaterial);
    this.headGroup.add(headMesh);

    // Signature Poodle Crown Topknot (Fluffy curly cloud on top)
    const crownCenter = new THREE.Mesh(new THREE.SphereGeometry(0.48, 22, 22), furFluffMaterial);
    crownCenter.scale.set(1.08, 1.28, 1);
    crownCenter.position.set(0, 0.58, -0.04);
    this.headGroup.add(crownCenter);

    // Additional curl clusters for authentic curly poodle volume
    [
      [-0.24, 0.64, 0.08, 0.28],
      [0.24, 0.64, 0.08, 0.28],
      [0, 0.76, -0.12, 0.32],
      [-0.18, 0.54, -0.25, 0.28],
      [0.18, 0.54, -0.25, 0.28]
    ].forEach(([cx, cy, cz, cr]) => {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(cr, 14, 14), furFluffMaterial);
      curl.position.set(cx, cy, cz);
      this.headGroup.add(curl);
    });

    // Chubby Poodle Cheeks (Teddy Bear cut)
    const cheekGeo = new THREE.SphereGeometry(0.36, 18, 18);
    cheekGeo.scale(1.15, 0.95, 1);

    const leftCheek = new THREE.Mesh(cheekGeo, furFluffMaterial);
    leftCheek.position.set(-0.38, -0.14, 0.38);
    this.headGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, furFluffMaterial);
    rightCheek.position.set(0.38, -0.14, 0.38);
    this.headGroup.add(rightCheek);

    // Fluffy Rounded Snout / Muzzle
    const snoutGeo = new THREE.SphereGeometry(0.36, 22, 22);
    snoutGeo.scale(1.1, 0.88, 1.35);
    const snoutMesh = new THREE.Mesh(snoutGeo, furFluffMaterial);
    snoutMesh.position.set(0, -0.1, 0.54);
    this.headGroup.add(snoutMesh);

    // Poodle Nose (Realistic black leather puppy button nose)
    const noseGeo = new THREE.SphereGeometry(0.13, 16, 16);
    noseGeo.scale(1.25, 0.82, 0.95);
    const noseMesh = new THREE.Mesh(noseGeo, noseMaterial);
    noseMesh.position.set(0, -0.02, 0.93);
    this.headGroup.add(noseMesh);

    // --- 5. MOUTH & JAW (Animated during typewriter dialogue) ---
    this.jawMesh = new THREE.Group();
    this.jawMesh.position.set(0, -0.22, 0.46);

    const lowerJawGeo = new THREE.SphereGeometry(0.24, 16, 16);
    lowerJawGeo.scale(0.85, 0.42, 0.95);
    const lowerJaw = new THREE.Mesh(lowerJawGeo, furMaterial);
    lowerJaw.position.set(0, -0.04, 0.16);
    this.jawMesh.add(lowerJaw);

    const tongueGeo = new THREE.BoxGeometry(0.14, 0.04, 0.24);
    this.tongueMesh = new THREE.Mesh(tongueGeo, tongueMaterial);
    this.tongueMesh.position.set(0, 0.01, 0.18);
    this.jawMesh.add(this.tongueMesh);

    this.headGroup.add(this.jawMesh);

    // --- 6. BIG SOULFUL GLOSSY PUPPY EYES ---
    const eyeGeo = new THREE.SphereGeometry(0.155, 22, 22);

    this.leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    this.leftEye.position.set(-0.25, 0.16, 0.58);
    // Double Pixar specular glints
    const glint1 = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), glintMaterial);
    glint1.position.set(-0.038, 0.048, 0.13);
    this.leftEye.add(glint1);
    const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), glintMaterial);
    glint2.position.set(0.042, -0.032, 0.13);
    this.leftEye.add(glint2);
    this.headGroup.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    this.rightEye.position.set(0.25, 0.16, 0.58);
    const glint3 = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), glintMaterial);
    glint3.position.set(-0.038, 0.048, 0.13);
    this.rightEye.add(glint3);
    const glint4 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), glintMaterial);
    glint4.position.set(0.042, -0.032, 0.13);
    this.rightEye.add(glint4);
    this.headGroup.add(this.rightEye);

    // Blinking Eyelids
    const eyelidGeo = new THREE.SphereGeometry(0.165, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.5);
    this.leftEyelid = new THREE.Mesh(eyelidGeo, furMaterial);
    this.leftEyelid.position.copy(this.leftEye.position);
    this.leftEyelid.rotation.x = -Math.PI / 2;
    this.leftEyelid.visible = false;
    this.headGroup.add(this.leftEyelid);

    this.rightEyelid = new THREE.Mesh(eyelidGeo, furMaterial);
    this.rightEyelid.position.copy(this.rightEye.position);
    this.rightEyelid.rotation.x = -Math.PI / 2;
    this.rightEyelid.visible = false;
    this.headGroup.add(this.rightEyelid);

    // --- 7. STYLISH GLOWING NEON GLASSES (From poodle.jpg reference) ---
    const glassesGroup = new THREE.Group();
    glassesGroup.position.set(0, 0.16, 0.66);

    // Curved neon rectangular frames
    const frameGeo = new THREE.TorusGeometry(0.2, 0.028, 12, 32);

    const rimLeft = new THREE.Mesh(frameGeo, neonFrameMat);
    rimLeft.position.x = -0.25;
    rimLeft.scale.set(1.15, 0.88, 1);
    glassesGroup.add(rimLeft);

    const lensLeft = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24), neonLensMat);
    lensLeft.position.set(-0.25, 0, 0.01);
    lensLeft.scale.set(1.15, 0.88, 1);
    glassesGroup.add(lensLeft);

    const rimRight = new THREE.Mesh(frameGeo, neonFrameMat);
    rimRight.position.x = 0.25;
    rimRight.scale.set(1.15, 0.88, 1);
    glassesGroup.add(rimRight);

    const lensRight = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24), neonLensMat);
    lensRight.position.set(0.25, 0, 0.01);
    lensRight.scale.set(1.15, 0.88, 1);
    glassesGroup.add(lensRight);

    // Neon Bridge
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.026, 0.02), neonFrameMat);
    bridge.position.set(0, 0.04, 0);
    glassesGroup.add(bridge);

    this.headGroup.add(glassesGroup);

    // --- 8. AUTHENTIC LONG WAVY POODLE EARS (Matching poodle.jpg) ---
    // Left Ear
    this.leftEar = new THREE.Group();
    this.leftEar.position.set(-0.58, 0.38, -0.02);

    const earCluster1 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), furMaterial);
    earCluster1.scale.set(0.72, 1.35, 0.85);
    earCluster1.position.y = -0.24;
    this.leftEar.add(earCluster1);

    const earCluster2 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), furFluffMaterial);
    earCluster2.scale.set(0.85, 1.25, 0.9);
    earCluster2.position.set(-0.04, -0.58, 0.05);
    this.leftEar.add(earCluster2);

    const earCluster3 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), furFluffMaterial);
    earCluster3.scale.set(0.9, 1.1, 0.95);
    earCluster3.position.set(-0.06, -0.88, 0.08);
    this.leftEar.add(earCluster3);

    this.leftEar.rotation.z = 0.24;
    this.leftEar.rotation.x = 0.08;
    this.headGroup.add(this.leftEar);

    // Right Ear
    this.rightEar = new THREE.Group();
    this.rightEar.position.set(0.58, 0.38, -0.02);

    const rEarCluster1 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), furMaterial);
    rEarCluster1.scale.set(0.72, 1.35, 0.85);
    rEarCluster1.position.y = -0.24;
    this.rightEar.add(rEarCluster1);

    const rEarCluster2 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), furFluffMaterial);
    rEarCluster2.scale.set(0.85, 1.25, 0.9);
    rEarCluster2.position.set(0.04, -0.58, 0.05);
    this.rightEar.add(rEarCluster2);

    const rEarCluster3 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), furFluffMaterial);
    rEarCluster3.scale.set(0.9, 1.1, 0.95);
    rEarCluster3.position.set(0.06, -0.88, 0.08);
    this.rightEar.add(rEarCluster3);

    this.rightEar.rotation.z = -0.24;
    this.rightEar.rotation.x = 0.08;
    this.headGroup.add(this.rightEar);

    this.poodleGroup.add(this.headGroup);
    this.scene.add(this.poodleGroup);
  }

  // --- 100% SILENT VISUAL SPEECH SYSTEM (TEXT DIALOGUE ONLY, NO AUDIO SOUND) ---
  speak(text, onComplete) {
    if (!text) return;

    // Cancel prior typewriter
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }

    const speechEl = document.getElementById('poodle-speech');
    const indicatorEl = document.getElementById('poodle-soundwave');

    this.setSpeaking(true);
    if (indicatorEl) indicatorEl.classList.add('active');

    const cleanText = text.replace(/<[^>]*>?/gm, '');
    let charIndex = 0;

    if (speechEl) {
      speechEl.innerHTML = '"<span class="type-cursor">▌</span>"';
    }

    // Smooth typewriter animation (24ms per character)
    this.typewriterInterval = setInterval(() => {
      charIndex++;
      const current = cleanText.substring(0, charIndex);
      if (speechEl) {
        speechEl.innerHTML = `"${current}<span class="type-cursor">▌</span>"`;
      }

      if (charIndex >= cleanText.length) {
        clearInterval(this.typewriterInterval);
        this.typewriterInterval = null;
        if (speechEl) {
          speechEl.innerHTML = `"${cleanText}"`;
        }

        setTimeout(() => {
          this.setSpeaking(false);
          if (indicatorEl) indicatorEl.classList.remove('active');
          if (onComplete) onComplete();
        }, 1200);
      }
    }, 24);
  }

  setSpeaking(flag) {
    this.isSpeaking = flag;
    if (!flag && this.jawMesh) {
      this.jawMesh.rotation.x = 0;
    }
  }

  ensureAudioContext() {
    // Silent mode - no audio context required
  }

  toggleMute() {
    // Keep silent
    return true;
  }

  // Petting / Interactive Click Reaction
  petPoodle() {
    this.jumpOffset = 0.24; // Joyful 3D hop

    const remarks = [
      'Gâu! Em Poodle xin chào sếp! Em đang canh chừng thị trường Binance 24/7 cho sếp!',
      'Sếp cứ yên tâm uống trà nhé, toàn bộ hơn 400 đồng coin đang được em quét liên tục từng giây!',
      'Em Poodle chọn lọc kỹ lắm nha sếp, chỉ kèo nào điểm trên 78 em mới ngoạm thôi!',
      'Khi lãi đạt +1.0%, em tự động kéo Stop Loss về hòa vốn, tài sản của sếp an toàn 100%!',
      'Em thích được sếp xoa đầu lắm nè! Chúc sếp hôm nay bội thu lãi thụ động nha!'
    ];
    const picked = remarks[Math.floor(Math.random() * remarks.length)];
    this.speak(picked);
  }

  // --- INTERACTION & EVENT LISTENERS ---
  setupInteractions() {
    // Mouse tracking for head look-at with subtle puppy tilt
    window.addEventListener('mousemove', e => {
      const rect = this.container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      this.mouse.targetX = (e.clientX - cx) / (window.innerWidth * 0.45);
      this.mouse.targetY = (e.clientY - cy) / (window.innerHeight * 0.45);
    });

    // Petting / Clicking the 3D Poodle
    this.container.addEventListener('click', () => {
      this.petPoodle();
    });

    // Touch device support
    this.container.addEventListener('touchstart', () => {
      this.petPoodle();
    }, { passive: true });
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || 240;
    const height = this.container.clientHeight || 240;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --- REAL-TIME 3D RENDER & ANIMATION LOOP ---
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Smooth mouse tracking with cute puppy head tilt
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.08;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.08;

    if (this.headGroup) {
      this.headGroup.rotation.y = this.mouse.x * 0.52;
      this.headGroup.rotation.x = -this.mouse.y * 0.32;
      // Inquisitive puppy head-tilt
      this.headGroup.rotation.z = -this.mouse.x * 0.18;

      // Floppy ear dynamic swinging inertia
      if (this.leftEar && this.rightEar) {
        const earSway = Math.sin(time * 3) * 0.04;
        this.leftEar.rotation.z = 0.24 + earSway + this.mouse.x * 0.18;
        this.rightEar.rotation.z = -0.24 - earSway + this.mouse.x * 0.18;
      }
    }

    // 2. Idle Organic Breathing
    if (this.bodyMesh) {
      this.bodyMesh.scale.y = 1.15 + Math.sin(time * 2.2) * 0.02;
    }

    // 3. Tail Wagging (Speeds up excitedly when active/speaking)
    if (this.tailGroup) {
      const wagSpeed = this.isSpeaking ? 16 : 8;
      const wagAmp = this.isSpeaking ? 0.48 : 0.28;
      this.tailGroup.rotation.y = Math.sin(time * wagSpeed) * wagAmp;
    }

    // 4. Natural Eye Blinking
    this.blinkTimer += delta;
    if (this.blinkTimer > this.nextBlink) {
      if (this.leftEye && this.rightEye) {
        this.leftEye.scale.y = 0.12;
        this.rightEye.scale.y = 0.12;
      }
      if (this.blinkTimer > this.nextBlink + 0.12) {
        if (this.leftEye && this.rightEye) {
          this.leftEye.scale.y = 1;
          this.rightEye.scale.y = 1;
        }
        this.blinkTimer = 0;
        this.nextBlink = 2.4 + Math.random() * 3.2;
      }
    }

    // 5. Talking Animation (Flap jaw gently in sync with typewriter text)
    if (this.isSpeaking && this.jawMesh) {
      const flap = Math.abs(Math.sin(time * 16)) * 0.32;
      this.jawMesh.rotation.x = -flap;
      if (this.headGroup) {
        this.headGroup.position.y = 0.72 + Math.sin(time * 16) * 0.015;
      }
    } else if (this.headGroup) {
      this.headGroup.position.y = 0.72;
    }

    // 6. Joyful Jump / Petting Recovery
    if (this.jumpOffset > 0) {
      this.poodleGroup.position.y = -0.22 + this.jumpOffset;
      this.jumpOffset -= delta * 0.95;
      if (this.jumpOffset < 0) this.jumpOffset = 0;
    } else {
      // Gentle floating hover
      this.poodleGroup.position.y = -0.22 + Math.sin(time * 1.8) * 0.025;
    }

    // Render Scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// Global instance handle
window.Poodle3D = Poodle3DAgent;
