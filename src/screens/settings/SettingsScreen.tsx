// Settings and About.
//
// Most of this screen is spec section 6: local-only storage can be evicted, so
// backing up is the one thing here that protects months of writing. Export
// (#24), import (#25), the reminder's state (#26) and persistent storage (#23)
// all live on this screen; Markdown export (#44) and the theme (#46) are still
// placeholders, and each replaces its own block rather than the whole file.
//
// The attribution below is real and required (#28): keep it, and keep it
// reachable from the navigation.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { Screen } from '../../components/Screen.tsx'
import { NotBuiltYet } from '../../components/NotBuiltYet.tsx'
import { AttributionStatement } from '../../app/Attribution.tsx'
import type {
  BackupCounts,
  BackupFile,
  PersistentStorageState,
  StorageUsage,
} from '../../backup/index.ts'
import {
  applyBackup,
  backupCounts,
  checkExportReminder,
  countStoredRecords,
  downloadBackup,
  EXPORT_REMINDER_DAYS,
  parseBackupFile,
  persistentStorageState,
  requestPersistentStorage,
  storageUsage,
  totalRecords,
} from '../../backup/index.ts'

export function SettingsScreen() {
  return (
    <Screen title="Settings" description="Your data, how it looks, and where the words come from.">
      <div className="flex flex-col gap-4">
        <ExportSection />
        <NotBuiltYet ticket="#44">
          Markdown export: a readable copy for any notes app, lossy on the structured
          vocabulary fields.
        </NotBuiltYet>
        <ImportSection />
        <PersistentStorageSection />
        <NotBuiltYet ticket="#46">Theme: light, dark, or follow the system.</NotBuiltYet>
        <AttributionStatement />
      </div>
    </Screen>
  )
}

// --- shared bits ----------------------------------------------------------

const primaryButton =
  'rounded-md bg-accent px-3 py-2 text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-60'
const secondaryButton =
  'rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-text hover:bg-surface-sunken disabled:opacity-60'
const dangerButton =
  'rounded-md bg-danger px-3 py-2 text-sm font-medium text-text-on-accent hover:opacity-90 disabled:opacity-60'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-surface-raised p-5">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function CountList({ counts, label }: { counts: BackupCounts; label: string }) {
  return (
    <div className="rounded-md bg-surface-sunken p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <ul className="mt-1 text-sm text-text">
        <li>{counts.vocabularyEntries} Vocabulary Entries</li>
        <li>{counts.grammarNotes} Grammar Notes</li>
        <li>{counts.journalEntries} Journal Entries</li>
        <li>{counts.prompts} Prompts</li>
      </ul>
    </div>
  )
}

