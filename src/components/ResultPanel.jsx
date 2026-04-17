import { useState } from 'react'

export default function ResultPanel({ result, runState }) {
  const hasResult = !!result
  const [showAdditionalExports, setShowAdditionalExports] = useState(false)

  return (
    <section className="mt-5 rounded-[30px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_24px_90px_-56px_rgba(15,23,42,0.85)] backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Output</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Result</h2>
        </div>
        {hasResult ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-100">Match found</span>
        ) : runState === 'running' ? (
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-100">Searching</span>
        ) : (
          <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-300">Waiting for match</span>
        )}
      </div>

      {!hasResult ? (
        <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-slate-950/55 p-5">
          <p className="text-lg font-semibold text-white">
            {runState === 'running'
              ? 'Searching for your first matching keypair...'
              : 'A matching keypair will appear here after search completes.'}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {runState === 'running'
              ? 'Once a public key matches the requested prefix, the app will finalize the MeshCore private key, validate it, and reveal export options below.'
              : 'When a match is found, this panel will show the highlighted public key, the MeshCore private key, validation status, and additional exports for seed and PKCS#8.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <PlaceholderChip title="Matched prefix" detail="appears first" />
            <PlaceholderChip title="MeshCore private key" detail="primary export" />
            <PlaceholderChip title="Optional exports" detail="seed + PKCS#8" />
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="rounded-[26px] border border-white/10 bg-slate-950/65 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Matched prefix</div>
            <div className="mt-2 font-mono text-4xl font-semibold tracking-tight text-cyan-200">{result.prefix}</div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              The matched bytes are highlighted inside the raw public key so you can verify the node ID immediately.
            </p>

            <div className="mt-6 rounded-[22px] border border-white/10 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="text-xs uppercase tracking-[0.22em] text-slate-500">Raw public key</label>
                <CopyButton value={result.rawPublicKeyHex} label="Copy public key" />
              </div>
              <div className="break-all font-mono text-sm leading-7 text-slate-200">
                <span className="rounded bg-cyan-400/15 px-0.5 text-cyan-300">{result.rawPublicKeyHex.slice(0, result.prefix.length)}</span>
                {result.rawPublicKeyHex.slice(result.prefix.length)}
              </div>
            </div>

            <div className="mt-5">
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

          <div className="space-y-4">
            <ExportField
              label="MeshCore private key (128 hex chars)"
              value={result.meshcorePrivateHex}
              minHeightClass="min-h-[148px]"
              emphasize
            />

            {result.validationMessage && (
              <div className="rounded-[22px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
                {result.validationMessage}
              </div>
            )}

            <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-100">Additional exports</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Keep the main MeshCore key front and center, but expand this section if you also want the source seed or PKCS#8 fallback.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdditionalExports((prev) => !prev)}
                  className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/30 hover:text-white"
                >
                  {showAdditionalExports ? 'Hide exports' : 'Show exports'}
                </button>
              </div>

              {showAdditionalExports && (
                <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
                  <ExportField label="32-byte seed" value={result.seedHex} minHeightClass="min-h-[104px]" />
                  <ExportField label="PKCS#8 fallback" value={result.pkcs8Hex} minHeightClass="min-h-[104px]" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function PlaceholderChip({ title, detail }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-300">
      <span className="font-medium text-slate-100">{title}</span>
      <span className="text-slate-500">·</span>
      <span>{detail}</span>
    </div>
  )
}

function ExportField({ label, value, minHeightClass, emphasize = false }) {
  return (
    <div className={`rounded-[24px] border p-4 ${emphasize ? 'border-cyan-400/20 bg-slate-950/75 shadow-[0_18px_50px_-36px_rgba(34,211,238,0.8)]' : 'border-white/10 bg-slate-950/70'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</label>
        <CopyButton value={value} label="Copy" />
      </div>
      <textarea
        readOnly
        value={value || ''}
        className={`${minHeightClass} w-full resize-y rounded-[20px] border border-white/10 bg-slate-900/80 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none`}
      />
    </div>
  )
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        copied
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
          : 'border-white/10 bg-slate-800/90 text-slate-200 hover:border-cyan-400/30 hover:bg-slate-700'
      }`}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
