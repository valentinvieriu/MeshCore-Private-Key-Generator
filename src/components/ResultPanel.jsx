import { useState } from 'react'

export default function ResultPanel({ result }) {
  const hasResult = !!result

  return (
    <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Result</h2>
        {hasResult ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-100">Match found</span>
        ) : (
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">No result yet</span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:col-span-1">
          <div className="text-xs uppercase tracking-wide text-slate-400">Matched prefix</div>
          <div className="mt-2 font-mono text-2xl font-bold text-cyan-300">{result?.prefix || '—'}</div>
          <div className="mt-5 text-xs uppercase tracking-wide text-slate-400">Raw public key</div>
          <div className="mt-2 break-all font-mono text-sm leading-6 text-slate-200">{result?.rawPublicKeyHex || '—'}</div>
          <CopyButton value={result?.rawPublicKeyHex} label="Copy public key" />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:col-span-2">
          <div className="grid gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-xs uppercase tracking-wide text-slate-400">MeshCore private key (128 hex chars)</label>
                <CopyButton value={result?.meshcorePrivateHex} label="Copy" />
              </div>
              <textarea
                readOnly
                value={result?.meshcorePrivateHex || ''}
                className="min-h-[112px] w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-xs uppercase tracking-wide text-slate-400">32-byte seed</label>
                  <CopyButton value={result?.seedHex} label="Copy" />
                </div>
                <textarea
                  readOnly
                  value={result?.seedHex || ''}
                  className="min-h-[92px] w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-xs uppercase tracking-wide text-slate-400">PKCS#8 fallback</label>
                  <CopyButton value={result?.pkcs8Hex} label="Copy" />
                </div>
                <textarea
                  readOnly
                  value={result?.pkcs8Hex || ''}
                  className="min-h-[92px] w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none"
                />
              </div>
            </div>

            {result?.validationMessage && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {result.validationMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
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
      onClick={handleCopy}
      className="mt-4 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
