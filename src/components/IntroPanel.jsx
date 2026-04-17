import { formatNumber, expectedAttemptsForHexLength } from '../lib/crypto'

const ATTEMPTS_TABLE = [1, 2, 3, 4, 5, 6, 7, 8]

export default function IntroPanel({ prefixHexLength }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-900/65 p-5 shadow-[0_24px_90px_-56px_rgba(15,23,42,0.85)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-cyan-200">How this works</div>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-300">
          Ready
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        Click Start and the browser races through random keys, looking for one whose public key starts with your prefix.
      </p>

      <div className="mt-4 space-y-3">
        <Block title="The procedure">
          <ol className="list-inside list-decimal space-y-1 text-slate-300">
            <li>Workers generate random key candidates.</li>
            <li>Each public key is checked for your prefix.</li>
            <li>First match wins — search auto-stops.</li>
          </ol>
        </Block>

        <Block title="Why timing varies">
          <p>Each attempt is an independent <span className="font-mono text-cyan-200">1-in-16ⁿ</span> dice roll, so longer prefixes need exponentially more tries.</p>
          <AttemptsTable activeLength={prefixHexLength} />
        </Block>
      </div>
    </section>
  )
}

function Block({ title, children }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-slate-950/65 p-3.5">
      <div className="text-sm font-medium text-slate-100">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-300">{children}</div>
    </div>
  )
}

function AttemptsTable({ activeLength }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[14px] border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-950/80 text-[10px] uppercase tracking-[0.2em] text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Prefix</th>
            <th className="px-3 py-2 text-right font-medium">Avg attempts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 font-mono">
          {ATTEMPTS_TABLE.map((n) => {
            const active = n === activeLength
            return (
              <tr
                key={n}
                className={active ? 'bg-cyan-400/10 text-cyan-100' : 'text-slate-300'}
              >
                <td className="px-3 py-1.5">
                  {n} char{n === 1 ? '' : 's'}
                  {active && <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-cyan-200">you</span>}
                </td>
                <td className="px-3 py-1.5 text-right">{formatNumber(expectedAttemptsForHexLength(n))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
