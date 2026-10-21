/**
 * «← К уроку»: a reading screen (a lesson) marks itself before a link takes the student away — to an entity card,
 * the graph or the timeline — and the app shows a button that brings them back to the same spot in one tap, however
 * far they wandered from card to card (history goes back to the lesson's own entry, and the lesson restores its
 * scroll). The mark is dropped once the student is back at the lesson (or before it in history).
 *   leaveFrom('Смутное время')   // right before a link navigates away
 *   returnPoint.at               // { label, path, idx } while away, else null
 *   comeBack()                   // the button
 */
import { router, navigate } from './router.svelte';

interface ReturnPoint {
  label: string;
  path: string;
  /** The lesson's position in history. */
  idx: number;
}

export const returnPoint = $state<{ at: ReturnPoint | null }>({ at: null });

export function leaveFrom(label: string): void {
  returnPoint.at = { label, path: decodeURI(location.hash.slice(1) || '/'), idx: router.position };
}

/** Shown while away from the marked screen (not on full-screen routes like a quiz in progress). */
export const awayFromReturn = (): boolean => {
  const at = returnPoint.at;
  return !!at && router.position > at.idx && !router.route?.immersive;
};

export function comeBack(): void {
  const at = returnPoint.at;
  if (!at) return;
  returnPoint.at = null;
  const steps = router.position - at.idx;
  if (steps > 0) history.go(-steps);
  else navigate(at.path);
}

/** Back at the lesson, or before it — its history entry may be gone: forget the mark. */
export function dropReturnIfBack(): void {
  const at = returnPoint.at;
  if (at && router.position <= at.idx) returnPoint.at = null;
}
