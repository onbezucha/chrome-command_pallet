export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** Střed okna `size` uvnitř okna `win` (pro fallback popup Command Baru). */
export function centerIn(win: Rect, size: { width: number; height: number }): Rect {
  return {
    left: Math.round(win.left + (win.width - size.width) / 2),
    top: Math.round(win.top + (win.height - size.height) / 3),
    ...size,
  }
}
