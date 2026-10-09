// Dispatching to a CodeMirror editor can throw while that editor is in the middle of an
// update. Try again once after the update (a microtask); give up on the editor only when
// the retry fails too. Never throws, so a caller inside an emitter can't break its other
// listeners. (The lens does the same inline, lens/decorations.ts.)

export interface Dispatcher<S> { dispatch(spec: S): void }

/**
 * `spec` is built again for the retry (it may read the editor's state). `alive` says the
 * editor is still wanted (not destroyed meanwhile); `drop` forgets it after a second failure.
 */
export function dispatchWithRetry<S>(
  view: Dispatcher<S>,
  spec: () => S,
  alive: () => boolean,
  drop: (err: unknown) => void,
): void {
  try {
    view.dispatch(spec());
  } catch {
    queueMicrotask(() => {
      if (!alive()) return;
      try { view.dispatch(spec()); } catch (e) { drop(e); }
    });
  }
}
