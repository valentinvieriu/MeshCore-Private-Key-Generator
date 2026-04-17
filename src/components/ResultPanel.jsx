import { useState } from 'react'

export default function ResultPanel({ result, runState, panelRef = null }) {
  const hasResult = !!result
  const [showVerification, setShowVerification] = useState(false)
  const [showAdditionalExports, setShowAdditionalExports] = useState(false)

  if (!hasResult) {
    const { dot, label } = resolveIdleState(runState)
    return (
      <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-slate-900/60 px-4 py-3">
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
    )
  }

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      className="rounded-[30px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_24px_90px_-56px_rgba(15,23,42,0.85)] backdrop-blur outline-none"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="rounded-[26px] border border-white/10 bg-slate-950/65 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Matched prefix</div>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-100">Match found</span>
          </div>
          <div className="mt-2 font-mono text-4xl font-semibold tracking-tight text-cyan-200">{result.prefix}</div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            The MeshCore private key is ready to copy first. Verification details and alternate exports stay available below when you need them.
          </p>

          <div className="mt-5 rounded-[22px] border border-white/10 bg-slate-900/70 p-4">
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">Public key preview</div>
            <div className="mt-2 break-all font-mono text-sm leading-7 text-slate-200">
              <span className="rounded bg-cyan-400/15 px-0.5 text-cyan-300">{result.rawPublicKeyHex.slice(0, result.prefix.length)}</span>
              <span>{result.rawPublicKeyHex.slice(result.prefix.length, result.prefix.length + 20)}</span>
              <span className="text-slate-600">...</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ExportField
            label="MeshCore private key"
            helper="Copy this value into MeshCore first. It stays front and center after a successful match."
            value={result.meshcorePrivateHex}
            minHeightClass="min-h-[164px]"
            emphasize
            copyLabel="Copy MeshCore key"
            copiedLabel="Copied MeshCore key"
            centered
          />

          {result.validationMessage && (
            <div className="rounded-[22px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
              {result.validationMessage}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <DetailsCard
          title="Verification details"
          description="Use this when you want to validate the matched node ID or inspect the raw public key."
          open={showVerification}
          onToggle={() => setShowVerification((prev) => !prev)}
        >
          <div className="space-y-4">
            <div className="rounded-[22px] border border-white/10 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="text-xs uppercase tracking-[0.22em] text-slate-500">Raw public key</label>
                <CopyButton
                  value={result.rawPublicKeyHex}
                  label="Copy raw public key"
                  copiedLabel="Copied raw public key"
                />
              </div>
              <div className="break-all font-mono text-sm leading-7 text-slate-200">
                <span className="rounded bg-cyan-400/15 px-0.5 text-cyan-300">{result.rawPublicKeyHex.slice(0, result.prefix.length)}</span>
                {result.rawPublicKeyHex.slice(result.prefix.length)}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Node ID by prefix length</div>
              <div className="mt-3 grid gap-2">
                {[1, 2, 4].map((bytes) => {
                  const hexLen = bytes * 2
                  const id = result.rawPublicKeyHex.slice(0, hexLen)
                  const prefixLen = result.prefix.length
                  const isFullyMatched = prefixLen >= hexLen
                  const isPartiallyMatched = prefixLen > (bytes - 1) * 2 && prefixLen < hexLen

                  return (
                    <div
                      key={bytes}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                        isFullyMatched ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-white/10 bg-slate-900/70'
                      }`}
                    >
                      <span className="w-16 shrink-0 text-xs text-slate-400">{bytes} byte{bytes > 1 ? 's' : ''}</span>
                      <span className="font-mono text-sm font-semibold">
                        {isFullyMatched || isPartiallyMatched ? (
                          <>
                            <span className="text-cyan-300">{id.slice(0, Math.min(prefixLen, hexLen))}</span>
                            {prefixLen < hexLen && <span className="text-slate-200">{id.slice(prefixLen)}</span>}
                          </>
                        ) : (
                          <span className="text-slate-200">{id}</span>
                        )}
                      </span>
                      {isFullyMatched && <span className="ml-auto text-xs font-medium text-cyan-300">matched</span>}
                      {isPartiallyMatched && <span className="ml-auto text-xs font-medium text-cyan-300/70">partial</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DetailsCard>

        <DetailsCard
          title="Additional exports"
          description="Keep the main MeshCore key first, then expand this section for the seed or PKCS#8 fallback."
          open={showAdditionalExports}
          onToggle={() => setShowAdditionalExports((prev) => !prev)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ExportField
              label="32-byte seed"
              value={result.seedHex}
              minHeightClass="min-h-[104px]"
              copyLabel="Copy seed"
              copiedLabel="Copied seed"
            />
            <ExportField
              label="PKCS#8 fallback"
              value={result.pkcs8Hex}
              minHeightClass="min-h-[104px]"
              copyLabel="Copy PKCS#8"
              copiedLabel="Copied PKCS#8"
            />
          </div>
        </DetailsCard>
      </div>
    </section>
  )
}

function resolveIdleState(runState) {
  if (runState === 'running') {
    return { dot: 'bg-cyan-300 animate-pulse', label: 'Searching for your first matching keypair…' }
  }
  if (runState === 'stopped') {
    return { dot: 'bg-amber-300', label: 'Search stopped. Start again or adjust the prefix.' }
  }
  return { dot: 'bg-slate-500', label: 'Your match will appear here once the search completes.' }
}

function ExportField({
  label,
  value,
  minHeightClass,
  emphasize = false,
  helper = '',
  copyLabel,
  copiedLabel,
  centered = false,
}) {
  return (
    <div className={`rounded-[24px] border p-4 ${
      emphasize ? 'border-cyan-400/20 bg-slate-950/75 shadow-[0_18px_50px_-36px_rgba(34,211,238,0.8)]' : 'border-white/10 bg-slate-950/70'
    }`}>
      <div className={`mb-3 flex flex-col gap-3 ${centered ? 'text-center' : ''} sm:flex-row sm:items-start sm:justify-between`}>
        <div className={centered ? 'sm:text-left' : ''}>
          <label className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</label>
          {helper && <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{helper}</p>}
        </div>
        <CopyButton
          value={value}
          label={copyLabel}
          copiedLabel={copiedLabel}
          variant={emphasize ? 'primary' : 'default'}
        />
      </div>
      <textarea
        readOnly
        value={value || ''}
        className={`${minHeightClass} w-full resize-y rounded-[20px] border px-4 py-3 font-mono text-sm leading-6 outline-none ${
          emphasize
            ? 'border-cyan-400/20 bg-slate-900/90 text-slate-100'
            : 'border-white/10 bg-slate-900/80 text-slate-100'
        }`}
      />
    </div>
  )
}

function DetailsCard({ title, description, open, onToggle, children }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-slate-100">{title}</div>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="self-start text-sm font-medium text-slate-400 transition hover:text-cyan-200 sm:self-auto"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && <div className="mt-4 border-t border-white/10 pt-4">{children}</div>}
    </div>
  )
}

function CopyButton({ value, label, copiedLabel, variant = 'default' }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* clipboard unavailable */ }
  }

  const baseClasses = variant === 'primary'
    ? 'border-cyan-400/30 bg-cyan-400 text-slate-950 hover:bg-cyan-300'
    : 'border-white/10 bg-slate-800/90 text-slate-200 hover:border-cyan-400/30 hover:bg-slate-700'

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        copied
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
          : baseClasses
      }`}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}
