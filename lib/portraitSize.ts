// How tall the portrait (9:16) video player should be, given the real space
// left below it in the viewport. The navbar's height varies (e.g. a taller
// admin nav when logged in with more menu items), so this must be computed
// from actual layout rather than a fixed vh figure, or the player can run off
// the bottom of the page.
export function computePortraitHeight(viewportHeight: number, containerTop: number): number {
  const bottomMargin = 16;
  const floor = 200; // sane minimum on very short/odd viewports
  const available = viewportHeight - containerTop - bottomMargin;
  return available < floor ? floor : available;
}
