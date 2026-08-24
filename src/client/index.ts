import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {
  ClientContext,
  IWorkspaces,
  ISessions,
  ObservableSnapshot,
} from '@deepseek-ai/dsh-client-runtime/client'
import { OfficeTrigger } from './OfficeTrigger.tsx'
import { PetFloat } from './PetFloat.tsx'

export interface OfficeSessionList {
  ids: readonly string[]
  current: string | undefined
  byId: Record<string, {
    title?: string
    displayTitle?: string
    cwd?: string
    running?: boolean
    blank?: boolean
    updatedAt?: number
  }>
}

export interface OfficeModelState {
  current: { model: string } | null
}

interface ModelDirectories {
  directoryFor(sessionId: string): {
    store: ObservableSnapshot<OfficeModelState>
    load(): Promise<unknown>
  }
}

// Cordis guards service access at runtime; `sessions` is required for the
// selected character's prompt channel, not merely as a package dependency.
export const inject = ['slots', 'sessions', 'modelDirectories', 'workspaces']

export function apply(ctx: ClientContext): void {
  // The slot-runtime's store namespace also uses the word "sessions". Keep
  // this feature on the public runtime contract instead of that render-store
  // inference path.
  const sessionRuntime = ctx.sessions as unknown as ISessions
  const modelDirectories = (ctx as unknown as { modelDirectories: ModelDirectories }).modelDirectories
  // The registry-global archived session id set lives on the workspaces list
  // snapshot. Expose only the id list so the office panel can drop archived
  // conversations without depending on the whole workspace projection.
  const workspaces = (ctx as unknown as { workspaces: IWorkspaces }).workspaces
  const archivedSessionIds: ObservableSnapshot<readonly string[]> = {
    getSnapshot: () => workspaces.list.getSnapshot().archivedSessionIds,
    subscribe: (listener) => workspaces.list.subscribe(listener),
  }
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
      onConversation: (sessionId: string) => {
        // Opening the selected DSH session makes its durable history window
        // live before the office subscribes to it; closing Office then lands
        // the user on the same conversation.
        sessionRuntime.open(sessionId as never)
        return sessionRuntime.binding(sessionId as never)?.session
      },
      sessionList: sessionRuntime.list as ObservableSnapshot<OfficeSessionList>,
      archivedSessionIds,
      openSession: (sessionId: string) => {
        // Select the session in the host so the native conversation UI opens.
        sessionRuntime.open(sessionId as never)
      },
      modelSelection: (sessionId: string) => {
        const directory = modelDirectories.directoryFor(sessionId)
        void directory.load().catch(() => undefined)
        return directory.store
      },
    }) }, OfficeTrigger)
    // The always-on hover pet: pinned to the native conversation UI so the
    // character animation lives there, following the host's current session.
    yield ctx.slots.register({ name: 'shell.overlay', id: 'dsh-opc-pet', order: 21, inject: () => ({
      sessionList: sessionRuntime.list as ObservableSnapshot<OfficeSessionList>,
      onOpen: (sessionId: string) => sessionRuntime.open(sessionId as never),
    }) }, PetFloat)
  })
}
