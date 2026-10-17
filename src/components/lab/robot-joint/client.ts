import {
  createDisassemblyController,
  createDisassemblyLifecycle,
  readDisassemblyParts,
} from '../_shared/disassembly/client';
import type { AddonContext } from '../_shared/disassembly/types';
import { robotJointCopy, robotJointModes, type RobotJointLocale } from './copy';
import { flowNodesForPart, flowEdgesForPart } from './flow';
import type { RobotJointMode } from './parts';
import type { createRobotJointViewer } from './viewer';

type Viewer = ReturnType<typeof createRobotJointViewer>;
function mountRobotJointAddon(
  context: AddonContext<string, RobotJointMode, Viewer>,
  locale: RobotJointLocale,
  registerSelectionRefresh: (refresh: () => void) => void,
) {
  const { root, query, all, setText, signal } = context;
  const copy = robotJointCopy[locale];
  const parts = readDisassemblyParts(root);
  let separation = 1;
  const hiddenInMechanism = new Set(['housing', 'front-cover', 'rear-cover']);
  const contextText: Record<string, string> = {
    'driver-board': copy.contextDriver,
    'motor-stator': copy.contextMotor,
    'motor-rotor': copy.contextMotor,
    'harmonic-reducer': copy.contextReducer,
    'output-flange': copy.contextOutput,
    'motor-encoder': copy.contextMotorEncoder,
    'output-encoder': copy.contextOutputEncoder,
    'fail-safe-brake': copy.contextBrake,
  };
  function updateStaticStack() {
    all<SVGGElement>('[data-rj-static-layer]').forEach((layer, index) => {
      const id = layer.dataset.rjStaticLayer ?? '';
      layer.setAttribute(
        'transform',
        `translate(${180 + (index - 6.5) * (3 + 20 * separation)} 0)`,
      );
      layer.dataset.selected = String(id === context.selected);
      layer.style.display = context.mode === 'mechanism' && hiddenInMechanism.has(id) ? 'none' : '';
    });
    const part = parts.find((item) => item.id === context.selected);
    if (part) setText('[data-rj-static-part-name]', `${copy.selected}: ${part.name}`);
  }
  function syncSelection() {
    if (context.disposed) return;
    const selected = context.selected;
    const nodes = new Set<string>(flowNodesForPart(selected));
    const edges = new Set(flowEdgesForPart(selected));
    for (const button of all<HTMLButtonElement>('[data-rj-flow-node]')) {
      const active = nodes.has(button.dataset.rjFlowNode ?? '');
      button.dataset.selected = String(active);
      button.setAttribute('aria-pressed', String(active));
    }
    for (const edge of all<SVGPathElement>('[data-rj-flow-edge]'))
      edge.dataset.selected = String(edges.has(edge.dataset.rjFlowEdge ?? ''));
    const part = parts.find((item) => item.id === selected);
    if (part) {
      setText('[data-rj-flow-selected]', part.name);
      setText('[data-rj-stage-name]', part.name);
      setText('[data-rj-stage-role]', part.role);
    }
    const status = query<HTMLElement>('[data-rj-flow-context]');
    if (status) {
      status.textContent = contextText[selected] ?? copy.contextNeutral;
      status.dataset.state = nodes.size > 0 ? 'mapped' : 'neutral';
    }
    updateStaticStack();
  }
  function updateSeparation() {
    root.dataset.separation = String(separation);
    const percent = `${Math.round(separation * 100)}%`;
    setText('[data-rj-separation-output]', percent);
    query<HTMLInputElement>('[data-rj-separation]')?.setAttribute('aria-valuetext', percent);
    updateStaticStack();
    if (root.dataset.renderer !== 'fallback') context.viewer?.setSeparation(separation);
  }
  query<HTMLInputElement>('[data-rj-separation]')?.addEventListener(
    'input',
    (event) => {
      const value = (event.target as HTMLInputElement).valueAsNumber;
      if (!Number.isFinite(value)) return;
      separation = Math.min(1, Math.max(0, value / 100));
      updateSeparation();
    },
    { signal },
  );
  for (const button of all<HTMLButtonElement>('[data-rj-flow-part]'))
    button.addEventListener(
      'click',
      () => {
        const id = button.dataset.rjFlowPart;
        if (!id) return;
        context.select(id);
        syncSelection();
      },
      { signal },
    );
  // Shared part/tag handlers run at the target before this bubbled listener.
  root.addEventListener(
    'click',
    (event) => {
      if ((event.target as Element).closest('[data-l1-select], [data-l1-label]')) syncSelection();
    },
    { signal },
  );
  // The viewer callback refreshes the diagram after the shared controller commits a raycast pick.
  registerSelectionRefresh(syncSelection);
  updateSeparation();
  syncSelection();
  return {
    onMode() {
      syncSelection();
    },
    onPresentation() {
      syncSelection();
    },
    onViewer(viewer: Viewer) {
      viewer.setSeparation(separation);
      syncSelection();
    },
    dispose() {
      registerSelectionRefresh(() => {});
    },
  };
}
const lifecycle = createDisassemblyLifecycle<ReturnType<Viewer['getDiagnostics']>>({
  selector: '[data-robot-joint]',
  diagnosticName: 'robotJointLifecycle',
  initialize(root, instance, onDispose) {
    const locale: RobotJointLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
    let selectionRefresh = () => {};
    return createDisassemblyController<string, RobotJointMode, Viewer>(
      root,
      {
        parts: readDisassemblyParts(root),
        modes: robotJointModes(locale),
        defaultPartId: 'motor-stator',
        defaultMode: 'whole',
        keyboardDescriptionId: 'rj-keyboard',
        copy: robotJointCopy[locale],
        async loadViewer() {
          const { createRobotJointViewer } = await import('./viewer');
          return (options) =>
            createRobotJointViewer({
              ...options,
              onSelect(id) {
                options.onSelect(id);
                selectionRefresh();
              },
            });
        },
        mountAddon: (context) =>
          mountRobotJointAddon(context, locale, (refresh) => {
            selectionRefresh = refresh;
          }),
      },
      instance,
      onDispose,
    );
  },
});
export const initializeRobotJoints = lifecycle.initialize;
export const disposeRobotJoints = lifecycle.dispose;
export const getRobotJointLifecycleSnapshot = lifecycle.snapshot;
