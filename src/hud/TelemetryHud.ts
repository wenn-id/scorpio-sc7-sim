import type { SimMode, SimulationState } from '../sim/types.ts';

export interface HudCallbacks {
  onToggleOrbit(): void;
  onChangeMode(mode: SimMode): void;
  onToggleWireframe(): void;
  onResetCamera(): void;
}

interface ServoDomRow {
  fill: HTMLElement;
  pct: HTMLElement;
}

const GAUGE_ARC_LEN = 142.42;

export class TelemetryHud {
  private root: HTMLElement;
  private onlinePill!: HTMLElement;
  private standbyPill!: HTMLElement;
  private clockEl!: HTMLElement;
  private azEl!: HTMLElement;
  private elvEl!: HTMLElement;
  private distEl!: HTMLElement;
  private busEl!: HTMLElement;
  private graphCanvas!: HTMLCanvasElement;
  private graphCtx!: CanvasRenderingContext2D;
  private torqueArc!: SVGPathElement;
  private torqueVal!: SVGTextElement;
  private psiArc!: SVGPathElement;
  private psiVal!: SVGTextElement;
  private modeTextEl!: HTMLElement;
  private driftTextEl!: HTMLElement;
  private servoRows: Map<string, ServoDomRow> = new Map();
  private orbitBtn: HTMLButtonElement | null = null;
  private wireBtn: HTMLButtonElement | null = null;
  private modeBtns: Map<SimMode, HTMLButtonElement> = new Map();

  constructor(container: HTMLElement, isRecordMode: boolean, callbacks: HudCallbacks) {
    this.root = container;
    this.root.innerHTML = this.buildMarkup(isRecordMode);
    this.bindElements(isRecordMode, callbacks);
  }

  private buildMarkup(isRecordMode: boolean): string {
    const controlsHtml = isRecordMode
      ? ''
      : `
      <div class="live-controls">
        <button class="hud-btn" data-action="orbit">Pause Orbit</button>
        <button class="hud-btn" data-action="wire">CAD Wire</button>
        <button class="hud-btn" data-action="reset">Reset Cam</button>
        <button class="hud-btn active" data-mode="idle">Idle</button>
        <button class="hud-btn" data-mode="pincer">Pincer</button>
        <button class="hud-btn" data-mode="calibrate">Calibrate</button>
      </div>`;

    // 240-deg arc centered at (55, 46), radius 34 => M 25.56 63 A 34 34 0 1 1 84.44 63
    const arcPath = 'M 25.56 63 A 34 34 0 1 1 84.44 63';

    return `
      <section class="hud-panel hud-top-left">
        <div class="unit-title">SCORPIO SC-7</div>
        <div class="unit-sub">3D CAD ROBOTICS FIELD SIMULATOR // REV 4.2</div>
        <div class="status-row">
          <div class="status-pill online" id="hud-online"><span class="status-dot"></span>ONLINE</div>
          <div class="status-pill standby" id="hud-standby"><span class="status-dot"></span>OPERATION: STANDBY</div>
        </div>
      </section>

      <section class="hud-panel hud-top-right">
        <div class="hud-panel-header">
          <span>ORBIT TELEMETRY</span>
          <span id="hud-clock">T+00.00S</span>
        </div>
        <div class="cam-metrics">
          <div class="metric-item"><span class="metric-label">AZIMUTH</span><span class="metric-val" id="hud-az">000.0°</span></div>
          <div class="metric-item"><span class="metric-label">ELEV</span><span class="metric-val" id="hud-elv">+20.6°</span></div>
          <div class="metric-item"><span class="metric-label">RANGE</span><span class="metric-val" id="hud-dist">4.35 M</span></div>
          <div class="metric-item"><span class="metric-label">BUS V</span><span class="metric-val" id="hud-bus">47.8 V</span></div>
        </div>
        ${controlsHtml}
      </section>

      <aside class="hud-left-col">
        <section class="hud-panel">
          <div class="hud-panel-header">
            <span>REAL-TIME OSCILLATION</span>
            <span>HYD / GYRO / BUS</span>
          </div>
          <canvas class="graph-canvas" id="hud-graph" width="268" height="124"></canvas>
        </section>

        <section class="hud-panel">
          <div class="hud-panel-header">
            <span>ACTUATOR GAUGES</span>
            <span>NOMINAL</span>
          </div>
          <div class="gauge-grid">
            <div class="gauge-card">
              <svg class="gauge-svg" viewBox="0 0 110 82">
                <path d="${arcPath}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="6.5" stroke-linecap="round"/>
                <path id="gauge-torque-arc" d="${arcPath}" fill="none" stroke="#39e58c" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="${GAUGE_ARC_LEN}" stroke-dashoffset="55"/>
                <text id="gauge-torque-val" x="55" y="51" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700">61%</text>
              </svg>
              <div class="gauge-caption">MAIN TORQUE</div>
            </div>
            <div class="gauge-card">
              <svg class="gauge-svg" viewBox="0 0 110 82">
                <path d="${arcPath}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="6.5" stroke-linecap="round"/>
                <path id="gauge-psi-arc" d="${arcPath}" fill="none" stroke="#ff7a29" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="${GAUGE_ARC_LEN}" stroke-dashoffset="48"/>
                <text id="gauge-psi-val" x="55" y="51" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="700">2840</text>
              </svg>
              <div class="gauge-caption">HYD PSI</div>
            </div>
          </div>
        </section>
      </aside>

      <aside class="hud-panel hud-right-col">
        <div class="hud-panel-header">
          <span>SERVO LOAD MATRIX</span>
          <span>16 CH LIVE</span>
        </div>
        <div class="servo-list" id="hud-servo-list"></div>
      </aside>

      <footer class="hud-panel hud-bottom-bar">
        <span>DIAGNOSTIC MODE: <strong id="hud-mode-text">IDLE</strong> // GYRO DRIFT: <strong id="hud-drift-text">0.00°</strong> // FLOOR LOCK: <strong>8/8 PADS</strong></span>
        <span>CERAMIC-TI CHASSIS // STUDIO DIFFUSED // <strong>60.0 FPS</strong></span>
      </footer>
    `;
  }