function formatDay(iso: string | undefined): string {
  if (iso === undefined) return 'never'
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return 'never'
  return parsed.toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// --- export (#24), with the reminder's state (#26) ------------------------

function ExportSection() {
  const [lastExportAt, setLastExportAt] = useState<string | undefined>(undefined)
  const [overdue, setOverdue] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  useEffect(() => {
    let current = true
    void checkExportReminder().then((reminder) => {
      if (!current) return
      setLastExportAt(reminder.lastExportAt)
      setOverdue(reminder.due)
    })
    return () => {
      current = false
    }
  }, [])

  async function onExport() {
    setBusy(true)
    setFailure(undefined)
    try {
      const backup = await downloadBackup()
      setLastExportAt(backup.exportedAt)
      setOverdue(false)
    } catch (error) {
      setFailure(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Export"
      description="One JSON file holding everything: vocabulary, Grammar Notes, Journal Entries, Prompts, Tags, and every link between them — References, Pins and Tombstones included. This is the backup an import can restore from."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primaryButton} onClick={() => void onExport()} disabled={busy}>
          {busy ? 'Preparing…' : 'Download JSON backup'}
        </button>
        <p className="text-sm text-text-muted">Last export: {formatDay(lastExportAt)}</p>
      </div>

      {overdue ? (
        <p className="mt-3 rounded-md bg-warning-soft p-3 text-sm text-text">
          It has been more than {EXPORT_REMINDER_DAYS} days. Your writing lives only in this
          browser, and a browser can clear its own storage.
        </p>
      ) : null}

      {failure !== undefined ? (
        <p className="mt-3 rounded-md bg-danger-soft p-3 text-sm text-text" role="alert">
          The export did not finish: {failure}
        </p>
      ) : null}
    </Section>
  )
}

// --- import (#25) ---------------------------------------------------------

interface PendingImport {
  readonly fileName: string
  readonly backup: BackupFile
  readonly incoming: BackupCounts
  readonly current: BackupCounts
}

/**
 * Import replaces; it does not merge. That is stated before the file is chosen,
 * restated with the actual numbers once it has been, and the button that runs
 * it says "Replace" rather than "Import" — nobody should be able to lose months
 * of writing by misreading a verb.
 */
function ImportSection() {
  const [pending, setPending] = useState<PendingImport | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<{ message: string; details?: string } | undefined>(
    undefined,
  )
  const [restored, setRestored] = useState<BackupCounts | undefined>(undefined)

  async function onFileChosen(file: File) {
    setBusy(true)
    setProblem(undefined)
    setRestored(undefined)
    setPending(undefined)
    try {
      const parsed = parseBackupFile(await file.text())
      if (!parsed.ok) {
        setProblem({ message: parsed.message, details: parsed.details })
        return
      }
      setPending({
        fileName: file.name,
        backup: parsed.backup,
        incoming: backupCounts(parsed.backup.data),
        current: await countStoredRecords(),
      })
    } catch (error) {
      setProblem({ message: 'That file could not be read. Nothing was changed.', details: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function onReplace(backup: BackupFile) {
    setBusy(true)
    setProblem(undefined)
    try {
      setRestored(await applyBackup(backup))
      setPending(undefined)
    } catch (error) {
      setProblem({
        message: 'The restore failed and was rolled back. Your data is as it was.',
        details: errorMessage(error),
      })
    } finally {
      setBusy(false)
    }
  }

  async function onBackupFirst() {
    setBusy(true)
    try {
      await downloadBackup()
    } catch (error) {
      setProblem({ message: 'That backup did not download.', details: errorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Import"
      description="Restore from a JSON backup. The file is checked in full before anything is written — a file with a problem is refused and changes nothing."
    >
      <p className="rounded-md bg-warning-soft p-3 text-sm text-text">
        <span className="font-medium">An import replaces everything.</span> What is in the file
        becomes what is stored; anything currently here that the file does not contain is gone.
        Export first if you are not sure.
      </p>

      <div className="mt-4">
        <label className={`${secondaryButton} inline-block cursor-pointer`}>
          Choose a backup file…
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              // Cleared so that choosing the same file again still counts.
              event.target.value = ''
              if (file !== undefined) void onFileChosen(file)
            }}
          />
        </label>
      </div>

      {pending !== undefined ? (
        <div className="mt-4 rounded-md border border-border-strong p-4">
          <p className="text-sm font-medium text-text">
            Replace everything with <span className="font-semibold">{pending.fileName}</span>?
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Taken {formatDay(pending.backup.exportedAt)}.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <CountList counts={pending.current} label="Stored now — will be removed" />
            <CountList counts={pending.incoming} label="In the file — will be restored" />
          </div>

          {totalRecords(pending.current) > 0 ? (
            <button
              type="button"
              className={`${secondaryButton} mt-3`}
              onClick={() => void onBackupFirst()}
              disabled={busy}
            >
              Download a backup of what is stored now
            </button>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className={dangerButton}
              onClick={() => void onReplace(pending.backup)}
              disabled={busy}
            >
              {busy ? 'Restoring…' : 'Replace all data'}
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setPending(undefined)
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {problem !== undefined ? (
        <div className="mt-4 rounded-md bg-danger-soft p-3" role="alert">
          <p className="text-sm text-text">{problem.message}</p>
          {problem.details !== undefined ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-text-muted">
              {problem.details}
            </pre>
          ) : null}
        </div>
      ) : null}

      {restored !== undefined ? (
        <div className="mt-4 rounded-md bg-success-soft p-3" role="status">
          <p className="text-sm text-text">
            Restored {restored.vocabularyEntries} Vocabulary Entries, {restored.grammarNotes}{' '}
            Grammar Notes, {restored.journalEntries} Journal Entries and {restored.prompts}{' '}
            Prompts.
          </p>
          <button
            type="button"
            className={`${secondaryButton} mt-3`}
            onClick={() => {
              window.location.reload()
            }}
          >
            Reload the app
          </button>
        </div>
      ) : null}
    </Section>
  )
}

// --- persistent storage (#23) ---------------------------------------------

const STORAGE_STATE_TEXT: Record<PersistentStorageState, string> = {
  persisted: 'Granted. This browser will not evict your data to free up space.',
  'not-persisted':
    'Not granted. This browser may clear the database when space runs short, or after a long stretch without opening the app.',
  unsupported:
    'This browser does not offer persistent storage, so the database can be cleared to free up space.',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['kB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function PersistentStorageSection() {
  const [state, setState] = useState<PersistentStorageState | undefined>(undefined)
  const [usage, setUsage] = useState<StorageUsage | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    void Promise.all([persistentStorageState(), storageUsage()]).then(([next, estimate]) => {
      if (!current) return
      setState(next)
      setUsage(estimate)
    })
    return () => {
      current = false
    }
  }, [])

  async function onRequest() {
    setBusy(true)
    try {
      setState(await requestPersistentStorage({ ask: 'again' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Storage"
      description="The app asks the browser to keep this site's data on first run. A browser that declines is not a problem to fix — it is a reason to export."
    >
      <p className="text-sm text-text" aria-live="polite">
        {state === undefined ? 'Checking…' : STORAGE_STATE_TEXT[state]}
      </p>
      {usage !== undefined ? (
        <p className="mt-1 text-sm text-text-muted">
          Using {formatBytes(usage.usage)} of about {formatBytes(usage.quota)} available.
        </p>
      ) : null}
      {state === 'not-persisted' ? (
        <button
          type="button"
          className={`${secondaryButton} mt-3`}
          onClick={() => void onRequest()}
          disabled={busy}
        >
          {busy ? 'Asking…' : 'Ask again'}
        </button>
      ) : null}
    </Section>
  )
}
