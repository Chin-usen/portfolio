import { formatDisplayNumber } from '../_shared/format-number';
import {
  createDisassemblyController,
  createDisassemblyLifecycle,
  readDisassemblyParts,
} from '../_shared/disassembly/client';
import type { AddonContext } from '../_shared/disassembly/types';
import {
  harmonicCopy,
  harmonicModes,
  HARMONIC_TIME_FACTOR,
  type HarmonicLocale,
  type HarmonicStage,
} from './copy';
import { createHarmonicModel, kinematics, type HarmonicParameters } from './math';
import { HARMONIC_DEFAULT_PARAMETERS } from './params';
import type { createHarmonicViewer } from './viewer';

type Viewer = ReturnType<typeof createHarmonicViewer>;
function mountHarmonicAddon(
  context: AddonContext<string, HarmonicStage, Viewer>,
  locale: HarmonicLocale,
) {
  const { root, query, all, setText, signal } = context;
  const copy = harmonicCopy[locale];
  const parts = readDisassemblyParts(root);
  let parameters = { ...HARMONIC_DEFAULT_PARAMETERS };
  let model = createHarmonicModel(parameters);
  let rpm = 1200;
  let playing = false;
  let explode = 1;
  let phase = 0;
  let announceTimer = 0;
  let parameterTimer = 0;
  const liveViewer = () => (root.dataset.renderer === 'fallback' ? null : context.viewer);
  function updateStaticStack() {
    const mechanism = new Set([
      'input-shaft',
      'wave-generator',
      'flexible-bearing',
      'flexspline',
      'circular-spline',
      'cross-roller-bearing',
      'output-flange',
    ]);
    all<SVGGElement>('[data-hd-static-layer]').forEach((layer, index) => {
      const id = layer.dataset.hdStaticLayer ?? '';
      const x = 180 + (index - 4) * (5 + 33 * explode);
      layer.setAttribute('transform', `translate(${x} 0)`);
      layer.dataset.selected = String(id === context.selected);
      layer.style.display = context.mode === 'mechanism' && !mechanism.has(id) ? 'none' : '';
    });
    const part = parts.find((item) => item.id === context.selected);
    if (part) setText('[data-hd-static-part-name]', `${copy.selected}: ${part.name}`);
  }
  function updatePhase() {
    const state = kinematics(model, phase, rpm);
    const totalDegrees = (phase * 180) / Math.PI;
    const degrees =
      totalDegrees >= 0 && totalDegrees <= 360 ? totalDegrees : ((totalDegrees % 360) + 360) % 360;
    const outputDegrees = (state.outputAngleRad * 180) / Math.PI;
    const input = query<HTMLInputElement>('[data-hd-phase]');
    if (input) {
      input.value = String(Math.round(degrees));
      input.setAttribute('aria-valuetext', `${Math.round(degrees)}°`);
    }
    setText('[data-hd-phase-output]', `${Math.round(degrees)}°`);
    setText('[data-hd-output-phase]', `${outputDegrees.toFixed(2)}°`);
    query<SVGGElement>('[data-hd-diagram-wave-group]')?.setAttribute(
      'transform',
      `rotate(${-degrees} 90 90)`,
    );
    query<SVGGElement>('[data-hd-diagram-output]')?.setAttribute(
      'transform',
      `rotate(${-outputDegrees} 90 90)`,
    );
    const amplitude = (model.metrics.displayDeformationMm / model.metrics.flexPitchRadiusMm) * 54;
    const flex = query<SVGEllipseElement>('[data-hd-diagram-flex]');
    flex?.setAttribute('rx', String(54 + amplitude));
    flex?.setAttribute('ry', String(54 - amplitude));
    const wave = query<SVGEllipseElement>('[data-hd-diagram-wave]');
    wave?.setAttribute('rx', String(43 + amplitude));
    wave?.setAttribute('ry', String(43 - amplitude));
    all<SVGCircleElement>('[data-hd-engagement]').forEach((zone, index) => {
      zone.setAttribute('cx', String(90 + (index === 0 ? 1 : -1) * (54 + amplitude)));
    });
    root.dataset.phase = String(phase);
    root.dataset.outputPhase = String(state.outputAngleRad);
  }
  function updateReadings(announce = false) {
    const state = kinematics(model, phase, rpm);
    setText('[data-hd-ratio]', formatDisplayNumber(model.metrics.ratio));
    setText('[data-hd-output-rpm]', state.outputRpm.toFixed(2));
    setText('[data-hd-displayed-rpm]', (rpm * HARMONIC_TIME_FACTOR).toFixed(2));
    setText('[data-hd-circular-teeth]', String(parameters.circularTeeth));
    setText('[data-hd-deformation]', model.metrics.nominalDeformationMm.toFixed(2));
    setText('[data-hd-display-deformation]', model.metrics.displayDeformationMm.toFixed(2));
    query<HTMLInputElement>('[data-hd-rpm]')?.setAttribute('aria-valuetext', `${rpm} rpm`);
    root.dataset.ratio = String(model.metrics.ratio);
    root.dataset.rpm = String(rpm);
    root.dataset.flexTeeth = String(parameters.flexTeeth);
    root.dataset.circularTeeth = String(parameters.circularTeeth);
    root.dataset.deformationMm = String(model.metrics.nominalDeformationMm);
    root.dataset.displayDeformationMm = String(model.metrics.displayDeformationMm);
    updatePhase();
    updateStaticStack();
    if (announce) {
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(() => {
        if (!context.disposed)
          setText(
            '[data-hd-result-live]',
            `${copy.calculation}: ${formatDisplayNumber(model.metrics.ratio)}; ${copy.outputSpeed}: ${state.outputRpm.toFixed(2)} rpm`,
          );
      }, 200);
    }
  }
  function status(text: string, error = false) {
    setText('[data-hd-parameter-status]', text);
    const element = query<HTMLElement>('[data-hd-parameter-status]');
    if (element) element.dataset.error = String(error);
  }
  function stop() {
    playing = false;
    liveViewer()?.setPlaying(false);
    context.present();
  }
  function apply(next: HarmonicParameters) {
    let nextModel;
    try {
      nextModel = createHarmonicModel(next);
    } catch {
      query<HTMLInputElement>('[data-hd-teeth]')?.setAttribute('aria-invalid', 'true');
      status(copy.invalid, true);
      return false;
    }
    try {
      // Preserve the last valid model if the viewer cannot construct its replacement.
      liveViewer()?.setParameters(next);
    } catch {
      status(copy.rebuildError, true);
      return false;
    }
    parameters = { ...next };
    model = nextModel;
    query<HTMLInputElement>('[data-hd-teeth]')?.removeAttribute('aria-invalid');
    phase = 0;
    stop();
    liveViewer()?.setPhase(phase);
    updateReadings(true);
    status(root.dataset.renderer === 'webgl' ? copy.applied : copy.appliedStatic);
    return true;
  }
  function applyInputs() {
    window.clearTimeout(parameterTimer);
    if (context.disposed) return;
    const input = query<HTMLInputElement>('[data-hd-teeth]');
    if (!input) return;
    const value = input.valueAsNumber;
    const accepted = Number.isSafeInteger(value) && value >= 80 && value <= 240 && value % 2 === 0;
    input.setAttribute('aria-invalid', String(!accepted));
    if (!accepted) {
      status(copy.invalid, true);
      return;
    }
    apply({ ...parameters, flexTeeth: value, circularTeeth: value + 2 });
  }
  query<HTMLFormElement>('[data-hd-teeth-form]')?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      applyInputs();
    },
    { signal },
  );
  const teethInput = query<HTMLInputElement>('[data-hd-teeth]');
  teethInput?.addEventListener(
    'input',
    () => {
      teethInput.removeAttribute('aria-invalid');
      status(copy.pending);
      window.clearTimeout(parameterTimer);
      parameterTimer = window.setTimeout(applyInputs, 240);
    },
    { signal },
  );
  teethInput?.addEventListener('change', applyInputs, { signal });
  function clearSpeedError() {
    const element = query<HTMLElement>('[data-hd-speed-status]');
    if (element) {
      element.hidden = true;
      element.dataset.error = 'false';
      element.textContent = '';
    }
  }
  function syncSpeed() {
    for (const input of all<HTMLInputElement>('[data-hd-rpm], [data-hd-rpm-number]')) {
      input.value = String(rpm);
      input.removeAttribute('aria-invalid');
    }
    clearSpeedError();
    liveViewer()?.setRpm(rpm);
    updateReadings(true);
  }
  query<HTMLButtonElement>('[data-hd-defaults]')?.addEventListener(
    'click',
    () => {
      window.clearTimeout(parameterTimer);
      if (!apply({ ...HARMONIC_DEFAULT_PARAMETERS })) return;
      if (teethInput) teethInput.value = String(parameters.flexTeeth);
      rpm = 1200;
      explode = 1;
      const explodeInput = query<HTMLInputElement>('[data-hd-explode]');
      if (explodeInput) explodeInput.value = '100';
      setText('[data-hd-explode-output]', '100%');
      root.dataset.explode = '1';
      updateStaticStack();
      liveViewer()?.setExplode(explode);
      syncSpeed();
    },
    { signal },
  );
  for (const input of all<HTMLInputElement>('[data-hd-rpm], [data-hd-rpm-number]')) {
    input.addEventListener(
      'input',
      () => {
        const value = input.valueAsNumber;
        if (!Number.isSafeInteger(value) || value < 0 || value > 3000) {
          input.setAttribute('aria-invalid', 'true');
          const element = query<HTMLElement>('[data-hd-speed-status]');
          if (element) {
            element.hidden = false;
            element.dataset.error = 'true';
            element.textContent = copy.speedError.replace('{rpm}', String(rpm));
          }
          return;
        }
        rpm = value;
        syncSpeed();
      },
      { signal },
    );
  }
  query<HTMLInputElement>('[data-hd-explode]')?.addEventListener(
    'input',
    (event) => {
      explode = (event.target as HTMLInputElement).valueAsNumber / 100;
      setText('[data-hd-explode-output]', `${Math.round(explode * 100)}%`);
      root.dataset.explode = String(explode);
      updateStaticStack();
      liveViewer()?.setExplode(explode);
    },
    { signal },
  );
  query<HTMLInputElement>('[data-hd-phase]')?.addEventListener(
    'input',
    (event) => {
      stop();
      phase = ((event.target as HTMLInputElement).valueAsNumber * Math.PI) / 180;
      liveViewer()?.setPhase(phase);
      updatePhase();
    },
    { signal },
  );
  query<HTMLButtonElement>('[data-hd-play]')?.addEventListener(
    'click',
    () => {
      playing = !playing && !context.reduced.matches && root.dataset.renderer === 'webgl';
      liveViewer()?.setPlaying(playing);
      context.present();
    },
    { signal },
  );
  root.addEventListener(
    'click',
    (event) => {
      if ((event.target as Element).closest('[data-l1-select], [data-l1-label]'))
        updateStaticStack();
    },
    { signal },
  );
  updateReadings();
  return {
    onMode() {
      updateStaticStack();
    },
    onPresentation() {
      updateStaticStack();
      const visible = root.dataset.renderer === 'webgl';
      if (!visible || context.reduced.matches) playing = false;
      root.dataset.playing = String(playing);
      const toggle = query<HTMLButtonElement>('[data-hd-play]');
      if (toggle) {
        toggle.disabled = !visible || context.reduced.matches;
        toggle.textContent = playing ? copy.pause : copy.play;
        toggle.setAttribute('aria-pressed', String(playing));
      }
    },
    onViewer(viewer: Viewer) {
      viewer.setParameters(parameters);
      viewer.setRpm(rpm);
      viewer.setExplode(explode);
      viewer.setPhase(phase);
      viewer.setPlaying(playing);
      viewer.setPhaseListener((angle) => {
        if (context.disposed) return;
        phase = angle;
        updatePhase();
      });
    },
    onReducedMotion() {
      playing = false;
    },
    dispose() {
      window.clearTimeout(announceTimer);
      window.clearTimeout(parameterTimer);
    },
  };
}
const lifecycle = createDisassemblyLifecycle<ReturnType<Viewer['getDiagnostics']>>({
  selector: '[data-harmonic-drive]',
  diagnosticName: 'harmonicDriveLifecycle',
  initialize(root, instance, onDispose) {
    const locale: HarmonicLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
    return createDisassemblyController<string, HarmonicStage, Viewer>(
      root,
      {
        parts: readDisassemblyParts(root),
        modes: harmonicModes(locale),
        defaultPartId: 'flexspline',
        defaultMode: 'whole',
        keyboardDescriptionId: 'hd-keyboard',
        copy: harmonicCopy[locale],
        async loadViewer() {
          return (await import('./viewer')).createHarmonicViewer;
        },
        mountAddon: (context) => mountHarmonicAddon(context, locale),
      },
      instance,
      onDispose,
    );
  },
});
export const initializeHarmonicDrives = lifecycle.initialize;
export const disposeHarmonicDrives = lifecycle.dispose;
export const getHarmonicDriveLifecycleSnapshot = lifecycle.snapshot;
