/**
 * gazeRegistry.js
 *
 * Global registry of interactive gaze targets on screen.
 * GazeOption registers itself on mount and unregisters on unmount.
 * useSnappedGaze reads this registry to snap gaze to nearest button.
 */

const registry = new Map(); // id → { x, y, w, h, el }

export const gazeRegistry = {
  register(id, el) {
    registry.set(id, el);
  },
  unregister(id) {
    registry.delete(id);
  },
  getAll() {
    return Array.from(registry.values());
  },
  // Find the nearest registered element center to a given point.
  // Returns { snappedX, snappedY, nearestId, distance } or null if empty.
  findNearest(x, y) {
    const SNAP_THRESHOLD = 180;
    let best = null;
    let bestDist = Infinity;

    for (const [id, el] of registry.entries()) {
      if (!el || !el.isConnected) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) continue;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist < bestDist) {
        bestDist = dist;
        best = { snappedX: cx, snappedY: cy, nearestId: id, distance: dist };
      }
    }
    if (bestDist > SNAP_THRESHOLD) {
      return null;
    }
    return best;
  },
};
