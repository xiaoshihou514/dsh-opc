import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ClientContext, ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import { OfficeTrigger } from './OfficeTrigger.tsx'

// Cordis guards service access at runtime; `sessions` is required for the
// selected character's prompt channel, not merely as a package dependency.
export const inject = ['slots', 'sessions']

export function apply(ctx: ClientContext): void {
  // The slot-runtime's store namespace also uses the word "sessions". Keep
  // this feature on the public runtime contract instead of that render-store
  // inference path.
  const sessionRuntime = ctx.sessions as unknown as ISessions
  // The sidebar footer is a horizontal action row. Other plugins can place a
  // full-width item there, which leaves subsequent controls clipped. The shell
  // overlay is explicitly additive and keeps this entry independent of sidebar
  // layout and its collapsed state.
  ctx.slots.inject('shell.overlay', function* () {
    yield ctx.slots.register({ name: 'shell.overlay', id: 'dsh-opc-office', order: 20, inject: () => ({
      onSendPrompt: async (sessionId: string, text: string): Promise<void> => {
        const session = sessionRuntime.binding(sessionId as never)?.session
        if (session === undefined) throw new Error('该角色会话已不可用。')
        const result = await session.prompt([{ type: 'text', text }], 'queue')
        if (!result.ok) throw new Error(result.error.message)
      },
      onConversation: (sessionId: string) => sessionRuntime.binding(sessionId as never)?.session,
    }) }, OfficeTrigger)
  })
}
