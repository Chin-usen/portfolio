import { bridgeCopy } from './copy';
import { DEFAULT_INDUCTANCE, parallelPlateInductance } from './inductance';
import type { BridgeMode, BridgeLocale, PartId, PartContent } from './types';
import type { createHalfBridgeViewer } from './viewer';
import {
  createDisassemblyController,
  createDisassemblyLifecycle,
} from '../_shared/disassembly/client';
import type { AddonContext } from '../_shared/disassembly/types';

type Viewer = ReturnType<typeof createHalfBridgeViewer>;

function mountBridgeAddon(context: AddonContext<PartId, BridgeMode, Viewer>, locale: BridgeLocale) {
  const { query, all, setText, signal, reduced, root } = context;
  const copy = bridgeCopy[locale];
  const params = { ...DEFAULT_INDUCTANCE };
  let playing = false;
  let announceTimer = 0;
  function updateParameters(announce = false) {
    if (context.disposed) return;
    const value = (parallelPlateInductance(params) * 1e9).toFixed(2);
    setText('[data-l1-inductance]', value);
    for (const key of ['d', 'w', 'l'] as const) {
      const text = key === 'd' ? params[key].toFixed(2) : String(params[key]);
      setText(`[data-l1-output="${key}"]`, text);
      query<HTMLInputElement>(`[data-l1-param="${key}"]`)?.setAttribute(
        'aria-valuetext',
        `${text} mm`,
      );
    }
    context.viewer?.setGap(params.d);
    if (announce) {
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(() => {
        if (!context.disposed) setText('[data-l1-result-live]', `${copy.inductance}: ${value} nH`);
      }, 200);
    }
  }
  for (const input of all<HTMLInputElement>('[data-l1-param]'))
    input.addEventListener(
      'input',
      () => {
        const key = input.dataset.l1Param as keyof typeof params;
        if (['d', 'w', 'l'].includes(key) && Number.isFinite(input.valueAsNumber)) {
          params[key] = input.valueAsNumber;
          updateParameters(true);
        }
      },
      { signal },
    );
  query<HTMLButtonElement>('[data-l1-motion]')?.addEventListener(
    'click',
    () => {
      playing = !playing && !reduced.matches;
      context.viewer?.setPlaying(playing);
      context.present();
    },
    { signal },
  );
  updateParameters();
  return {
    onMode() {
      playing = context.mode === 'commutation' && !reduced.matches;
      context.viewer?.setPlaying(playing);
    },
    onPresentation() {
      const commutation = context.mode === 'commutation';
      root.dataset.playing = String(playing && !reduced.matches);
      for (const element of all<HTMLElement>(
        '[data-l1-loop-label], [data-l1-loop-explanation], [data-l1-flux], [data-l1-flow]',
      ))
        element.hidden = !commutation;
      const toggle = query<HTMLButtonElement>('[data-l1-motion]');
      if (toggle) {
        toggle.hidden = !commutation || reduced.matches;
        toggle.setAttribute('aria-pressed', String(playing));
        toggle.textContent = playing ? copy.loopPause : copy.loopToggle;
      }
    },
    onViewer(viewer: Viewer) {
      viewer.setGap(params.d);
      viewer.setPlaying(playing);
    },
    onReducedMotion() {
      playing = false;
    },
    dispose() {
      window.clearTimeout(announceTimer);
    },
  };
}

const lifecycle = createDisassemblyLifecycle<ReturnType<Viewer['getDiagnostics']>>({
  selector: '[data-half-bridge]',
  diagnosticName: 'halfBridgeLifecycle',
  initialize(root, instance, onDispose) {
    const content = root.querySelector<HTMLScriptElement>('[data-l1-content]');
    if (!content) return null;
    const parts = JSON.parse(content.textContent || '[]') as PartContent[];
    const locale: BridgeLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
    const copy = bridgeCopy[locale];
    const local = (part: PartContent, key: 'name' | 'short' | 'role' | 'features' | 'material') =>
      part[`${key}${locale === 'zh' ? 'Zh' : 'En'}`];
    return createDisassemblyController<PartId, BridgeMode, Viewer>(
      root,
      {
        parts: parts.map((part) => ({
          id: part.partId,
          name: local(part, 'name'),
          short: local(part, 'short'),
          secondaryName: locale === 'zh' ? part.nameEn : part.nameZh,
          role: local(part, 'role'),
          features: local(part, 'features'),
          material: local(part, 'material'),
        })),
        modes: (['assembled', 'exploded', 'commutation'] as const).map((id) => ({
          id,
          label: copy[id],
          caption: copy[`${id}Caption`],
          showLabels: id === 'exploded',
        })),
        defaultPartId: 'busbar',
        defaultMode: 'exploded',
        keyboardDescriptionId: 'l1-keyboard',
        copy,
        async loadViewer() {
          return (await import('./viewer')).createHalfBridgeViewer;
        },
        mountAddon: (context) => mountBridgeAddon(context, locale),
      },
      instance,
      onDispose,
    );
  },
});

export const getHalfBridgeLifecycleSnapshot = lifecycle.snapshot;
export const disposeHalfBridges = lifecycle.dispose;
export const initializeHalfBridges = lifecycle.initialize;
