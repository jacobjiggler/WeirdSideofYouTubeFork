// How tall the portrait (9:16) video player should be, given the real space
// left below it in the viewport. The navbar's height varies (e.g. a taller
// admin nav when logged in with more menu items), and there are controls
// (Next/Share buttons) rendered below the player itself — both must be
// accounted for from actual layout, not a fixed vh guess, or the player (or
// the controls below it) can run off the bottom of the page.
export function computePortraitHeight(viewportHeight: number, containerTop: number, reservedBelow = 0): number {
  const bottomMargin = 16;
  const floor = 200; // sane minimum on very short/odd viewports
  const available = viewportHeight - containerTop - reservedBelow - bottomMargin;
  return available < floor ? floor : available;
}
