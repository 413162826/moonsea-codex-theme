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
uniform vec2 u_click;
uniform float u_click_age;
uniform float u_scroll;
uniform float u_time;

float softBand(float value, float center, float width) {
  return 1.0 - smoothstep(width * 0.35, width, abs(value - center));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 ratio = vec2(u_resolution.x / u_resolution.y, 1.0);
  float time = u_time * 0.16;

  vec2 flow = uv;
  flow.x += sin(uv.y * 5.4 + time * 0.82 + u_scroll * 0.9) * 0.038;
  flow.y += cos(uv.x * 4.7 - time * 0.66) * 0.030;

  float swell = sin(flow.x * 7.2 + flow.y * 4.6 - time * 1.15);
  swell += sin(flow.x * 12.8 - flow.y * 7.4 + time * 0.74) * 0.42;
  swell += cos(flow.x * 4.2 + flow.y * 11.6 + time * 0.52) * 0.28;
  swell = swell / 1.70 * 0.5 + 0.5;

  float causticA = softBand(sin(flow.x * 15.0 + flow.y * 10.0 - time), 0.72, 0.30);
  float causticB = softBand(sin(flow.x * 9.0 - flow.y * 17.0 + time * 0.8), 0.80, 0.25);
  float caustics = causticA * 0.56 + causticB * 0.34;

  vec2 pointerDelta = (uv - u_pointer) * ratio;
  float pointerDistance = length(pointerDelta);
  float pointerWave = sin(pointerDistance * 35.0 - time * 4.2)
    * exp(-pointerDistance * 6.8);
  float pointerLight = exp(-pointerDistance * 4.6);

  vec2 clickDelta = (uv - u_click) * ratio;
  float clickDistance = length(clickDelta);
  float clickRadius = u_click_age * 0.22;
  float clickRing = exp(-abs(clickDistance - clickRadius) * 54.0)
    * exp(-u_click_age * 0.72)
    * step(u_click_age, 4.0);

  float current = clamp(
    swell + pointerWave * 0.11 + clickRing * 0.30 + caustics * 0.22,
    0.0,
    1.0
  );

  vec3 moon = vec3(0.948, 0.957, 0.925);
  vec3 mist = vec3(0.760, 0.872, 0.858);
  vec3 tide = vec3(0.360, 0.665, 0.690);
  vec3 deep = vec3(0.095, 0.360, 0.410);

  vec3 color = mix(moon, mist, smoothstep(0.18, 0.64, current));
  color = mix(color, tide, smoothstep(0.56, 0.88, current) * 0.58);
  color = mix(color, deep, smoothstep(0.88, 1.0, current) * 0.28);
  color += vec3(0.110, 0.145, 0.125) * caustics;
  color -= vec3(0.025, 0.018, 0.010)
    * (1.0 - caustics)
    * smoothstep(0.56, 0.92, current);
  color += vec3(0.035, 0.075, 0.080) * pointerLight * 0.24;
  color += vec3(0.220, 0.260, 0.225) * clickRing;

  float vignette = 1.0 - smoothstep(0.22, 1.05, distance(uv, vec2(0.54, 0.52)));
  color = mix(color * 0.96, color, vignette);

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
    const clickLocation = gl.getUniformLocation(program, "u_click");
    const clickAgeLocation = gl.getUniformLocation(program, "u_click_age");
    const scrollLocation = gl.getUniformLocation(program, "u_scroll");
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

    const pointer = { x: 0.76, y: 0.62 };
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

    const updatePoint = (event: PointerEvent, target: typeof pointer) => {
      target.x = event.clientX / window.innerWidth;
      target.y = 1 - event.clientY / window.innerHeight;
    };

    const onPointerMove = (event: PointerEvent) => updatePoint(event, pointer);
    const onPointerDown = (event: PointerEvent) => {
      updatePoint(event, click);
      click.startedAt = performance.now();
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
      gl.uniform2f(pointerLocation, pointer.x, pointer.y);
      gl.uniform2f(clickLocation, click.x, click.y);
      gl.uniform1f(clickAgeLocation, Math.max(0, (timestamp - click.startedAt) / 1_000));
      gl.uniform1f(scrollLocation, window.scrollY / Math.max(window.innerHeight, 1));
      gl.uniform1f(timeLocation, reducedMotion.matches ? 0.0 : timestamp / 1_000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.rendering = reducedMotion.matches ? "reduced" : "webgl";

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
