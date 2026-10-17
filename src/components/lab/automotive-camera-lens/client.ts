import {
  createDisassemblyController,
  createDisassemblyLifecycle,
  readDisassemblyParts,
} from '../_shared/disassembly/client';
import type { AddonContext } from '../_shared/disassembly/types';
import { aclCopy, aclModes, type AclLocale } from './copy';
import type { AclMode } from './params';
import type { createAclViewer } from './viewer';

type Viewer = ReturnType<typeof createAclViewer>;
function mountAclAddon(context: AddonContext<string, AclMode, Viewer>) {
  const { root, query, setText, signal } = context;
  const parts = readDisassemblyParts(root);
  let separation = 1;
  /** Every selection path (tags, stage labels, section targets, table rows, canvas picks)
   * commits through the shared controller, which mirrors it on data-selected. */
  function syncSelection() {
    if (context.disposed) return;
    const part = parts.find((item) => item.id === context.selected);
    if (!part) return;
    setText('[data-acl-section-name]', part.name);
    setText('[data-acl-section-role]', part.role);
  }
  const observer = new MutationObserver(syncSelection);
  observer.observe(root, { attributes: true, attributeFilter: ['data-selected'] });
  function updateSeparation() {
    root.dataset.separation = String(separation);
    const percent = `${Math.round(separation * 100)}%`;
    setText('[data-acl-separation-output]', percent);
    query<HTMLInputElement>('[data-acl-separation]')?.setAttribute('aria-valuetext', percent);
    if (root.dataset.renderer !== 'fallback') context.viewer?.setSeparation(separation);
  }
  query<HTMLInputElement>('[data-acl-separation]')?.addEventListener(
    'input',
    (event) => {
      const value = (event.target as HTMLInputElement).valueAsNumber;
      if (!Number.isFinite(value)) return;
      separation = Math.min(1, Math.max(0, value / 100));
      updateSeparation();
    },
    { signal },
  );
  updateSeparation();
  syncSelection();
  return {
    onViewer(viewer: Viewer) {
      viewer.setSeparation(separation);
    },
    dispose() {
      observer.disconnect();
    },
  };
}
const lifecycle = createDisassemblyLifecycle<ReturnType<Viewer['getDiagnostics']>>({
  selector: '[data-automotive-camera-lens]',
  diagnosticName: 'automotiveCameraLensLifecycle',
  initialize(root, instance, onDispose) {
    const locale: AclLocale = root.dataset.locale === 'en' ? 'en' : 'zh';
    return createDisassemblyController<string, AclMode, Viewer>(
      root,
      {
        parts: readDisassemblyParts(root),
        modes: aclModes(locale),
        defaultPartId: 'lens-1',
        defaultMode: 'whole',
        keyboardDescriptionId: 'acl-keyboard',
        copy: aclCopy[locale],
        async loadViewer() {
          return (await import('./viewer')).createAclViewer;
        },
        mountAddon: (context) => mountAclAddon(context),
      },
      instance,
      onDispose,
    );
  },
});
export const initializeAutomotiveCameraLenses = lifecycle.initialize;
export const disposeAutomotiveCameraLenses = lifecycle.dispose;
export const getAutomotiveCameraLensLifecycleSnapshot = lifecycle.snapshot;
