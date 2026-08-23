import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { OfficeTrigger } from './OfficeTrigger.tsx'

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  // The sidebar footer is a horizontal action row. Other plugins can place a
  // full-width item there, which leaves subsequent controls clipped. The shell
  // overlay is explicitly additive and keeps this entry independent of sidebar
  // layout and its collapsed state.
  ctx.slots.inject('shell.overlay', function* () {
    yield ctx.slots.register({ name: 'shell.overlay', id: 'dsh-opc-office', order: 20, inject: () => ({}) }, OfficeTrigger)
  })
}
