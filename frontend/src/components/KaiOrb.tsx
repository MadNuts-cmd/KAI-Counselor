import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OperationalState, AffectiveState } from '../types/events';
import { audioManager } from '../services/audioManager';

interface KaiOrbProps {
  operationalState: OperationalState;
  affectiveState: AffectiveState;
  isAudioPlaying: boolean;
  className?: string;
}

export const KaiOrb: React.FC<KaiOrbProps> = ({
  operationalState,
  affectiveState,
  isAudioPlaying,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Keep latest props in a ref so the animation loop always reads current state
  // without tearing down and recreating the WebGL scene/context on every re-render.
  const stateRef = useRef({ operationalState, affectiveState, isAudioPlaying });
  useEffect(() => {
    stateRef.current = { operationalState, affectiveState, isAudioPlaying };
  }, [operationalState, affectiveState, isAudioPlaying]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera & WebGL Renderer
    const scene = new THREE.Scene();
    const width = container.clientWidth || 550;
    const height = container.clientHeight || 550;

    // Camera at z=5.0 with 38-deg FOV provides refined sizing with ample dark negative space
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.z = 5.0;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0); // Pure black canvas backing
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Dual-Layer Point Cloud Distribution (~20,000 Points)
    // Layer 1 (Outer Veil): ~13,000 points forming the flowing translucent undulating outer crests
    // Layer 2 (Inner Core): ~7,000 points forming the glowing deep violet/magenta internal field
    // Matching the exact translucent nested folds of the reference image.
    const numOuter = 13000;
    const numInner = 7000;
    const totalPoints = numOuter + numInner;

    const positions = new Float32Array(totalPoints * 3);
    const normals = new Float32Array(totalPoints * 3);
    const layers = new Float32Array(totalPoints);
    const randoms = new Float32Array(totalPoints);

    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.399963 rad

    // Generate Outer Veil Shell
    for (let i = 0; i < numOuter; i++) {
      const y = 1 - 2 * ((i + 0.5) / numOuter);
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * goldenAngle;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      const rOffset = ((i % 17) / 17 - 0.5) * 0.05;
      const r = 1.06 + rOffset;

      positions[i * 3] = x * r;
      positions[i * 3 + 1] = y * r * 0.85; // Subtle oblate flattening
      positions[i * 3 + 2] = z * r;

      normals[i * 3] = x;
      normals[i * 3 + 1] = y;
      normals[i * 3 + 2] = z;

      layers[i] = 1.0; // Outer veil layer
      randoms[i] = (Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1.0;
    }

    // Generate Inner Core Membrane
    for (let j = 0; j < numInner; j++) {
      const idx = numOuter + j;
      const y = 1 - 2 * ((j + 0.5) / numInner);
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = j * goldenAngle + 1.25;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      const rOffset = ((j % 13) / 13 - 0.5) * 0.04;
      const r = 0.82 + rOffset;

      positions[idx * 3] = x * r;
      positions[idx * 3 + 1] = y * r * 0.85;
      positions[idx * 3 + 2] = z * r;

      normals[idx * 3] = x;
      normals[idx * 3 + 1] = y;
      normals[idx * 3 + 2] = z;

      layers[idx] = 0.0; // Inner core layer
      randoms[idx] = (Math.sin(idx * 12.9898 + 78.233) * 43758.5453) % 1.0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    // 3. Custom GLSL Shader with Rich Harmonic Folds & Decoupled Audio Amplitude
    const vertexShader = `
      uniform float uTime;
      uniform float uAudioEnvelope; // Asymmetrically smoothed audio amplitude [0, 1]
      uniform float uBass;          // Low-frequency band [0, 1]
      uniform float uMid;           // Mid-frequency band [0, 1]
      uniform float uTreble;        // High-frequency band [0, 1]
      uniform float uStateWeight;   // 0=idle, 1=listening, 2=thinking, 3=speaking
      uniform float uViewportHeight;

      attribute float aLayer;       // 1.0 = outer veil, 0.0 = inner core
      attribute float aRandom;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vDisplacement;
      varying float vHeight;
      varying float vLayer;

      void main() {
        vNormal = normal;
        vPosition = position;
        vLayer = aLayer;
        vHeight = position.y / 1.06;

        vec3 p0 = normalize(position);

        // 1. Multi-frequency spatial displacement field (macro undulations)
        // Kept at slow, majestic temporal speeds (0.35 - 0.48 rad/s)
        float w1 = 0.16 * sin(1.7 * p0.x + 1.3 * p0.y + 0.40 * uTime);
        float w2 = 0.14 * sin(1.6 * p0.y - 1.8 * p0.z - 0.35 * uTime + 1.3);
        float w3 = 0.12 * sin(1.8 * p0.z + 1.7 * p0.x + 0.46 * uTime + 2.7);
        float macroWave = w1 + w2 + w3;

        // 2. Harmonic organic ridges and saddle folds
        // Non-linear cross products produce flowing ribbon-like folds matching reference
        float fold1 = 0.12 * sin(3.2 * p0.x + 2.4 * p0.z + 0.52 * uTime) * cos(2.7 * p0.y - 2.1 * p0.x - 0.38 * uTime);
        float fold2 = 0.09 * sin(3.6 * p0.y + 2.8 * p0.z - 0.48 * uTime + 1.1) * cos(3.0 * p0.z + 2.5 * p0.x + 0.42 * uTime);
        float fold3 = 0.06 * sin(4.5 * p0.x + 3.8 * p0.y - 3.2 * p0.z + 0.55 * uTime);
        float organicFolds = fold1 + fold2 + fold3;

        // Inner core undergoes slightly softer folds to sit elegantly inside outer veil
        float layerScale = mix(0.78, 1.0, aLayer);

        // 3. Audio-reactive surface wave amplitude
        // Purely drives wave HEIGHT / AMPLITUDE, keeping wave temporal frequency slow and fluid
        float audioWave1 = sin(2.2 * p0.x + 2.4 * p0.y + 0.60 * uTime);
        float audioWave2 = cos(2.6 * p0.y - 2.2 * p0.z - 0.50 * uTime);
        float audioWave3 = sin(3.4 * p0.z + 2.8 * p0.x + 0.68 * uTime);
        float audioFolds = sin(4.2 * p0.x + 3.5 * p0.z + 0.58 * uTime) * cos(3.8 * p0.y - 2.5 * p0.x - 0.45 * uTime);
        
        float audioStructure = audioWave1 * 0.35 + audioWave2 * 0.30 + audioWave3 * 0.20 + audioFolds * 0.15;
        float audioDeform = uAudioEnvelope * (0.38 * audioStructure + 0.15 * uBass * sin(1.6 * p0.y + 0.45 * uTime));

        // Combined radial displacement
        float totalDisp = (macroWave + organicFolds) * layerScale + audioDeform;
        vDisplacement = totalDisp;

        // Displace radially from base position
        float currentRadius = mix(0.82, 1.06, aLayer);
        vec3 displacedPos = p0 * (currentRadius + totalDisp);

        vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Exact perspective point size calculation:
        // Individual luminous beads (~3.0px to 4.8px on screen)
        // Outer veil points are fine and crisply defined; inner core is slightly softer
        float basePointSize = mix(3.2, 3.6, aLayer) + (totalDisp * 0.45) + (uAudioEnvelope * 0.65);
        gl_PointSize = basePointSize * (5.0 / -mvPosition.z) * (uViewportHeight / 600.0);
        gl_PointSize = clamp(gl_PointSize, 1.6, 7.5);
      }
    `;

    const fragmentShader = `
      uniform vec3 uColorCyan;
      uniform vec3 uColorBlue;
      uniform vec3 uColorViolet;
      uniform vec3 uColorMagenta;
      uniform vec3 uColorRose;

      uniform float uAudioEnvelope;
      uniform float uEmpathetic;

      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vDisplacement;
      varying float vHeight;
      varying float vLayer;

      void main() {
        // Circular point sprite profile: crisp luminous core with soft edge
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        // Controlled radial falloff: bright bead core (0 to 0.22) with localized glow (0.22 to 0.48)
        float core = smoothstep(0.48, 0.05, dist);
        float bead = smoothstep(0.24, 0.0, dist);
        float alpha = core * 0.70 + bead * 0.30;

        // Normalized vertical position [-1.0 bottom, 1.0 top]
        float normY = clamp((vHeight + 1.0) * 0.5, 0.0, 1.0);

        // Bottom gradient: Vibrant fuchsia-magenta into rich luminous violet
        vec3 bottomGrad = mix(uColorMagenta, uColorViolet, smoothstep(-0.85, -0.05, vHeight));

        // Top gradient: Royal azure blue into brilliant electric cyan
        vec3 topGrad = mix(uColorBlue, uColorCyan, smoothstep(-0.10, 0.80, vHeight));

        // Surface blend modulated by wave displacement
        float blend = smoothstep(0.18, 0.72, normY + vDisplacement * 0.35);
        vec3 color = mix(bottomGrad, topGrad, blend);

        // Layer-dependent color modulation:
        // Inner core (vLayer = 0) has glowing violet/magenta and soft lavender
        // Outer veil (vLayer = 1) has shimmering cyan crests and azure blue contours
        if (vLayer < 0.5) {
          vec3 innerGrad = mix(uColorMagenta, uColorViolet, normY * 0.8 + 0.1);
          color = mix(innerGrad, uColorBlue, smoothstep(0.3, 0.9, vHeight) * 0.45);
          alpha *= 0.82;
        } else {
          // Asymmetric lateral fold accent (violet/magenta underside on left side matching reference)
          float leftUnderside = smoothstep(0.1, -0.55, vPosition.x / 1.06) * smoothstep(0.35, -0.75, vHeight);
          color = mix(color, uColorMagenta, leftUnderside * 0.52);

          // Ridge crest luminescence: wave peaks catch luminous cyan highlights
          float crestGlow = smoothstep(0.16, 0.50, vDisplacement);
          color = mix(color, uColorCyan, crestGlow * 0.38);
        }

        // Luminous bead highlight in dot center
        color += vec3(0.12, 0.18, 0.28) * bead;

        // Empathetic state modifier: gentle lavender-rose warmth along crests
        if (uEmpathetic > 0.02) {
          color = mix(color, uColorRose, uEmpathetic * 0.32 * (1.0 - abs(vHeight)));
        }

        // Voice luminescence boost: subtle highlight without channel clipping
        color += vec3(0.04, 0.08, 0.12) * uAudioEnvelope;

        // Soft tone mapping to keep colors deeply saturated and avoid channel blowout
        color = color / (1.0 + color * 0.15);

        gl_FragColor = vec4(color, alpha);
      }
    `;

    const uniforms = {
      uTime: { value: 0 },
      uAudioEnvelope: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uStateWeight: { value: 0.0 },
      uEmpathetic: { value: 0.0 },
      uViewportHeight: { value: height },
      // Reference-aligned palette:
      uColorCyan: { value: new THREE.Color('#00F5FF') },     // Electric Cyan
      uColorBlue: { value: new THREE.Color('#2563EB') },     // Royal Azure Blue
      uColorViolet: { value: new THREE.Color('#8B5CF6') },   // Luminous Violet
      uColorMagenta: { value: new THREE.Color('#D946EF') },  // Vibrant Magenta/Fuchsia
      uColorRose: { value: new THREE.Color('#F472B6') },     // Soft Lavender Rose
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    materialRef.current = material;

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Initial slight dimensional perspective tilt matching reference image
    points.rotation.x = 0.24;
    points.rotation.y = 0.32;

    // 4. Stable Monotonic Animation Loop with Independent Speed & Envelope Follower
    let lastTime = performance.now();
    let accumulatedTime = 0;
    let smoothedSpeed = 0.65;
    let smoothedStateWeight = 0;
    let smoothedEmpathetic = 0;

    // Asymmetric audio envelope follower states
    let audioEnv = 0;
    let audioBass = 0;
    let audioMid = 0;
    let audioTreble = 0;

    const animate = (currentTime: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const { operationalState: opState, affectiveState: affState, isAudioPlaying: audioActive } = stateRef.current;

      // Real-time audio metrics from Web Audio API Analyser
      const metrics = audioManager.getMetrics();
      const isSpeaking = opState === 'speaking' || audioActive || metrics.isPlaying;

      // 1. Asymmetric Audio Envelope Follower:
      // Fast attack (~40ms) to track vocal syllables immediately,
      // Slower release (~250ms) for smooth, natural decay between words.
      let activeIntensity = metrics.intensity;
      let activeBass = metrics.bass;
      let activeMid = metrics.mid;
      let activeTreble = metrics.treble;

      // Ensure robust speech undulation even if analyser frames are delayed or on fallback
      if (isSpeaking && activeIntensity < 0.05) {
        activeIntensity = 0.40;
        activeBass = 0.34;
        activeMid = 0.36;
        activeTreble = 0.28;
      }

      const rawIntensity = isSpeaking ? activeIntensity : 0.0;
      const rawBass = isSpeaking ? activeBass : 0.0;
      const rawMid = isSpeaking ? activeMid : 0.0;
      const rawTreble = isSpeaking ? activeTreble : 0.0;

      const attackCoef = 1.0 - Math.exp(-deltaTime * 22.0);
      const releaseCoef = 1.0 - Math.exp(-deltaTime * 4.0);

      audioEnv += (rawIntensity - audioEnv) * (rawIntensity > audioEnv ? attackCoef : releaseCoef);
      audioBass += (rawBass - audioBass) * (rawBass > audioBass ? attackCoef : releaseCoef);
      audioMid += (rawMid - audioMid) * (rawMid > audioMid ? attackCoef : releaseCoef);
      audioTreble += (rawTreble - audioTreble) * (rawTreble > audioTreble ? attackCoef : releaseCoef);

      // 2. Monotonic Phase Integration (Decoupled from fluctuating audio):
      // Temporal wave speed is smooth and slow across all states!
      // Idle/listening: 0.65 rad/s, Thinking: 1.05 rad/s, Speaking: 0.72 rad/s.
      let targetSpeed = 0.65;
      if (opState === 'thinking' || opState === 'generating_speech') {
        targetSpeed = 1.05;
      } else if (isSpeaking) {
        targetSpeed = 0.72;
      }

      smoothedSpeed += (targetSpeed - smoothedSpeed) * (1.0 - Math.exp(-deltaTime * 3.0));
      accumulatedTime += deltaTime * smoothedSpeed;

      // 3. Operational State & Affective Smoothing
      let targetStateWeight = 0;
      if (opState === 'listening') targetStateWeight = 1.0;
      else if (opState === 'thinking' || opState === 'generating_speech') targetStateWeight = 2.0;
      else if (isSpeaking) targetStateWeight = 3.0;

      const targetEmpathetic = affState === 'empathetic' ? 1.0 : 0.0;

      smoothedStateWeight += (targetStateWeight - smoothedStateWeight) * (1.0 - Math.exp(-deltaTime * 4.0));
      smoothedEmpathetic += (targetEmpathetic - smoothedEmpathetic) * (1.0 - Math.exp(-deltaTime * 3.0));

      // 4. Update Shader Uniforms
      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = accumulatedTime;
        materialRef.current.uniforms.uAudioEnvelope.value = audioEnv;
        materialRef.current.uniforms.uBass.value = audioBass;
        materialRef.current.uniforms.uMid.value = audioMid;
        materialRef.current.uniforms.uTreble.value = audioTreble;
        materialRef.current.uniforms.uStateWeight.value = smoothedStateWeight;
        materialRef.current.uniforms.uEmpathetic.value = smoothedEmpathetic;
      }

      // Gentle, slow organic axial drift
      points.rotation.y += deltaTime * 0.08;
      points.rotation.x = 0.22 + Math.sin(accumulatedTime * 0.35) * 0.06;

      renderer.render(scene, camera);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // 5. Responsive Resize Observer
    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      if (materialRef.current) {
        materialRef.current.uniforms.uViewportHeight.value = h;
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup on unmount only
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // Run ONCE on mount

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent ${className}`}
    >
      {/* Subtle, delicate ambient background aura (never washing out or overpowering particles) */}
      <div
        className="absolute w-[320px] h-[320px] rounded-full pointer-events-none transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle, rgba(0, 245, 255, 0.04) 0%, rgba(139, 92, 246, 0.03) 50%, transparent 70%)',
          filter: 'blur(32px)',
          transform: 'translate(-50%, -50%)',
          top: '50%',
          left: '50%',
          opacity: operationalState === 'speaking' || isAudioPlaying ? 0.9 : 0.4,
        }}
      />
    </div>
  );
};
