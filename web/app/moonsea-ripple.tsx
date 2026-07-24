"use client";

import { useEffect, useRef } from "react";

const vertexShaderSource = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform vec2 u_pointer_velocity;
uniform float u_pointer_energy;
uniform vec2 u_click;
uniform float u_click_age;
uniform float u_time;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  value += valueNoise(p) * 0.5000;
  p = p * 2.03 + vec2(17.1, 9.2);
  value += valueNoise(p) * 0.2500;
  p = p * 2.07 + vec2(8.3, 14.8);
  value += valueNoise(p) * 0.1250;
  p = p * 2.01 + vec2(11.7, 5.4);
  value += valueNoise(p) * 0.0625;
  return value;
}

float marineSnow(vec2 uv, float scale, float speed, float seed, float time) {
  vec2 p = uv * scale;
  p.y += time * speed;
  p.x += sin((p.y + seed) * 0.72 + time * 0.11) * 0.16;
  vec2 cell = floor(p);
  vec2 local = fract(p) - 0.5;
  vec2 offset = vec2(
    hash21(cell + vec2(seed + 1.7)),
    hash21(cell + vec2(seed + 8.3))
  ) - 0.5;
  float radius = mix(0.018, 0.068, hash21(cell + vec2(seed + 4.1)));
  float flake = smoothstep(radius, 0.0, length(local - offset));
  return flake * step(0.63, hash21(cell + vec2(seed)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 ratio = vec2(aspect, 1.0);
  float time = u_time;
  float depth = 1.0 - uv.y;

  vec3 topWater = vec3(0.025, 0.170, 0.205);
  vec3 middleWater = vec3(0.005, 0.064, 0.092);
  vec3 abyssWater = vec3(0.001, 0.014, 0.030);
  vec3 color = mix(topWater, middleWater, smoothstep(0.02, 0.48, depth));
  color = mix(color, abyssWater, smoothstep(0.42, 1.0, depth));

  vec2 volumeUv = vec2(uv.x * aspect, uv.y);
  float currentLarge = fbm(volumeUv * vec2(1.20, 2.20) + vec2(time * 0.012, -time * 0.006));
  float currentFine = fbm(volumeUv * vec2(2.90, 5.10) - vec2(time * 0.018, time * 0.008));
  float waterHaze = smoothstep(0.30, 0.78, currentLarge * 0.76 + currentFine * 0.30);
  color += vec3(0.008, 0.055, 0.072) * waterHaze * (1.0 - depth * 0.58);

  float shaftNoise = fbm(volumeUv * vec2(1.45, 2.65) + vec2(time * 0.010, -time * 0.004));
  float shaftX = uv.x + depth * 0.10 + (shaftNoise - 0.5) * 0.12;
  float shafts = exp(-pow((shaftX - 0.72) / 0.105, 2.0));
  shafts += exp(-pow((shaftX - 0.49) / 0.072, 2.0)) * 0.48;
  shafts += exp(-pow((shaftX - 0.91) / 0.052, 2.0)) * 0.34;
  shafts *= exp(-depth * 3.15) * (0.54 + shaftNoise * 0.46);
  color += vec3(0.055, 0.185, 0.205) * shafts;

  float upperCaustic = sin(uv.x * aspect * 38.0 + currentFine * 5.2 - time * 0.34);
  upperCaustic *= sin(uv.x * aspect * 23.0 - uv.y * 12.0 + time * 0.27);
  upperCaustic = pow(max(0.0, upperCaustic), 5.0) * exp(-depth * 7.6);
  color += vec3(0.070, 0.185, 0.190) * upperCaustic * 0.48;

  float snowFar = marineSnow(uv * vec2(aspect, 1.0), 42.0, 0.24, 3.2, time);
  float snowMiddle = marineSnow(uv * vec2(aspect, 1.0), 24.0, 0.17, 11.8, time);
  float snowNear = marineSnow(uv * vec2(aspect, 1.0), 13.0, 0.11, 27.4, time);
  float snow = snowFar * 0.20 + snowMiddle * 0.44 + snowNear * 0.72;
  color += vec3(0.42, 0.58, 0.56) * snow * (0.42 + depth * 0.58);

  vec2 glowGrid = vec2(uv.x * aspect, uv.y) * 72.0;
  vec2 glowCell = floor(glowGrid);
  vec2 glowLocal = fract(glowGrid) - 0.5;
  float glowSeed = hash21(glowCell + vec2(41.7));
  float glowPulse = 0.42 + 0.58 * sin(time * (0.46 + glowSeed) + glowSeed * 38.0);
  float bioGlow = smoothstep(0.105, 0.0, length(glowLocal))
    * step(0.988, glowSeed)
    * glowPulse;
  color += vec3(0.07, 0.68, 0.72) * bioGlow * (0.18 + depth * 0.62);

  vec2 pointerDelta = (uv - u_pointer) * ratio;
  float pointerDistance = length(pointerDelta);
  vec2 wakeDirection = normalize(u_pointer_velocity + vec2(0.0001));
  float behindPointer = max(0.0, dot(pointerDelta, -wakeDirection));
  float acrossWake = abs(pointerDelta.x * wakeDirection.y - pointerDelta.y * wakeDirection.x);
  float pointerWake = exp(-acrossWake * 42.0)
    * exp(-behindPointer * 7.0)
    * step(0.0, dot(pointerDelta, -wakeDirection))
    * sin(behindPointer * 76.0 - time * 6.2)
    * u_pointer_energy;
  float pointerGlow = exp(-pointerDistance * pointerDistance * 72.0) * u_pointer_energy;
  color += vec3(0.06, 0.24, 0.25) * abs(pointerWake) * 0.34;
  color += vec3(0.08, 0.29, 0.29) * pointerGlow * 0.42;

  vec2 clickDelta = (uv - u_click) * ratio;
  float clickDistance = length(clickDelta);
  float clickRadius = u_click_age * 0.20;
  float clickRing = exp(-abs(clickDistance - clickRadius) * 86.0)
    * exp(-u_click_age * 1.65)
    * step(u_click_age, 1.9);
  color += vec3(0.18, 0.54, 0.53) * clickRing * 0.40;

  float distantFog = fbm(vec2(uv.x * aspect * 0.72, uv.y * 1.45) + vec2(-time * 0.006, 4.2));
  color += vec3(0.004, 0.034, 0.048) * distantFog * smoothstep(0.24, 0.90, depth);
  float vignette = smoothstep(1.10, 0.20, distance(uv, vec2(0.56, 0.56)));
  color *= mix(0.54, 1.0, vignette);
  float grain = hash21(gl_FragCoord.xy + fract(time) * 91.0) - 0.5;
  color += grain * 0.007;
  color = pow(max(color, 0.0), vec3(0.93));

  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("无法创建月海着色器");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "未知着色器错误";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

type Fish = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  depth: number;
  phase: number;
  school: number;
  alert: number;
};

function createRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createSchool(count: number) {
  const random = createRandom(0x4d4f4f4e);
  return Array.from({ length: count }, (_, index): Fish => {
    const school = index % 3;
    const direction = random() > 0.24 ? 1 : -1;
    return {
      x: 0.42 + random() * 0.58,
      y: 0.33 + school * 0.19 + (random() - 0.5) * 0.14,
      vx: direction * (0.018 + random() * 0.022),
      vy: (random() - 0.5) * 0.012,
      size: 0.82 + random() * 0.92,
      depth: 0.28 + random() * 0.72,
      phase: random() * Math.PI * 2,
      school,
      alert: 0,
    };
  });
}

function drawFish(
  context: CanvasRenderingContext2D,
  fish: Fish,
  width: number,
  height: number,
  time: number,
) {
  const waveX = Math.sin(time * 0.52 + fish.phase) * 2.2 * fish.depth;
  const waveY = Math.sin(time * 0.84 + fish.phase * 1.7) * 3.6 * fish.depth;
  const x = fish.x * width + waveX;
  const y = fish.y * height + waveY;
  const angle = Math.atan2(fish.vy * height, fish.vx * width);
  const size = Math.min(width, height) * 0.0125 * fish.size;
  const alpha = 0.42 + fish.depth * 0.42;

  context.save();
  context.translate(x, y);
  context.rotate(angle);

  if (fish.alert > 0.04) {
    const wakeLength = size * (2.4 + fish.alert * 2.8);
    const wakeGradient = context.createLinearGradient(-wakeLength, 0, -size * 0.6, 0);
    wakeGradient.addColorStop(0, "rgba(124, 205, 198, 0)");
    wakeGradient.addColorStop(1, `rgba(124, 205, 198, ${fish.alert * 0.38})`);
    context.beginPath();
    context.moveTo(-size * 0.64, -size * 0.15);
    context.bezierCurveTo(
      -wakeLength * 0.46,
      -size * 0.42,
      -wakeLength * 0.76,
      size * 0.28,
      -wakeLength,
      0,
    );
    context.moveTo(-size * 0.64, size * 0.16);
    context.bezierCurveTo(
      -wakeLength * 0.42,
      size * 0.48,
      -wakeLength * 0.74,
      -size * 0.22,
      -wakeLength,
      size * 0.04,
    );
    context.strokeStyle = wakeGradient;
    context.lineWidth = Math.max(0.8, size * 0.075);
    context.stroke();
  }

  const bodyGradient = context.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
  bodyGradient.addColorStop(0, `rgba(157, 211, 198, ${alpha * (0.76 + fish.alert * 0.18)})`);
  bodyGradient.addColorStop(0.18, `rgba(35, 111, 117, ${alpha})`);
  bodyGradient.addColorStop(0.70, `rgba(5, 48, 63, ${alpha})`);
  bodyGradient.addColorStop(1, `rgba(1, 24, 39, ${alpha * 0.98})`);

  context.beginPath();
  context.moveTo(size * 1.08, 0);
  context.bezierCurveTo(
    size * 0.58,
    -size * 0.32,
    -size * 0.62,
    -size * 0.29,
    -size * 0.93,
    0,
  );
  context.bezierCurveTo(
    -size * 0.62,
    size * 0.29,
    size * 0.58,
    size * 0.32,
    size * 1.08,
    0,
  );
  context.fillStyle = bodyGradient;
  context.fill();

  const tailSwing = Math.sin(time * 7.4 + fish.phase) * size * 0.18;
  context.beginPath();
  context.moveTo(-size * 0.78, 0);
  context.lineTo(-size * 1.38, -size * 0.43 + tailSwing);
  context.lineTo(-size * 1.24, size * 0.45 + tailSwing);
  context.closePath();
  context.fillStyle = `rgba(8, 57, 71, ${alpha * 0.86})`;
  context.fill();

  context.beginPath();
  context.moveTo(-size * 0.20, -size * 0.25);
  context.quadraticCurveTo(size * 0.04, -size * 0.58, size * 0.32, -size * 0.20);
  context.closePath();
  context.fillStyle = `rgba(91, 169, 161, ${alpha * 0.58})`;
  context.fill();

  context.beginPath();
  context.moveTo(size * 0.08, size * 0.22);
  context.quadraticCurveTo(size * 0.24, size * 0.48, size * 0.46, size * 0.15);
  context.closePath();
  context.fillStyle = `rgba(23, 88, 99, ${alpha * 0.72})`;
  context.fill();

  context.beginPath();
  context.arc(size * 0.47, 0, size * 0.30, -1.15, 1.15);
  context.strokeStyle = `rgba(157, 211, 198, ${alpha * 0.24})`;
  context.lineWidth = Math.max(0.7, size * 0.045);
  context.stroke();

  for (let index = 0; index < 4; index += 1) {
    context.beginPath();
    context.arc(
      size * (-0.38 + index * 0.21),
      size * 0.19,
      Math.max(0.65, size * 0.038),
      0,
      Math.PI * 2,
    );
    context.fillStyle = `rgba(102, 230, 216, ${alpha * (0.42 + fish.alert * 0.35)})`;
    context.fill();
  }

  context.beginPath();
  context.arc(size * 0.68, -size * 0.09, Math.max(1.0, size * 0.080), 0, Math.PI * 2);
  context.fillStyle = `rgba(222, 229, 194, ${Math.min(0.94, alpha + 0.24)})`;
  context.fill();
  context.restore();
}

export function MoonseaRipple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fishCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fishCanvas = fishCanvasRef.current;
    if (!canvas || !fishCanvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    });
    if (!gl) {
      canvas.dataset.rendering = "static";
      return;
    }
    const fishContext = fishCanvas.getContext("2d", { alpha: true });
    if (!fishContext) {
      fishCanvas.dataset.rendering = "static";
      return;
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();
    if (!program) throw new Error("无法创建月海波纹程序");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "月海波纹程序链接失败");
    }

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const pointerLocation = gl.getUniformLocation(program, "u_pointer");
    const pointerVelocityLocation = gl.getUniformLocation(program, "u_pointer_velocity");
    const pointerEnergyLocation = gl.getUniformLocation(program, "u_pointer_energy");
    const clickLocation = gl.getUniformLocation(program, "u_click");
    const clickAgeLocation = gl.getUniformLocation(program, "u_click_age");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const buffer = gl.createBuffer();
    if (!buffer || positionLocation < 0) throw new Error("月海波纹顶点缓冲初始化失败");

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const pointer = { x: 0.50, y: 0.36 };
    const pointerTarget = { x: 0.50, y: 0.36 };
    const pointerDom = { x: 0.50, y: 0.64 };
    const pointerVelocity = { x: 0, y: 0 };
    let pointerEnergy = 0;
    let lastPointerAt = performance.now();
    let lastFrameAt = performance.now();
    let interactionUntil = 0;
    const click = { x: -2, y: -2, startedAt: -10_000 };
    const fish = createSchool(34);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let visible = !document.hidden;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let canvasRatio = 1;

    const resize = () => {
      canvasRatio = Math.min(
        window.devicePixelRatio || 1,
        1.65,
      );
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      const width = Math.max(1, Math.floor(viewportWidth * canvasRatio));
      const height = Math.max(1, Math.floor(viewportHeight * canvasRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      if (fishCanvas.width !== width || fishCanvas.height !== height) {
        fishCanvas.width = width;
        fishCanvas.height = height;
        fishContext.setTransform(canvasRatio, 0, 0, canvasRatio, 0, 0);
      }
    };

    const updatePoint = (event: PointerEvent, target: { x: number; y: number }) => {
      target.x = event.clientX / window.innerWidth;
      target.y = 1 - event.clientY / window.innerHeight;
    };

    const onPointerMove = (event: PointerEvent) => {
      const now = performance.now();
      const previousX = pointerTarget.x;
      const previousY = pointerTarget.y;
      updatePoint(event, pointerTarget);
      pointerDom.x = pointerTarget.x;
      pointerDom.y = 1 - pointerTarget.y;
      const elapsed = Math.max(8, now - lastPointerAt);
      pointerVelocity.x = (pointerTarget.x - previousX) * 16_000 / elapsed;
      pointerVelocity.y = (pointerTarget.y - previousY) * 16_000 / elapsed;
      pointerEnergy = Math.min(
        1,
        pointerEnergy + Math.hypot(pointerVelocity.x, pointerVelocity.y) * 0.065 + 0.16,
      );
      document.documentElement.style.setProperty(
        "--moonsea-tilt-x",
        `${(pointerTarget.x - 0.5) * 3.5}deg`,
      );
      document.documentElement.style.setProperty(
        "--moonsea-tilt-y",
        `${(pointerTarget.y - 0.5) * -2}deg`,
      );
      lastPointerAt = now;
      interactionUntil = now + 900;
      if (reducedMotion.matches && !animationFrame) {
        animationFrame = requestAnimationFrame(render);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      updatePoint(event, click);
      click.startedAt = performance.now();
      interactionUntil = performance.now() + 900;
      if (reducedMotion.matches && !animationFrame) {
        animationFrame = requestAnimationFrame(render);
      }
    };
    const onVisibilityChange = () => {
      visible = !document.hidden;
      if (visible && !animationFrame && !reducedMotion.matches) {
        animationFrame = requestAnimationFrame(render);
      }
    };
    const onMotionChange = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(render);
    };

    const updateFish = (deltaTime: number, timestamp: number) => {
      const aspect = viewportWidth / viewportHeight;
      const pointerActive = timestamp - lastPointerAt < 1_150 && pointerEnergy > 0.035;
      let scatteredCount = 0;

      for (const current of fish) {
        let neighborCount = 0;
        let centerX = 0;
        let centerY = 0;
        let velocityX = 0;
        let velocityY = 0;
        let separationX = 0;
        let separationY = 0;

        for (const other of fish) {
          if (other === current || other.school !== current.school) continue;
          const dx = (other.x - current.x) * aspect;
          const dy = other.y - current.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > 0.018) continue;
          neighborCount += 1;
          centerX += other.x;
          centerY += other.y;
          velocityX += other.vx;
          velocityY += other.vy;
          if (distanceSquared < 0.0015) {
            const strength = 1 - Math.sqrt(distanceSquared / 0.0015);
            separationX -= dx * strength;
            separationY -= dy * strength;
          }
        }

        if (neighborCount > 0) {
          centerX /= neighborCount;
          centerY /= neighborCount;
          velocityX /= neighborCount;
          velocityY /= neighborCount;
          current.vx += (centerX - current.x) * 0.052 * deltaTime;
          current.vy += (centerY - current.y) * 0.052 * deltaTime;
          current.vx += (velocityX - current.vx) * 0.34 * deltaTime;
          current.vy += (velocityY - current.vy) * 0.34 * deltaTime;
          current.vx += separationX * 0.46 * deltaTime;
          current.vy += separationY * 0.46 * deltaTime;
        }

        const homeY = 0.35 + current.school * 0.19;
        const homeX = 0.66 + current.school * 0.09;
        current.vx += (homeX - current.x) * 0.009 * deltaTime;
        current.vy += (homeY - current.y) * 0.026 * deltaTime;
        current.vy += Math.sin(timestamp * 0.00048 + current.phase) * 0.0018 * deltaTime;

        if (pointerActive && pointerDom.y > 0.43) {
          const dx = (current.x - pointerDom.x) * aspect;
          const dy = current.y - pointerDom.y;
          const distance = Math.hypot(dx, dy);
          const fleeRadius = 0.255 + current.depth * 0.060;
          if (distance < fleeRadius) {
            const force = Math.pow(1 - distance / fleeRadius, 1.65);
            const safeDistance = Math.max(0.001, distance);
            current.vx += (dx / safeDistance / aspect) * force * 1.18 * deltaTime;
            current.vy += (dy / safeDistance) * force * 1.18 * deltaTime;
            current.alert = Math.min(1, current.alert + force * 1.8);
            scatteredCount += 1;
          }
        }
        current.alert *= Math.exp(-deltaTime * 1.55);

        if (current.x < 0.28) current.vx += (0.28 - current.x) * 0.42 * deltaTime;
        if (current.x > 1.04) current.vx -= (current.x - 1.04) * 0.42 * deltaTime;
        if (current.y < 0.22) current.vy += (0.22 - current.y) * 0.48 * deltaTime;
        if (current.y > 0.92) current.vy -= (current.y - 0.92) * 0.48 * deltaTime;

        const speed = Math.hypot(current.vx * aspect, current.vy);
        const maxSpeed = pointerActive ? 0.29 : 0.065;
        if (speed > maxSpeed) {
          const scale = maxSpeed / speed;
          current.vx *= scale;
          current.vy *= scale;
        }
        if (speed < 0.018) {
          current.vx += (current.vx >= 0 ? 1 : -1) * 0.006 * deltaTime;
        }

        current.x += current.vx * deltaTime;
        current.y += current.vy * deltaTime;
      }

      fishCanvas.dataset.interaction = scatteredCount > 0 ? "scattering" : "schooling";
      fishCanvas.dataset.scatterCount = String(scatteredCount);
    };

    const renderFish = (timestamp: number) => {
      fishContext.clearRect(0, 0, viewportWidth, viewportHeight);
      fish
        .slice()
        .sort((a, b) => a.depth - b.depth)
        .forEach((current) => {
          drawFish(
            fishContext,
            current,
            viewportWidth,
            viewportHeight,
            reducedMotion.matches ? 0 : timestamp / 1_000,
          );
        });
      fishCanvas.dataset.rendering = reducedMotion.matches ? "reduced" : "canvas-2d";
      fishCanvas.dataset.fishCount = String(fish.length);
    };

    const render = (timestamp: number) => {
      animationFrame = 0;
      resize();
      const deltaTime = Math.min(0.034, Math.max(0.001, (timestamp - lastFrameAt) / 1_000));
      lastFrameAt = timestamp;
      const interactionBurst = timestamp < interactionUntil;
      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      pointer.x += (pointerTarget.x - pointer.x) * 0.12;
      pointer.y += (pointerTarget.y - pointer.y) * 0.12;
      pointerVelocity.x *= 0.92;
      pointerVelocity.y *= 0.92;
      pointerEnergy *= 0.982;
      gl.uniform2f(pointerLocation, pointer.x, pointer.y);
      gl.uniform2f(pointerVelocityLocation, pointerVelocity.x, pointerVelocity.y);
      gl.uniform1f(pointerEnergyLocation, pointerEnergy);
      gl.uniform2f(clickLocation, click.x, click.y);
      gl.uniform1f(clickAgeLocation, Math.max(0, (timestamp - click.startedAt) / 1_000));
      gl.uniform1f(timeLocation, reducedMotion.matches ? 0.0 : timestamp / 1_000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.rendering = reducedMotion.matches ? "reduced" : "webgl";
      canvas.dataset.interaction = pointerEnergy > 0.08 ? "active" : "idle";
      if (!reducedMotion.matches || interactionBurst) updateFish(deltaTime, timestamp);
      renderFish(timestamp);

      if (visible && (!reducedMotion.matches || interactionBurst)) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", onMotionChange);
    resize();
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", onMotionChange);
      document.documentElement.style.removeProperty("--moonsea-tilt-x");
      document.documentElement.style.removeProperty("--moonsea-tilt-y");
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <div className="moonsea-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} className="moonsea-backdrop__ocean" />
      <canvas ref={fishCanvasRef} className="moonsea-backdrop__fish" />
      <div className="moonsea-backdrop__wash" />
    </div>
  );
}
