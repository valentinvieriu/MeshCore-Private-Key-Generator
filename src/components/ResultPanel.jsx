import { useState } from 'react'
import { formatNumber, formatDuration } from '../lib/crypto'

export default function ResultPanel({ result, totalAttempts = 0, cumulativeAttempts = 0, elapsedMs = 0, panelRef = null }) {
  if (!result) return null

  const carried = Math.max(0, cumulativeAttempts - totalAttempts)

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      className="rounded-[30px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_24px_90px_-56px_rgba(15,23,42,0.85)] backdrop-blur outline-none space-y-4"
    >
      <div className="rounded-[26px] border border-white/10 bg-slate-950/65 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Matched prefix</div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-100">Match found</span>
        </div>
        <div className="mt-2 font-mono text-4xl font-semibold tracking-tight text-cyan-200">{result.prefix}</div>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Found in <span className="text-slate-100">{formatNumber(totalAttempts)}</span> attempts · <span className="text-slate-100">{formatDuration(elapsedMs)}</span>
        </p>
        {carried > 0 && (
          <p className="mt-1 text-xs text-slate-500">+{formatNumber(carried)} from earlier runs on this prefix</p>
        )}
      </div>

      <ExportField
        label="MeshCore private key"
        helper="Paste this into MeshCore."
        value={result.meshcorePrivateHex}
        minHeightClass="min-h-[148px]"
        emphasize
        copyLabel="Copy MeshCore key"
        copiedLabel="Copied MeshCore key"
      />

      <div className="rounded-[20px] border border-white/10 bg-slate-900/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Raw public key</label>
          <CopyButton
            value={result.rawPublicKeyHex}
            label="Copy"
            copiedLabel="Copied"
          />
        </div>
        <div className="break-all font-mono text-xs leading-6 text-slate-200">
          <span className="rounded bg-cyan-400/15 px-0.5 text-cyan-300">{result.rawPublicKeyHex.slice(0, result.prefix.length)}</span>
          {result.rawPublicKeyHex.slice(result.prefix.length)}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Node ID by prefix length</div>
        <div className="mt-2 grid gap-2">
          {[1, 2, 4].map((bytes) => {
            const hexLen = bytes * 2
            const id = result.rawPublicKeyHex.slice(0, hexLen)
            const prefixLen = result.prefix.length
            const isFullyMatched = prefixLen >= hexLen
            const isPartiallyMatched = prefixLen > (bytes - 1) * 2 && prefixLen < hexLen

            return (
              <div
                key={bytes}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
                  isFullyMatched ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-white/10 bg-slate-900/70'
                }`}
              >
                <span className="w-14 shrink-0 text-xs text-slate-400">{bytes} byte{bytes > 1 ? 's' : ''}</span>
                <span className="font-mono text-xs font-semibold">
                  {isFullyMatched || isPartiallyMatched ? (
                    <>
                      <span className="text-cyan-300">{id.slice(0, Math.min(prefixLen, hexLen))}</span>
                      {prefixLen < hexLen && <span className="text-slate-200">{id.slice(prefixLen)}</span>}
                    </>
                  ) : (
                    <span className="text-slate-200">{id}</span>
                  )}
                </span>
                {isFullyMatched && <span className="ml-auto text-[10px] font-medium text-cyan-300">matched</span>}
                {isPartiallyMatched && <span className="ml-auto text-[10px] font-medium text-cyan-300/70">partial</span>}
              </div>
            )
          })}
        </div>
      </div>

      {result.validationMessage && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Validation report</div>
          <p className="mt-2 rounded-[20px] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs leading-6 text-emerald-100">
            {result.validationMessage}
          </p>
        </div>
      )}
    </section>
  )
}

function ExportField({
  label,
  value,
  minHeightClass,
  emphasize = false,
  helper = '',
  copyLabel,
  copiedLabel,
}) {
  return (
    <div className={`rounded-[22px] border p-4 ${
      emphasize ? 'border-cyan-400/20 bg-slate-950/75 shadow-[0_18px_50px_-36px_rgba(34,211,238,0.8)]' : 'border-white/10 bg-slate-950/70'
    }`}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <label className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</label>
          {helper && <p className="mt-1 text-xs leading-5 text-slate-400">{helper}</p>}
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
        className={`${minHeightClass} w-full resize-y rounded-[18px] border px-3 py-2 font-mono text-xs leading-6 outline-none ${
          emphasize
            ? 'border-cyan-400/20 bg-slate-900/90 text-slate-100'
            : 'border-white/10 bg-slate-900/80 text-slate-100'
        }`}
      />
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
