import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const API = "http://localhost:8000";
const sizeColors = ["#8083ff", "#4cd7f6", "#00885d", "#464554", "#654998"];

// ─── WebGL Shader Background ────────────────────────────────────────────────
function ShaderBackground({ opacity }) {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        function syncSize() {
            const w = canvas.clientWidth || 1280;
            const h = canvas.clientHeight || 720;
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
        }
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(syncSize).observe(canvas);
        }
        syncSize();
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return;
        const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
        const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = v_texCoord;
    vec3 bg = vec3(0.0078, 0.0314, 0.0902);
    vec3 indigo = vec3(0.388, 0.4, 0.945);
    vec3 cyan = vec3(0.0235, 0.7137, 0.8314);
    vec3 violet = vec3(0.6549, 0.5451, 0.9804);
    float pulse = (sin(u_time * 0.5) * 0.5 + 0.5);
    float d1 = length(uv - vec2(0.2, 0.8));
    float orb1 = smoothstep(0.6, 0.0, d1) * (0.06 + 0.02 * pulse);
    float d2 = length(uv - vec2(0.8, 0.7));
    float orb2 = smoothstep(0.5, 0.0, d2) * (0.05 + 0.01 * pulse);
    float d3 = length(uv - vec2(0.5, 0.2));
    float orb3 = smoothstep(0.7, 0.0, d3) * (0.07 + 0.02 * pulse);
    vec3 color = bg;
    color += orb1 * indigo;
    color += orb2 * cyan;
    color += orb3 * violet;
    float scanline = sin(uv.y * 800.0) * 0.02;
    color -= scanline;
    gl_FragColor = vec4(color, 1.0);
}`;
        function cs(type, src) {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            return s;
        }
        const prog = gl.createProgram();
        gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const pos = gl.getAttribLocation(prog, 'a_position');
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
        const uTime = gl.getUniformLocation(prog, 'u_time');
        const uRes = gl.getUniformLocation(prog, 'u_resolution');
        let t0 = performance.now();
        let handle;
        function render(t) {
            if (typeof ResizeObserver === 'undefined') syncSize();
            gl.viewport(0, 0, canvas.width, canvas.height);
            if (uTime) gl.uniform1f(uTime, (t - t0) * 0.001);
            if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            handle = requestAnimationFrame(render);
        }
        handle = requestAnimationFrame(render);
        return () => {
            cancelAnimationFrame(handle);
            const ext = gl.getExtension('WEBGL_lose_context');
            if (ext) ext.loseContext();
        };
    }, []);

    return (
        <div className={`absolute inset-0 w-full h-full pointer-events-none ${opacity}`} style={{ display: 'block' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }}></canvas>
        </div>
    );
}

// ─── Starfield Component ────────────────────────────────────────────────────
function Starfield() {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const numStars = 50;
        for (let i = 0; i < numStars; i++) {
            const star = document.createElement('div');
            star.classList.add('star');
            const size = Math.random() * 2 + 1;
            const left = Math.random() * 100;
            const top = Math.random() * 100;
            const duration = Math.random() * 20 + 10;
            const delay = Math.random() * -20;
            if (Math.random() > 0.8) star.style.backgroundColor = '#4cd7f6';
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.left = `${left}%`;
            star.style.top = `${top}%`;
            star.style.animationDuration = `${duration}s`;
            star.style.animationDelay = `${delay}s`;
            container.appendChild(star);
        }
        return () => { container.innerHTML = ''; };
    }, []);
    return <div ref={containerRef} className="absolute inset-0 z-[1] pointer-events-none" />;
}

// ─── Hero Landing Page ──────────────────────────────────────────────────────
function HeroLanding({ onGetStarted }) {
    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden">
            {/* Background layers */}
            <div className="absolute inset-0 z-0">
                <ShaderBackground opacity="opacity-40" />
            </div>
            <div className="absolute inset-0 w-full h-full grid-bg z-0"></div>
            <div className="perspective-grid"></div>
            <Starfield />

            {/* Navigation */}
            <nav className="relative top-0 w-full flex items-center justify-between px-lg py-md z-50">
                <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary text-2xl">hexagon</span>
                    <span className="font-display-lg text-headline-md font-bold text-primary tracking-tighter">GitScope</span>
                </div>
                <div className="flex gap-md items-center">
                    <a className="font-label-caps text-label-caps text-on-surface-variant hover:text-secondary transition-colors px-md py-sm hidden sm:inline" href="#">Documentation</a>
                    <a className="font-label-caps text-label-caps text-on-surface-variant hover:text-secondary transition-colors px-md py-sm hidden sm:inline" href="#">Pricing</a>
                    <button className="bg-primary-container text-on-primary-container font-label-caps text-label-caps px-lg py-sm rounded glow-bloom hover:bg-primary transition-colors" onClick={onGetStarted}>Sign In</button>
                </div>
            </nav>

            {/* Main Hero */}
            <main className="flex-grow flex items-center justify-center relative z-10 px-gutter pt-xl pb-xl">
                <div className="max-w-4xl mx-auto w-full text-center flex flex-col items-center gap-lg">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-xs px-md py-xs rounded-full border border-secondary/30 bg-secondary/10 text-secondary font-label-caps text-label-caps mb-sm animate-fade-in-up">
                        <span className="text-secondary text-[10px]">✦</span>
                        ENGINEERING INTELLIGENCE PLATFORM
                    </div>

                    {/* Headline */}
                    <h1 className="font-display-lg text-display-lg md:text-[64px] leading-tight max-w-3xl animate-fade-in-up animate-delay-100">
                        Know Your <br className="hidden md:block" />
                        <span className="text-gradient">Engineering</span> Heartbeat.
                    </h1>

                    {/* Subheadline */}
                    <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mt-sm mb-md animate-fade-in-up animate-delay-200">
                        Uncover invisible bottlenecks, track DORA metrics in real-time, and align engineering effort with business outcomes.
                    </p>

                    {/* CTA Area */}
                    <div className="flex flex-col items-center gap-md w-full max-w-md mt-md animate-fade-in-up animate-delay-300">
                        {/* Typewriter Input */}
                        <div className="w-full glass-panel rounded-lg p-xs flex items-center mb-sm group focus-within:border-secondary transition-colors">
                            <span className="material-symbols-outlined text-outline-variant ml-sm mr-xs">search</span>
                            <div className="flex-grow bg-transparent border-none text-on-surface font-code-md text-code-md px-sm py-sm outline-none w-full text-left flex items-center h-[42px] relative overflow-hidden">
                                <span className="text-on-surface-variant mr-1">github.com/</span>
                                <span className="typewriter text-secondary">facebook/react</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-md w-full justify-center">
                            <button className="flex-1 bg-primary-container text-on-primary-container font-label-caps text-label-caps px-xl py-md rounded-lg glow-bloom hover:bg-primary transition-all flex items-center justify-center gap-sm" onClick={onGetStarted}>
                                Analyze Your Repo
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </button>
                            <button className="flex-1 border border-secondary text-secondary hover:bg-secondary/10 font-label-caps text-label-caps px-xl py-md rounded-lg transition-all flex items-center justify-center" onClick={onGetStarted}>
                                View Demo
                            </button>
                        </div>
                    </div>
                </div>

                {/* Floating Metric Cards */}
                <div className="absolute left-[10%] top-[30%] hidden lg:block floating opacity-70">
                    <div className="glass-panel rounded-lg p-md flex items-center gap-md w-[200px]">
                        <div className="w-10 h-10 rounded-full bg-tertiary-container flex items-center justify-center">
                            <span className="material-symbols-outlined text-tertiary">speed</span>
                        </div>
                        <div>
                            <div className="font-label-caps text-[10px] text-on-surface-variant">DEPLOY FREQUENCY</div>
                            <div className="font-code-md text-body-lg text-on-surface">14.2/day</div>
                        </div>
                    </div>
                </div>
                <div className="absolute right-[10%] bottom-[25%] hidden lg:block floating-delay opacity-70">
                    <div className="glass-panel rounded-lg p-md flex items-center gap-md w-[220px]">
                        <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center relative">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-error opacity-20 animate-pulse"></span>
                            <span className="material-symbols-outlined text-error">warning</span>
                        </div>
                        <div>
                            <div className="font-label-caps text-[10px] text-on-surface-variant">CHANGE FAILURE</div>
                            <div className="font-code-md text-body-lg text-on-surface">2.4% <span className="text-error text-[12px] opacity-50 ml-1">+0.1</span></div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ─── Connect Repository Page ────────────────────────────────────────────────
function ConnectRepo({ repo, setRepo, load, ingest, loading, ingesting, error, ingestMsg }) {
    const chips = [
        { label: "vercel/next.js", icon: "deployed_code" },
        { label: "facebook/react", icon: "deployed_code" },
        { label: "vuejs/core", icon: "deployed_code" },
    ];

    return (
        <>
            <div className="absolute inset-0 z-0">
                <ShaderBackground opacity="opacity-60" />
                <div className="absolute inset-0 w-full h-full grid-bg pointer-events-none"></div>
                <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background/90 pointer-events-none"></div>
            </div>
            <main className="relative z-10 flex items-center justify-center min-h-screen p-md">
                <div className="bg-surface/80 backdrop-blur-xl border border-outline-variant/30 rounded-xl p-xl shadow-[0_0_30px_rgba(10,22,40,0.5)] w-full max-w-[560px] relative animate-fade-in-up">
                    {/* Optical Corner */}
                    <div className="absolute top-0 left-0 w-[40px] h-px bg-primary/60"></div>
                    <div className="absolute top-0 left-0 w-px h-[10px] bg-primary/60"></div>

                    {/* Header */}
                    <div className="text-center mb-xl">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant/50 mb-md relative">
                            <span className="material-symbols-outlined text-primary text-[24px]">terminal</span>
                            <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse"></div>
                        </div>
                        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-sm">Connect a Repository</h1>
                        <p className="font-body-md text-body-md text-on-surface-variant">Enter a repository to begin telemetry extraction.</p>
                    </div>

                    {/* Input */}
                    <div className="mb-lg">
                        <label className="block font-label-caps text-label-caps text-on-surface-variant mb-sm uppercase tracking-widest">Target Path</label>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline-variant group-focus-within:text-secondary transition-colors z-10">link</span>
                            <input
                                autoComplete="off"
                                className="w-full bg-surface-container-lowest border-b border-t-0 border-x-0 border-outline-variant/50 pl-[48px] pr-md py-md font-code-md text-code-md text-secondary placeholder-outline-variant focus:outline-none focus:ring-0 input-glow-focus transition-all duration-300 rounded-t-sm"
                                placeholder="owner/repo"
                                spellCheck="false"
                                type="text"
                                value={repo}
                                onChange={(e) => setRepo(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && load()}
                            />
                        </div>
                    </div>

                    {/* Popular Frameworks Chips */}
                    <div className="mb-xl">
                        <p className="font-label-caps text-label-caps text-outline-variant mb-md">Popular Frameworks</p>
                        <div className="flex flex-wrap gap-sm">
                            {chips.map((chip) => (
                                <button
                                    key={chip.label}
                                    className="px-md py-sm rounded-full border border-outline-variant/40 bg-surface-container-highest hover:border-secondary hover:text-secondary font-code-md text-code-md text-on-surface-variant transition-colors flex items-center gap-sm group"
                                    onClick={() => setRepo(chip.label)}
                                >
                                    <span className="material-symbols-outlined text-[16px] group-hover:text-secondary text-outline-variant transition-colors">{chip.icon}</span>
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        className="w-full bg-primary-container text-on-primary-container font-body-lg text-body-lg font-bold py-[18px] rounded-lg relative overflow-hidden btn-glow-hover transition-all duration-300 group flex items-center justify-center gap-md mb-xl"
                        onClick={load}
                        disabled={loading || ingesting}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-primary-container via-inverse-primary to-primary-container opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <span className="relative z-10">{loading ? "Analyzing..." : "Start Analysis"}</span>
                        <span className="material-symbols-outlined relative z-10 text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>

                    {error && <div className="text-error mt-4 text-center mb-md text-sm">{error}</div>}
                    {ingestMsg && <div className="text-tertiary mt-4 text-center mb-md text-sm">{ingestMsg}</div>}

                    <div className="text-center mb-xl">
                        <button className="text-on-surface-variant hover:text-secondary font-code-md text-sm underline underline-offset-4 transition-colors" onClick={ingest} disabled={loading || ingesting}>Run full ingestion instead</button>
                    </div>

                    {/* Feature Checklist */}
                    <div className="bg-surface-container-low rounded-lg p-md border border-outline-variant/20">
                        <div className="flex items-center justify-between font-body-md text-body-md text-on-surface-variant flex-wrap gap-sm">
                            <div className="flex items-center gap-sm">
                                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                                <span>DORA Metrics</span>
                            </div>
                            <div className="flex items-center gap-sm">
                                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                                <span>Cycle Time</span>
                            </div>
                            <div className="flex items-center gap-sm">
                                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                                <span>AI Summary</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}

// ─── Ingesting View ─────────────────────────────────────────────────────────
function IngestingView({ repo }) {
    const [statusText, setStatusText] = useState("Fetching PRs...");
    const [fadeOut, setFadeOut] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const logIndex = useRef(0);

    const mockLogs = [
        { time: "00.01", msg: "INIT: Handshake with Git API verified.", type: "info" },
        { time: "00.14", msg: "PULL: Extracting repository metadata...", type: "info" },
        { time: "00.32", msg: "WARN: Rate limit approaching (74% used).", type: "warn" },
        { time: "01.05", msg: "FETCH: Pull Requests retrieved.", type: "success" },
        { time: "01.12", msg: "COMPUTE: Analyzing lead time for changes...", type: "process", metric: "240ms" },
        { time: "01.45", msg: "INDEX: Contributor map updated.", type: "success" },
        { time: "02.10", msg: "COMPUTE: MTTR aggregates calculating...", type: "process", metric: "12kb/s" },
        { time: "02.30", msg: "SYNC: Pushing shards to primary DB...", type: "info" },
    ];

    useEffect(() => {
        const statuses = [
            "Fetching PRs...",
            "Computing DORA Metrics...",
            "Analyzing Cycle Time...",
            "Mapping Contributors...",
            "Finalizing Graph..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            setFadeOut(true);
            setTimeout(() => {
                i = (i + 1) % statuses.length;
                setStatusText(statuses[i]);
                setFadeOut(false);
            }, 500);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (progress < 98) {
                setProgress(prev => Math.min(prev + Math.random() * 5, 98));
            }
        }, 800);
        return () => clearInterval(interval);
    }, [progress]);

    useEffect(() => {
        const addLog = () => {
            const log = mockLogs[logIndex.current % mockLogs.length];
            setLogs(prev => [...prev.slice(-4), log]);
            logIndex.current++;
            setTimeout(addLog, 800 + Math.random() * 1200);
        };
        const timeout = setTimeout(addLog, 500);
        return () => clearTimeout(timeout);
    }, []);

    const getLogColor = (type) => {
        if (type === "warn") return "text-error";
        if (type === "success") return "text-tertiary-fixed";
        if (type === "process") return "text-primary";
        return "text-on-surface-variant";
    };

    return (
        <div className="bg-background text-on-surface w-screen h-screen overflow-hidden relative">
            <div className="fixed inset-0 grid-bg z-0 pointer-events-none"></div>
            <div className="absolute inset-0 z-0 opacity-40">
                <ShaderBackground opacity="opacity-100" />
            </div>

            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-md">
                <div className="relative flex flex-col items-center w-full max-w-[600px] bg-surface-container-low/60 backdrop-blur-[20px] border border-outline-variant/30 rounded-xl p-xl shadow-[0_0_40px_rgba(128,131,255,0.1)]">
                    {/* Optical Corner */}
                    <div className="optical-corner"></div>

                    {/* Double-Ring Circular Progress */}
                    <div className="relative w-[180px] h-[180px] mb-lg flex items-center justify-center">
                        {/* Center Core */}
                        <div className="absolute w-2 h-2 bg-secondary rounded-full shadow-[0_0_15px_rgba(76,215,246,1)] animate-pulse"></div>
                        <div className="absolute w-8 h-8 rounded-full border border-secondary/30"></div>
                        {/* Inner Cyan Ring */}
                        <svg className="absolute w-[130px] h-[130px] animate-[spin_3s_linear_infinite_reverse]" viewBox="0 0 100 100">
                            <circle className="stroke-secondary/10" cx="50" cy="50" fill="none" r="46" strokeWidth="2" />
                            <circle className="stroke-secondary drop-shadow-[0_0_8px_rgba(76,215,246,0.6)]" cx="50" cy="50" fill="none" r="46" strokeDasharray="80 180" strokeLinecap="round" strokeWidth="2" />
                        </svg>
                        {/* Outer Indigo Ring */}
                        <svg className="absolute w-[180px] h-[180px] animate-[spin_5s_linear_infinite]" viewBox="0 0 100 100">
                            <circle className="stroke-primary/10" cx="50" cy="50" fill="none" r="48" strokeWidth="1.5" />
                            <circle className="stroke-primary drop-shadow-[0_0_10px_rgba(192,193,255,0.5)]" cx="50" cy="50" fill="none" r="48" strokeDasharray="100 200" strokeLinecap="round" strokeWidth="1.5" />
                            <circle className="fill-primary" cx="50" cy="2" r="1.5" />
                            <circle className="fill-primary" cx="50" cy="98" r="1.5" />
                        </svg>
                    </div>

                    {/* Status Text with Fade */}
                    <div className="h-12 flex items-center justify-center mb-md">
                        <h2 className={`font-headline-lg text-headline-lg text-on-surface tracking-tight fade-transition ${fadeOut ? 'fade-out' : ''}`}>
                            {statusText}
                        </h2>
                    </div>

                    {/* Linear Progress Bar */}
                    <div className="w-full flex flex-col gap-sm mb-xl">
                        <div className="flex justify-between items-end">
                            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">System Ingestion</span>
                            <span className="font-code-md text-code-md text-secondary">{Math.floor(progress)}%</span>
                        </div>
                        <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden relative">
                            <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(76,215,246,0.5)]"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Terminal Log Feed */}
                    <div className="w-full bg-[#030711]/80 backdrop-blur-[20px] border border-outline-variant/40 rounded-lg p-md h-[180px] relative overflow-hidden flex flex-col">
                        {/* Fade Gradients */}
                        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#030711] to-transparent z-10 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#030711] to-transparent z-10 pointer-events-none"></div>
                        {/* Terminal Header */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-outline-variant/30 z-20">
                            <div className="w-2 h-2 rounded-full bg-error/50"></div>
                            <div className="w-2 h-2 rounded-full bg-primary/50"></div>
                            <div className="w-2 h-2 rounded-full bg-tertiary/50"></div>
                            <span className="ml-2 font-label-caps text-[10px] text-on-surface-variant/50">INGESTION_TTY</span>
                        </div>
                        {/* Logs */}
                        <div className="flex-1 overflow-hidden flex flex-col justify-end gap-1 pb-4 z-0">
                            {logs.map((log, i) => (
                                <div key={i} className="log-entry font-code-md text-code-md flex items-start gap-2">
                                    <span className="text-secondary/60 w-[45px] shrink-0">[{log.time}]</span>
                                    <span className={getLogColor(log.type)}>{log.msg}</span>
                                    {log.metric && <span className="text-on-surface-variant/40 text-[12px] ml-auto">{log.metric}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Dashboard View ─────────────────────────────────────────────────────────
function Dashboard({ repo, data, summary, load, setData }) {
    const churn = data.churn_files || [];
    const trend = data.cycle_trend || [];
    const dora = data.dora || {};
    const contribs = data.authors || [];

    const sizes = data.pr_sizes || {};
    const sizeData = [
        { name: "X-Small", value: sizes["XS"] || 0 },
        { name: "Small", value: sizes["S"] || 0 },
        { name: "Medium", value: sizes["M"] || 0 },
        { name: "Large", value: sizes["L"] || 0 },
        { name: "X-Large", value: sizes["XL"] || 0 }
    ];

    // Prepare cycle trend with short week labels
    const trendFormatted = trend.map(t => ({
        ...t,
        week: t.week_start ? t.week_start.slice(5) : t.week || ""
    }));

    const chartTheme = {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        fill: "#908fa0"
    };



    return (
        <div className="min-h-screen bg-background text-on-background relative">
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20 grid-bg"></div>
            <div className="fixed inset-0 z-0 opacity-40">
                <ShaderBackground opacity="opacity-100" />
            </div>

            {/* Top Nav Bar */}
            <header className="hidden md:flex items-center justify-between px-xl w-full z-40 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 sticky top-0 h-[72px]">
                <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-primary text-[28px]">terminal</span>
                    <span className="font-display-lg text-[20px] font-bold text-glow tracking-tight">{repo}</span>
                    <div className="h-4 w-px bg-outline-variant/50 mx-sm"></div>
                    <span className="bg-tertiary/20 text-tertiary px-sm py-xs rounded text-xs font-code-md font-bold uppercase tracking-widest border border-tertiary/30">Active</span>
                </div>
                <div className="flex items-center gap-md">
                    <button className="bg-primary/10 text-primary border border-primary/30 px-4 py-1.5 rounded text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2" onClick={load}>
                        <div className="w-2 h-2 rounded-full bg-secondary pulse-indicator"></div>
                        Sync
                    </button>
                    <button className="h-10 px-md rounded-md font-code-md text-sm border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors" onClick={() => setData(null)}>Change Repo</button>
                    <button className="h-10 px-md rounded-md font-code-md text-sm bg-primary-container text-on-primary-container hover:bg-inverse-primary transition-colors flex items-center gap-xs font-bold btn-glow-hover" onClick={load}>
                        <span className="material-symbols-outlined text-[18px]">refresh</span> Reload
                    </button>
                </div>
            </header>

            {/* Mobile Header */}
            <header className="md:hidden flex items-center justify-between px-md py-sm bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 sticky top-0 z-40">
                <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary text-[28px]">terminal</span>
                    <span className="font-display-lg text-[18px] font-bold text-glow tracking-tight">{repo}</span>
                </div>
                <div className="flex items-center gap-sm">
                    <button className="h-9 px-sm rounded-md font-code-md text-xs border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors" onClick={() => setData(null)}>Change</button>
                    <button className="h-9 px-sm rounded-md font-code-md text-xs bg-primary-container text-on-primary-container hover:bg-inverse-primary transition-colors flex items-center gap-xs font-bold btn-glow-hover" onClick={load}>
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-[1440px] mx-auto px-xl pt-lg pb-3xl relative z-10">
                <div className="max-w-[1400px] mx-auto">
                    {/* Page Header */}
                    <div className="mb-lg flex justify-between items-end animate-fade-in-up">
                        <div>
                            <h1 className="font-headline-lg text-headline-lg mb-1">System Overview</h1>
                            <p className="text-on-surface-variant font-code-md text-sm opacity-80">Live telemetry from {repo} • Last updated: just now</p>
                        </div>
                    </div>

                    {/* DORA Metrics Grid — 4 columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-margin" id="dora">
                        {/* Deploy Freq */}
                        <div className="glass-panel optical-corner p-md rounded-lg flex flex-col justify-between h-[140px] hover:glow-bloom transition-all animate-fade-in-up animate-delay-100">
                            <div className="flex justify-between items-start">
                                <span className="text-sm font-code-md text-on-surface-variant">Deploy Freq</span>
                                <span className="material-symbols-outlined text-secondary text-sm">rocket_launch</span>
                            </div>
                            <div>
                                <div className="font-display-lg text-[32px] font-bold text-primary mb-1">
                                    {dora.deployment_frequency_per_week || 0}<span className="text-sm text-on-surface-variant ml-1 font-normal">/wk</span>
                                </div>
                            </div>
                        </div>
                        {/* Lead Time */}
                        <div className="glass-panel optical-corner p-md rounded-lg flex flex-col justify-between h-[140px] hover:glow-bloom transition-all animate-fade-in-up animate-delay-200">
                            <div className="flex justify-between items-start">
                                <span className="text-sm font-code-md text-on-surface-variant">Lead Time</span>
                                <span className="material-symbols-outlined text-secondary text-sm">timelapse</span>
                            </div>
                            <div>
                                <div className="font-display-lg text-[32px] font-bold text-primary mb-1">
                                    {dora.lead_time_hours?.toFixed(1) || 0}<span className="text-sm text-on-surface-variant ml-1 font-normal">hrs</span>
                                </div>
                            </div>
                        </div>
                        {/* Failure Rate */}
                        <div className="glass-panel optical-corner p-md rounded-lg flex flex-col justify-between h-[140px] hover:glow-bloom transition-all animate-fade-in-up animate-delay-300">
                            <div className="flex justify-between items-start">
                                <span className="text-sm font-code-md text-on-surface-variant">Failure Rate</span>
                                <span className="material-symbols-outlined text-error text-sm">error</span>
                            </div>
                            <div>
                                <div className="font-display-lg text-[32px] font-bold text-error mb-1">
                                    {dora.change_failure_rate_pct?.toFixed(1) || 0}<span className="text-sm text-on-surface-variant ml-1 font-normal">%</span>
                                </div>
                            </div>
                        </div>
                        {/* Merged PRs */}
                        <div className="glass-panel optical-corner p-md rounded-lg flex flex-col justify-between h-[140px] hover:glow-bloom transition-all animate-fade-in-up animate-delay-400">
                            <div className="flex justify-between items-start">
                                <span className="text-sm font-code-md text-on-surface-variant">Merged PRs</span>
                                <span className="material-symbols-outlined text-secondary text-sm">merge_type</span>
                            </div>
                            <div>
                                <div className="font-display-lg text-[32px] font-bold text-primary mb-1">
                                    {dora.total_prs_merged || 0}
                                </div>
                                <div className="text-xs text-on-surface-variant flex items-center gap-1">Period total</div>
                            </div>
                        </div>
                    </div>

                    {/* AI Health Summary — full width */}
                    <div className="glass-panel optical-corner p-md rounded-lg border-l-4 border-l-secondary mb-gutter animate-fade-in-up animate-delay-500" id="ai">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-secondary">psychology</span>
                            <h3 className="font-headline-md text-lg">AI System Analysis</h3>
                        </div>
                        <div className="font-code-md text-sm text-on-surface-variant leading-relaxed">
                            {summary ? (
                                <p>{summary}</p>
                            ) : (
                                <p className="text-primary font-bold animate-pulse">Analyzing Patterns...</p>
                            )}
                        </div>
                    </div>

                    {/* Cycle Time & PR Size Row */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-gutter mb-margin" id="cycle">
                        <div className="glass-panel optical-corner rounded-lg p-lg">
                            <h3 className="font-code-md text-xs text-outline-variant uppercase tracking-widest font-bold mb-lg flex items-center gap-sm">
                                <span className="material-symbols-outlined text-[16px]">trending_up</span> Cycle Time Over Time
                            </h3>
                            <div className="h-[240px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendFormatted}>
                                        <XAxis dataKey="week" stroke="#464554" tick={chartTheme} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis stroke="#464554" tick={chartTheme} axisLine={false} tickLine={false} dx={-10} />
                                        <Tooltip contentStyle={{ backgroundColor: "#0b1323", borderColor: "#1E3A5F", borderRadius: "8px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} itemStyle={{ color: "#c0c1ff" }} />
                                        <Line type="monotone" dataKey="avg_cycle_time_hours" stroke="#c0c1ff" strokeWidth={3} dot={{ fill: "#0b1323", stroke: "#c0c1ff", strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: "#4cd7f6", stroke: "#0b1323" }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="glass-panel optical-corner rounded-lg p-lg">
                            <h3 className="font-code-md text-xs text-outline-variant uppercase tracking-widest font-bold mb-lg flex items-center gap-sm">
                                <span className="material-symbols-outlined text-[16px]">bar_chart</span> PR Size Distribution
                            </h3>
                            <div className="h-[240px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={sizeData}>
                                        <XAxis dataKey="name" stroke="#464554" tick={chartTheme} axisLine={false} tickLine={false} dy={10} />
                                        <Tooltip cursor={{ fill: "rgba(192,193,255,0.05)" }} contentStyle={{ backgroundColor: "#0b1323", borderColor: "#1E3A5F", borderRadius: "8px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px" }} />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {sizeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={sizeColors[index % sizeColors.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Churn Files & Contributors */}
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-gutter" id="churn">
                        <div className="glass-panel optical-corner rounded-lg p-lg flex flex-col">
                            <h3 className="font-code-md text-xs text-outline-variant uppercase tracking-widest font-bold mb-lg flex items-center gap-sm">
                                <span className="material-symbols-outlined text-[16px]">local_fire_department</span> High Churn Files
                            </h3>
                            <div className="bg-surface-container rounded-lg border border-outline-variant/30 overflow-hidden flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-outline-variant/30 bg-surface-container-high/50">
                                            <th className="font-code-md text-xs font-bold text-outline-variant p-md">File Path</th>
                                            <th className="font-code-md text-xs font-bold text-outline-variant p-md text-right w-24">PR Count</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-code-md text-sm">
                                        {churn.map((f, i) => (
                                            <tr key={i} className="border-b border-outline-variant/10 hover:bg-surface-container-high/30 transition-colors">
                                                <td className="p-md text-on-surface truncate max-w-[200px] xl:max-w-[400px]">{f.filename}</td>
                                                <td className="p-md text-right text-error font-bold">{f.pr_count}</td>
                                            </tr>
                                        ))}
                                        {churn.length === 0 && (
                                            <tr><td colSpan="2" className="p-md text-center text-outline-variant italic">No data available</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="flex flex-col gap-gutter" id="contributors">
                            <div className="glass-panel optical-corner rounded-lg p-lg flex-1">
                                <h3 className="font-code-md text-xs text-outline-variant uppercase tracking-widest font-bold mb-md flex items-center gap-sm">
                                    <span className="material-symbols-outlined text-[16px]">groups</span> Top Contributors
                                </h3>
                                <div className="flex flex-col gap-sm">
                                    {contribs.slice(0, 8).map((c, i) => (
                                        <div key={i} className="flex items-center justify-between p-sm rounded border border-outline-variant/10 hover:border-outline-variant/30 bg-surface-container/50 transition-colors">
                                            <div className="flex items-center gap-sm">
                                                <div className="w-8 h-8 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-display-lg text-sm font-bold uppercase">
                                                    {c.author.substring(0, 2)}
                                                </div>
                                                <span className="font-body-md text-sm font-bold">{c.author}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="font-code-md text-xs text-outline-variant">{c.pr_count} PRs</span>
                                                {c.avg_cycle_time_hours && <span className="font-code-md text-[10px] text-on-surface-variant/50">{c.avg_cycle_time_hours}h avg</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// ─── App Root ───────────────────────────────────────────────────────────────
export default function App() {
    const [view, setView] = useState("hero"); // hero | connect | ingesting | dashboard
    const [repo, setRepo] = useState("fastapi/fastapi");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [ingesting, setIngesting] = useState(false);
    const [error, setError] = useState(null);
    const [ingestMsg, setIngestMsg] = useState(null);
    const [summary, setSummary] = useState(null);

    const load = () => {
        setLoading(true);
        setError(null);
        const parts = repo.split("/");
        if (parts.length !== 2) {
            setError("Format must be owner/repo");
            setLoading(false);
            return;
        }
        axios.get(`${API}/metrics/${parts[0]}/${parts[1]}`).then(res => {
            setData(res.data);
            setView("dashboard");
            axios.get(`${API}/summary/${parts[0]}/${parts[1]}`).then(r => {
                setSummary(r.data.summary);
            }).catch(e => console.error("Summary error:", e));
        }).catch(err => {
            if (err.response && err.response.status === 404) {
                setError(`Repo not found. Click "Run full ingestion instead".`);
            } else {
                setError("API error: " + err.message);
            }
        }).finally(() => setLoading(false));
    };

    const ingest = () => {
        setIngesting(true);
        setIngestMsg(null);
        setError(null);
        setView("ingesting");
        axios.post(`${API}/ingest`, { repo: repo.trim(), max_prs: 50 }).then(res => {
            setIngestMsg(res.data.message);
            setIngesting(false);
            load(); // reload dashboard
        }).catch(err => {
            setError("Ingestion failed: " + err.message);
            setIngesting(false);
            setView("connect");
        });
    };

    // Route back to connect when clearing data
    useEffect(() => {
        if (!data && view === "dashboard") {
            setView("connect");
            setSummary(null);
        }
    }, [data]);

    if (view === "hero") {
        return <HeroLanding onGetStarted={() => setView("connect")} />;
    }

    if (view === "ingesting") {
        return <IngestingView repo={repo} />;
    }

    if (view === "dashboard" && data) {
        return (
            <Dashboard
                repo={repo}
                data={data}
                summary={summary}
                load={load}
                setData={setData}
            />
        );
    }

    return (
        <ConnectRepo
            repo={repo}
            setRepo={setRepo}
            load={load}
            ingest={ingest}
            loading={loading}
            ingesting={ingesting}
            error={error}
            ingestMsg={ingestMsg}
        />
    );
}
