import { describe, expect, it } from 'vitest'
import { evaluate } from './expr'

describe('evaluate', () => {
  it('základní aritmetika a priority', () => {
    expect(evaluate('2+3*4')).toBe(14)
    expect(evaluate('(2+3)*4')).toBe(20)
    expect(evaluate('2^3^2')).toBe(512)
    expect(evaluate('-3+5')).toBe(2)
    expect(evaluate('10/4')).toBe(2.5)
  })
  it('desetinná čárka i tečka', () => {
    expect(evaluate('12*1,21')).toBeCloseTo(14.52)
    expect(evaluate('12*1.21')).toBeCloseTo(14.52)
  })
  it('procenta: 100+10% = 110, 50% = 0,5', () => {
    expect(evaluate('100+10%')).toBeCloseTo(110)
    expect(evaluate('200-25%')).toBeCloseTo(150)
    expect(evaluate('50%')).toBeCloseTo(0.5)
    expect(evaluate('200*10%')).toBeCloseTo(20)
  })
  it('funkce a konstanty', () => {
    expect(evaluate('sqrt(16)+1')).toBe(5)
    expect(evaluate('round(2,6)')).toBe(3)
    expect(evaluate('2*pi')).toBeCloseTo(6.2832, 3)
  })
  it('× a ÷, mezery jako oddělovač tisíců', () => {
    expect(evaluate('6×7')).toBe(42)
    expect(evaluate('84÷2')).toBe(42)
    expect(evaluate('1 000 * 2')).toBe(2000)
  })
  it('holé číslo není výpočet (pokud není allowPlain)', () => {
    expect(evaluate('123')).toBeNull()
    expect(evaluate('123', { allowPlain: true })).toBe(123)
  })
  it('neplatný vstup → null', () => {
    expect(evaluate('2+')).toBeNull()
    expect(evaluate('abc')).toBeNull()
    expect(evaluate('1/0')).toBeNull()
    expect(evaluate('(1+2')).toBeNull()
    expect(evaluate('alert(1)')).toBeNull()
    expect(evaluate('2 $ 3')).toBeNull()
  })
  it('unární mínus je slabší než mocnina', () => {
    expect(evaluate('-2^2')).toBe(-4)
    expect(evaluate('2^-1')).toBe(0.5)
    expect(evaluate('2^3^2')).toBe(512)
  })
  it('oddělovače tisíců a desetin', () => {
    expect(evaluate('1,000.50+1')).toBe(1001.5)
    expect(evaluate('1.000,50+1')).toBe(1001.5)
    expect(evaluate('1,5+1')).toBe(2.5)
  })
})