  private bindElements(isRecordMode: boolean, callbacks: HudCallbacks): void {
    this.onlinePill = this.root.querySelector('#hud-online')!;
    this.standbyPill = this.root.querySelector('#hud-standby')!;
    this.clockEl = this.root.querySelector('#hud-clock')!;
    this.azEl = this.root.querySelector('#hud-az')!;
    this.elvEl = this.root.querySelector('#hud-elv')!;
    this.distEl = this.root.querySelector('#hud-dist')!;
    this.busEl = this.root.querySelector('#hud-bus')!;
    this.graphCanvas = this.root.querySelector('#hud-graph')!;
    this.graphCtx = this.graphCanvas.getContext('2d')!;
    this.torqueArc = this.root.querySelector('#gauge-torque-arc')!;
    this.torqueVal = this.root.querySelector('#gauge-torque-val')!;
    this.psiArc = this.root.querySelector('#gauge-psi-arc')!;
    this.psiVal = this.root.querySelector('#gauge-psi-val')!;
    this.modeTextEl = this.root.querySelector('#hud-mode-text')!;
    this.driftTextEl = this.root.querySelector('#hud-drift-text')!;

    if (!isRecordMode) {
      this.orbitBtn = this.root.querySelector('[data-action="orbit"]');
      this.wireBtn = this.root.querySelector('[data-action="wire"]');
      const resetBtn = this.root.querySelector('[data-action="reset"]');
      this.orbitBtn?.addEventListener('click', () => callbacks.onToggleOrbit());
      this.wireBtn?.addEventListener('click', () => callbacks.onToggleWireframe());
      resetBtn?.addEventListener('click', () => callbacks.onResetCamera());

      this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
        const mode = btn.dataset.mode as SimMode;
        this.modeBtns.set(mode, btn);
        btn.addEventListener('click', () => callbacks.onChangeMode(mode));
      });
    }
  }

  private ensureServoRows(state: SimulationState): void {
    if (this.servoRows.size > 0) return;
    const container = this.root.querySelector('#hud-servo-list')!;
    for (const s of state.telemetry.servos) {
      const row = document.createElement('div');
      row.className = 'servo-row';

      const name = document.createElement('span');
      name.className = 'servo-name';
      name.textContent = s.label;

      const track = document.createElement('div');
      track.className = 'servo-track';
      const fill = document.createElement('div');
      fill.className = 'servo-fill';
      track.appendChild(fill);

      const pct = document.createElement('span');
      pct.className = 'servo-pct';
      pct.textContent = '0%';

      row.append(name, track, pct);
      container.appendChild(row);
      this.servoRows.set(s.id, { fill, pct });
    }
  }

  private drawOscilloscope(state: SimulationState): void {
    const ctx = this.graphCtx;
    const w = this.graphCanvas.width;
    const h = this.graphCanvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 44) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, h);
      ctx.stroke();
    }
    for (let gy = 0; gy <= h; gy += 31) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(w, gy + 0.5);
      ctx.stroke();
    }

    const traces: Array<{ data: number[]; color: string }> = [
      { data: state.telemetry.graphSamples.hydraulic, color: '#39e58c' },
      { data: state.telemetry.graphSamples.gyro, color: '#ff7a29' },
      { data: state.telemetry.graphSamples.busLoad, color: '#78b7e8' }
    ];

    for (const trace of traces) {
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      trace.data.forEach((v, idx) => {
        const x = (idx / (trace.data.length - 1)) * w;
        const y = h - v * (h - 16) - 8;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  update(state: SimulationState, orbitPaused: boolean, wireframeOn: boolean): void {
    this.ensureServoRows(state);
    const tel = state.telemetry;

    this.onlinePill.style.opacity = tel.onlineFlicker.toFixed(3);
    this.standbyPill.style.opacity = tel.standbyFlicker.toFixed(3);

    this.clockEl.textContent = `T+${tel.timeSec.toFixed(2).padStart(5, '0')}S`;
    const degAz = (((state.cameraAzimuth * 180) / Math.PI) % 360 + 360) % 360;
    this.azEl.textContent = `${degAz.toFixed(1).padStart(5, '0')}°`;
    this.elvEl.textContent = `+${((state.cameraElevation * 180) / Math.PI).toFixed(1)}°`;
    this.distEl.textContent = `${state.cameraDistance.toFixed(2)} M`;
    this.busEl.textContent = `${tel.busVoltage.toFixed(1)} V`;

    const torqueRatio = tel.mainTorquePct / 100;
    this.torqueArc.setAttribute('stroke-dashoffset', (GAUGE_ARC_LEN * (1 - torqueRatio)).toFixed(1));
    this.torqueVal.textContent = `${Math.round(tel.mainTorquePct)}%`;

    const psiRatio = Math.min(1, Math.max(0, (tel.hydraulicPsi - 1800) / 1600));
    this.psiArc.setAttribute('stroke-dashoffset', (GAUGE_ARC_LEN * (1 - psiRatio)).toFixed(1));
    this.psiVal.textContent = `${Math.round(tel.hydraulicPsi)}`;

    this.drawOscilloscope(state);

    for (const s of tel.servos) {
      const dom = this.servoRows.get(s.id);
      if (!dom) continue;
      dom.fill.style.width = `${s.pct.toFixed(1)}%`;
      dom.pct.textContent = `${Math.round(s.pct)}%`;
    }

    this.modeTextEl.textContent = state.mode.toUpperCase();
    this.driftTextEl.textContent = `${tel.gyroDriftDeg.toFixed(2)}°`;

    if (this.orbitBtn) {
      this.orbitBtn.textContent = orbitPaused ? 'Resume Orbit' : 'Pause Orbit';
      this.orbitBtn.classList.toggle('active', !orbitPaused);
    }
    if (this.wireBtn) {
      this.wireBtn.classList.toggle('active', wireframeOn);
    }
    this.modeBtns.forEach((btn, mode) => {
      btn.classList.toggle('active', mode === state.mode);
    });
  }

  dispose(): void {
    this.root.innerHTML = '';
  }
}
