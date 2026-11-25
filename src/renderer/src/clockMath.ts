// 24-hour clock face: outer ring is 12, 1..11 and inner ring is 0, 13..23. Both run clockwise from the top.
export const hourAt = (pos: number, inner: boolean): number =>
  inner ? (pos === 0 ? 0 : pos + 12) : pos === 0 ? 12 : pos

/** Position (0..11 clockwise from the top) and ring of an hour. Inverse of hourAt. */
export const ringOf = (h: number): { pos: number; inner: boolean } =>
  h === 0 ? { pos: 0, inner: true } : h >= 13 ? { pos: h - 12, inner: true } : { pos: h % 12, inner: false }
