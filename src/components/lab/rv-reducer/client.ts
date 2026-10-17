import {
  createDisassemblyController,
  createDisassemblyLifecycle,
  readDisassemblyParts,
} from '../_shared/disassembly/client';
import type { AddonContext } from '../_shared/disassembly/types';
import { rvCopy, rvModes, RV_TIME_FACTOR, type RvLocale, type RvStage } from './copy';
import { createRvModel, kinematics, type RvParameters } from './math';
import { prepareRvParameters, RV_DEFAULT_PARAMETERS } from './params';
import type { createRvViewer } from './viewer';

type Viewer = ReturnType<typeof createRvViewer>;
function mountRvAddon(context: AddonContext<string, RvStage, Viewer>, locale: RvLocale) {
  const { root, query, all, setText, signal } = context;
  const copy = rvCopy[locale];
  const parts = readDisassemblyParts(root);
  let parameters = { ...RV_DEFAULT_PARAMETERS };
  let model = createRvModel(parameters);
  let rpm = 1200;
  let playing = false;
  let explode = 1;
  let phase = 0;
  let announceTimer = 0;
  let parameterTimer = 0;
  const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));
  function updateReadings(announce = false) {
    const state = kinematics(model, 0, rpm);
    setText('[data-rv-ratio]', format(model.metrics.ratio));
    setText('[data-rv-output-rpm]', state.outputRpm.toFixed(2));
    setText('[data-rv-displayed-rpm]', (rpm * RV_TIME_FACTOR).toFixed(2));
    setText('[data-rv-lobes]', String(parameters.lobeCount));
    query<HTMLInputElement>('[data-rv-rpm]')?.setAttribute('aria-valuetext', `${rpm} rpm`);
    root.dataset.ratio = String(model.metrics.ratio);
    root.dataset.rpm = String(rpm);
    if (announce) {
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(() => {
        if (!context.disposed)
          setText(
            '[data-rv-result-live]',
            `${copy.calculation}: ${format(model.metrics.ratio)}; ${copy.outputSpeed}: ${state.outputRpm.toFixed(2)} rpm`,
          );
      }, 200);
    }
  }
  function status(text: string, error = false) {
    setText('[data-rv-parameter-status]', text);
    const element = query<HTMLElement>('[data-rv-parameter-status]');
    if (element) element.dataset.error = String(error);
  }
  function stop() {
    playing = false;
    context.viewer?.setPlaying(false);
    context.present();
  }
  function apply(next: RvParameters) {
    let nextModel;
    try {
      nextModel = prepareRvParameters(next).model;
    } catch {
      for (const input of all<HTMLInputElement>('[data-rv-teeth]'))
        input.setAttribute('aria-invalid', 'true');
      status(copy.invalid, true);
      return;
    }
    try {
      // Construct the replacement before releasing the current valid assembly.
      context.viewer?.setParameters(next);
    } catch {
      status(copy.rebuildError, true);
      return;
    }
    for (const input of all<HTMLInputElement>('[data-rv-teeth]'))
      input.removeAttribute('aria-invalid');
    parameters = { ...next };
    model = nextModel;
    phase = 0;
    stop();
    context.viewer?.setPhase(0);
    query<HTMLInputElement>('[data-rv-phase]')!.value = '0';
    setText('[data-rv-phase-output]', '0°');
    updateReadings(true);
    status(root.dataset.renderer === 'webgl' ? copy.applied : copy.appliedStatic);
  }
  function applyInputs() {
    window.clearTimeout(parameterTimer);
    if (context.disposed) return;
    const next = { ...parameters };
    let valid = true;
    for (const input of all<HTMLInputElement>('[data-rv-teeth]')) {
      const value = input.valueAsNumber;
      const accepted =
        Number.isSafeInteger(value) && value >= Number(input.min) && value <= Number(input.max);
      input.setAttribute('aria-invalid', String(!accepted));
      if (!accepted) valid = false;
      else next[input.dataset.rvTeeth as 'sunTeeth' | 'planetTeeth' | 'pinCount'] = value;
    }
    if (!valid) {
      status(copy.integerError, true);
      return;
    }
    next.lobeCount = next.pinCount - 1;
    apply(next);
  }
  query<HTMLFormElement>('[data-rv-teeth-form]')?.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      applyInputs();
    },
    { signal },
  );
  for (const input of all<HTMLInputElement>('[data-rv-teeth]')) {
    input.addEventListener(
      'input',
      () => {
        input.removeAttribute('aria-invalid');
        status(copy.pending);
        window.clearTimeout(parameterTimer);
        parameterTimer = window.setTimeout(applyInputs, 240);
      },
      { signal },
    );
    input.addEventListener('change', applyInputs, { signal });
  }
  query<HTMLButtonElement>('[data-rv-defaults]')?.addEventListener(
    'click',
    () => {
      window.clearTimeout(parameterTimer);
      for (const input of all<HTMLInputElement>('[data-rv-teeth]')) {
        input.value = String(RV_DEFAULT_PARAMETERS[input.dataset.rvTeeth as keyof RvParameters]);
        input.removeAttribute('aria-invalid');
      }
      apply({ ...RV_DEFAULT_PARAMETERS });
    },
    { signal },
  );
  for (const selector of ['[data-rv-rpm]', '[data-rv-rpm-number]']) {
    const input = query<HTMLInputElement>(selector);
    input?.addEventListener(
      'input',
      () => {
        const value = input.valueAsNumber;
        const speedStatus = query<HTMLElement>('[data-rv-speed-status]');
        if (!Number.isSafeInteger(value) || value < 0 || value > 3000) {
          input.setAttribute('aria-invalid', 'true');
          if (speedStatus) {
            speedStatus.hidden = false;
            speedStatus.dataset.error = 'true';
            speedStatus.textContent = copy.speedError.replace('{rpm}', String(rpm));
          }
          return;
        }
        input.removeAttribute('aria-invalid');
        if (speedStatus) {
          speedStatus.hidden = true;
          speedStatus.dataset.error = 'false';
          speedStatus.textContent = '';
        }
        rpm = value;
        for (const other of all<HTMLInputElement>('[data-rv-rpm], [data-rv-rpm-number]'))
          if (other !== input) {
            other.value = String(value);
            other.removeAttribute('aria-invalid');
          }
        context.viewer?.setRpm(rpm);
        updateReadings(true);
      },
      { signal },
    );
  }
  query<HTMLInputElement>('[data-rv-explode]')?.addEventListener(
    'input',
    (event) => {
      explode = (event.target as HTMLInputElement).valueAsNumber / 100;
      setText('[data-rv-explode-output]', `${Math.round(explode * 100)}%`);
      context.viewer?.setExplode(explode);
    },
    { signal },
  );
  query<HTMLInputElement>('[data-rv-phase]')?.addEventListener(
    'input',
    (event) => {
      stop();
      phase = ((event.target as HTMLInputElement).valueAsNumber * Math.PI) / 180;
      setText('[data-rv-phase-output]', `${Math.round((phase * 180) / Math.PI)}°`);
      context.viewer?.setPhase(phase);
    },
    { signal },
  );
  query<HTMLButtonElement>('[data-rv-play]')?.addEventListener(
    'click',
    () => {
      playing = !playing && !context.reduced.matches && root.dataset.renderer === 'webgl';
      context.viewer?.setPlaying(playing);
      context.present();
    },
    { signal },
  );
  for (const element of all<HTMLElement>('[data-l1-select], [data-l1-label]'))
    element.addEventListener(
      'click',
      () => {
        const part = parts.find((item) => item.id === context.selected);
        if (part) setText('[data-rv-selection-note]', `${copy.selected}: ${part.name}`);
      },
      { signal },
    );
  updateReadings();
  return {
    onPresentation() {
      const visible = root.dataset.renderer === 'webgl';
      if (root.dataset.renderer === 'fallback') playing = false;
      root.dataset.playing = String(playing && visible && !context.reduced.matches);
      const toggle = query<HTMLButtonElement>('[data-rv-play]');
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
        phase = angle;
        const degrees = ((((angle * 180) / Math.PI) % 360) + 360) % 360;
        const input = query<HTMLInputElement>('[data-rv-phase]');
        if (input) input.value = String(Math.round(degrees));
        setText('[data-rv-phase-output]', `${Math.round(degrees)}°`);
        const part = parts.find((item) => item.id === context.selected);
        if (part) setText('[data-rv-selection-note]', `${copy.selected}: ${part.name}`);
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
  selector: '[data-rv-reducer]',
  diagnosticName: 'rvReducerLifecycle',
  initialize(root, instance, onDispose) {
    const locale: RvLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
    return createDisassemblyController<string, RvStage, Viewer>(
      root,
      {
        parts: readDisassemblyParts(root),
        modes: rvModes(locale),
        defaultPartId: 'cycloid-disc',
        defaultMode: 'whole',
        keyboardDescriptionId: 'rv-keyboard',
        copy: rvCopy[locale],
        async loadViewer() {
          return (await import('./viewer')).createRvViewer;
        },
        mountAddon: (context) => mountRvAddon(context, locale),
      },
      instance,
      onDispose,
    );
  },
});
export const initializeRvReducers = lifecycle.initialize;
export const disposeRvReducers = lifecycle.dispose;
export const getRvReducerLifecycleSnapshot = lifecycle.snapshot;
