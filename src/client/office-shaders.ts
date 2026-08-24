import type { CSSProperties } from 'react'

export type OfficeTime = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface OfficeSeatAnchor {
  /** Workstation centre in percent of the authored background, ordered back to front. */
  x: number
  y: number
  /** Perspective scale for the character WebM at this carpet. */
  scale: number
}

export interface OfficeShader {
  label: string
  background: string
  style: CSSProperties
  /** Hand-tuned per-background workstation anchors. */
  seats: readonly OfficeSeatAnchor[]
}

/** Paint front workstations first in data order while preserving scene depth. */
export const OFFICE_SEAT_ORDER = [
  { row: 2, anchor: 3 },
  { row: 2, anchor: 4 },
  { row: 2, anchor: 5 },
  { row: 1, anchor: 0 },
  { row: 1, anchor: 1 },
  { row: 1, anchor: 2 },
] as const

const SEATS = {
  // Two rows of three seats. The source backgrounds are similar, but not
  // pixel-identical, so each time variant keeps independent alignment values.
  morning: [
    { x: 27.9, y: 57.5, scale: .90 }, { x: 50.0, y: 57.5, scale: .90 }, { x: 72.0, y: 57.5, scale: .90 },
    { x: 21.8, y: 79.0, scale: 1.04 }, { x: 50.0, y: 79.0, scale: 1.04 }, { x: 77.2, y: 79.0, scale: 1.04 },
  ],
  noon: [
    { x: 30.5, y: 60.0, scale: .90 }, { x: 50.0, y: 60.0, scale: .90 }, { x: 69.5, y: 60.0, scale: .90 },
    { x: 27.5, y: 78.9, scale: 1.04 }, { x: 50.0, y: 78.9, scale: 1.04 }, { x: 72.5, y: 78.9, scale: 1.04 },
  ],
  afternoon: [
    { x: 27.6, y: 57.8, scale: .90 }, { x: 50.0, y: 57.8, scale: .90 }, { x: 72.3, y: 57.8, scale: .90 },
    { x: 21.4, y: 79.2, scale: 1.04 }, { x: 50.0, y: 79.2, scale: 1.04 }, { x: 77.6, y: 79.2, scale: 1.04 },
  ],
  evening: [
    { x: 27.8, y: 57.7, scale: .90 }, { x: 50.0, y: 57.7, scale: .90 }, { x: 72.1, y: 57.7, scale: .90 },
    { x: 21.7, y: 79.1, scale: 1.04 }, { x: 50.0, y: 79.1, scale: 1.04 }, { x: 77.3, y: 79.1, scale: 1.04 },
  ],
  night: [
    { x: 27.1, y: 58.1, scale: .90 }, { x: 50.0, y: 58.1, scale: .90 }, { x: 72.7, y: 58.1, scale: .90 },
    { x: 20.9, y: 79.5, scale: 1.04 }, { x: 50.0, y: 79.5, scale: 1.04 }, { x: 78.1, y: 79.5, scale: 1.04 },
  ],
} as const satisfies Record<OfficeTime, readonly OfficeSeatAnchor[]>

/** Background-only colour grades. WebM workers sit above this layer unchanged. */
export const OFFICE_SHADERS: Record<OfficeTime, OfficeShader> = {
  morning: {
    label: '晨光', background: '/dsh-opc/v1/assets/office-morning.png', seats: SEATS.morning,
    style: {
      '--opc-atmosphere': 'linear-gradient(112deg,#ffd28b22 8%,transparent 48%,#8ccfff12 100%)',
      '--opc-opacity': '.7', '--opc-blend': 'soft-light',
      '--opc-character-filter': 'brightness(1.04) contrast(.97) saturate(.92) sepia(.07)',
    } as CSSProperties,
  },
  noon: {
    label: '正午', background: '/dsh-opc/v1/assets/office-noon.png', seats: SEATS.noon,
    style: {
      '--opc-atmosphere': 'linear-gradient(180deg,#e8f8ff18 0%,transparent 38%,#ffe6a80b 100%)',
      '--opc-opacity': '.62', '--opc-blend': 'screen',
      '--opc-character-filter': 'brightness(1.08) contrast(.94) saturate(.94)',
    } as CSSProperties,
  },
  afternoon: {
    label: '午后', background: '/dsh-opc/v1/assets/office-afternoon.png', seats: SEATS.afternoon,
    style: {
      '--opc-atmosphere': 'linear-gradient(108deg,#ffffff52 0%,#ffffff2e 46%,#89b0d522 100%)',
      '--opc-opacity': '.6', '--opc-blend': 'screen',
      '--opc-character-filter': 'brightness(1.08) contrast(.97) saturate(.88)',
    } as CSSProperties,
  },
  evening: {
    label: '黄昏', background: '/dsh-opc/v1/assets/office-evening.png', seats: SEATS.evening,
    style: {
      '--opc-atmosphere': 'linear-gradient(155deg,#f052a523 0%,#6b2c7919 52%,#180c2a2f 100%)',
      '--opc-opacity': '.78', '--opc-blend': 'color',
      '--opc-character-filter': 'brightness(.91) contrast(1.05) saturate(1.12) sepia(.08) hue-rotate(-8deg)',
    } as CSSProperties,
  },
  night: {
    label: '夜景', background: '/dsh-opc/v1/assets/office-night.png', seats: SEATS.night,
    style: {
      '--opc-atmosphere': 'radial-gradient(ellipse at 50% 58%,#ffb64b20 0%,transparent 34%),linear-gradient(145deg,#2b74bb20 0%,transparent 45%,#07172f2b 100%)',
      '--opc-opacity': '.9', '--opc-blend': 'soft-light',
      '--opc-character-filter': 'brightness(.8) contrast(1.1) saturate(.88) sepia(.08) hue-rotate(4deg)',
    } as CSSProperties,
  },
}

export function officeTimeAt(date = new Date()): OfficeTime {
  const hour = date.getHours()
  if (hour >= 6 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}
