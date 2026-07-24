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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 ratio = vec2(u_resolution.x / u_resolution.y, 1.0);
  float time = u_time;
  float horizon = 0.55;
  float waterMask = 1.0 - smoothstep(horizon - 0.006, horizon + 0.006, uv.y);
  float depth = clamp((horizon - uv.y) / horizon, 0.0, 1.0);

  vec2 waterPointer = vec2(u_pointer.x, min(u_pointer.y, horizon - 0.035));
  vec2 pointerDelta = (uv - waterPointer) * ratio;
  float pointerDistance = length(pointerDelta);
  float cursorAtmosphere = exp(-length((uv - u_pointer) * ratio) * 5.8)
    * u_pointer_energy;
  float pointerWave = sin(pointerDistance * 72.0 - time * 8.5)
    * exp(-pointerDistance * 9.0)
    * u_pointer_energy
    * waterMask;
  vec2 wakeDirection = normalize(u_pointer_velocity + vec2(0.0001));
  float behindPointer = max(0.0, dot(pointerDelta, -wakeDirection));
  float acrossWake = abs(pointerDelta.x * wakeDirection.y - pointerDelta.y * wakeDirection.x);
  float pointerWake = exp(-acrossWake * 32.0)
    * exp(-behindPointer * 5.0)
    * step(0.0, dot(pointerDelta, -wakeDirection))
    * sin(behindPointer * 55.0 - time * 9.0)
    * u_pointer_energy
    * waterMask;

  vec2 waterClick = vec2(u_click.x, min(u_click.y, horizon - 0.045));
  vec2 clickDelta = (uv - waterClick) * ratio;
  float clickDistance = length(clickDelta);
  float clickRadius = u_click_age * 0.30;
  float clickRing = exp(-abs(clickDistance - clickRadius) * 70.0)
    * exp(-u_click_age * 0.82)
    * step(u_click_age, 3.5)
    * waterMask;

  vec3 skyHorizon = vec3(0.115, 0.275, 0.350);
  vec3 skyZenith = vec3(0.018, 0.055, 0.095);
  float skyMix = smoothstep(horizon, 1.0, uv.y);
  vec3 sky = mix(skyHorizon, skyZenith, pow(skyMix, 0.72));
  float cloud = noise(vec2(uv.x * 3.2 + time * 0.015, uv.y * 7.0));
  cloud *= noise(vec2(uv.x * 7.0 - time * 0.01, uv.y * 10.0));
  sky += vec3(0.075, 0.105, 0.115) * smoothstep(0.34, 0.72, cloud) * skyMix;

  vec2 moonCenter = vec2(0.73, 0.79);
  float moonDistance = length((uv - moonCenter) * ratio);
  float moonDisc = 1.0 - smoothstep(0.051, 0.058, moonDistance);
  float moonHalo = exp(-moonDistance * 7.5);
  sky += vec3(0.62, 0.70, 0.68) * moonHalo * 0.58;
  sky = mix(sky, vec3(0.925, 0.930, 0.850), moonDisc * 0.96);

  float waveScale = mix(52.0, 10.0, pow(depth, 0.62));
  float swell = sin(uv.x * waveScale + depth * 11.0 - time * 0.74);
  swell += sin(uv.x * waveScale * 0.57 - depth * 19.0 + time * 0.52) * 0.62;
  swell += sin(uv.x * waveScale * 1.31 + depth * 7.0 - time * 0.94) * 0.26;
  swell += pointerWave * 0.95 + pointerWake * 0.70 + clickRing * 1.25;
  swell /= 2.05;

  float fineWave = sin(uv.x * waveScale * 2.1 - depth * 27.0 + time * 1.18);
  fineWave += sin(uv.x * waveScale * 0.88 + depth * 34.0 - time * 0.63);
  fineWave *= 0.5;
  float crest = pow(smoothstep(0.12, 0.93, swell), 4.0);
  crest += pow(smoothstep(0.42, 0.98, fineWave), 7.0) * 0.28;

  vec3 waterNear = vec3(0.012, 0.085, 0.125);
  vec3 waterFar = vec3(0.055, 0.205, 0.270);
  vec3 water = mix(waterFar, waterNear, pow(depth, 0.72));
  water += vec3(0.035, 0.125, 0.160) * swell;
  water += vec3(0.155, 0.300, 0.330) * crest;

  float reflectedAxis = moonCenter.x
    + sin(depth * 16.0 - time * 0.34) * (0.012 + depth * 0.035)
    + swell * 0.022
    + (u_pointer.x - 0.5) * u_pointer_energy * 0.16;
  float reflectionWidth = mix(0.018, 0.19, pow(depth, 0.82));
  float reflectionBand = exp(-pow((uv.x - reflectedAxis) / reflectionWidth, 2.0));
  float brokenLight = smoothstep(0.10, 0.88, swell * 0.72 + fineWave * 0.32 + 0.48);
  brokenLight = pow(brokenLight, 2.2);
  float reflection = reflectionBand * brokenLight * (0.30 + depth * 0.92);
  water += vec3(0.74, 0.77, 0.62) * reflection;
  water += vec3(0.38, 0.64, 0.68) * clickRing * 0.72;
  water += vec3(0.16, 0.48, 0.55) * abs(pointerWave) * u_pointer_energy;

  vec3 color = mix(sky, water, waterMask);
  color += vec3(0.09, 0.20, 0.21) * cursorAtmosphere;
  float horizonGlow = exp(-abs(uv.y - horizon) * 82.0);
  color += vec3(0.16, 0.33, 0.38) * horizonGlow * 0.34;
  float vignette = smoothstep(1.04, 0.24, distance(uv, vec2(0.55, 0.54)));
  color *= mix(0.72, 1.0, vignette);

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

export function MoonseaRipple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    const pointerVelocity = { x: 0, y: 0 };
    let pointerEnergy = 0;
    let lastPointerAt = performance.now();
    const click = { x: -2, y: -2, startedAt: -10_000 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let visible = !document.hidden;

    const resize = () => {
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        window.innerWidth < 720 ? 1.15 : 1.5,
      );
      const width = Math.max(1, Math.floor(window.innerWidth * ratio));
      const height = Math.max(1, Math.floor(window.innerHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
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
      if (reducedMotion.matches && !animationFrame) {
        animationFrame = requestAnimationFrame(render);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      updatePoint(event, click);
      click.startedAt = performance.now();
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

    const render = (timestamp: number) => {
      animationFrame = 0;
      resize();
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

      if (visible && !reducedMotion.matches) {
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
      <canvas ref={canvasRef} />
      <div className="moonsea-backdrop__wash" />
    </div>
  );
}
