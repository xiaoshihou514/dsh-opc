import type { CSSProperties } from 'react'

export type OfficeTime = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface OfficeShader {
  label: string
  background: string
  style: CSSProperties
}

/** Background-only colour grades. WebM workers sit above this layer unchanged. */
export const OFFICE_SHADERS: Record<OfficeTime, OfficeShader> = {
  morning: { label: '晨光', background: '/dsh-opc/v1/assets/office-morning.png', style: { '--opc-atmosphere': 'linear-gradient(120deg,#ffd99970,#87d7ff25)', '--opc-opacity': '.66', '--opc-blend': 'screen' } as CSSProperties },
  noon: { label: '正午', background: '/dsh-opc/v1/assets/office-noon.png', style: { '--opc-atmosphere': 'linear-gradient(#d9f5ff48,#fff2b12e)', '--opc-opacity': '.52', '--opc-blend': 'screen' } as CSSProperties },
  afternoon: { label: '午后', background: '/dsh-opc/v1/assets/office-afternoon.png', style: { '--opc-atmosphere': 'linear-gradient(135deg,#ffb05b52,#e65e9030)', '--opc-opacity': '.62', '--opc-blend': 'soft-light' } as CSSProperties },
  evening: { label: '黄昏', background: '/dsh-opc/v1/assets/office-evening.png', style: { '--opc-atmosphere': 'linear-gradient(150deg,#d468a560,#5d4dc078)', '--opc-opacity': '.72', '--opc-blend': 'screen' } as CSSProperties },
  night: { label: '夜景', background: '/dsh-opc/v1/assets/office-background.png', style: { '--opc-atmosphere': 'repeating-linear-gradient(108deg,transparent 0 26px,#79c9ff22 27px 28px,transparent 29px 54px),linear-gradient(#1c3c8048,#060c2838)', '--opc-opacity': '.8', '--opc-blend': 'screen' } as CSSProperties },
}

export function officeTimeAt(date = new Date()): OfficeTime {
  const hour = date.getHours()
  if (hour >= 6 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}
