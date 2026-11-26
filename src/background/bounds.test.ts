import { describe, expect, it } from 'vitest'
import { centerIn } from './bounds'

describe('centerIn', () => {
  it('vycentruje popup do okna', () => {
    const r = centerIn({ left: 0, top: 0, width: 1400, height: 900 }, { width: 680, height: 560 })
    expect(r.left).toBe(360)
    expect(r.width).toBe(680)
  })
})
