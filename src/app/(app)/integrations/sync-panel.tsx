import { formatDate } from "@/lib/labels";
import { lastSyncRuns } from "@/lib/meta-sync-service";
import { ActionForm } from "../../action-form";
import { Button, Pill } from "../../ui";
import { syncMetaFull, syncMetaNow } from "./actions";

type Run = NonNullable<Awaited<ReturnType<typeof lastSyncRuns>>["metrics"]>;
type Counts = { campaigns?: number; adSets?: number; ads?: number; days?: number; leads?: number };

function duration(run: Run) {
  if (!run.finishedAt) return "";
  const s = Math.max(1, Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000));
  return s < 60 ? ` em ${s} s` : ` em ${Math.round(s / 60)} min`;
}

function RunLine({ title, run, timeZone }: { title: string; run: Run | null; timeZone: string }) {
  if (!run) return <li><strong>{title}:</strong> <span className="text-soft">ainda não rodou</span></li>;
  const c = (run.counts ?? {}) as Counts;
  const what = run.kind === "LEADS" ? `${c.leads ?? 0} leads novos` : `${c.campaigns ?? 0} campanhas · ${c.adSets ?? 0} conjuntos · ${c.ads ?? 0} anúncios · ${c.days ?? 0} linhas de dias`;
  return (
    <li className="flex flex-col gap-0.5">
      <span>
        <strong>{title}:</strong> {formatDate(run.startedAt, timeZone)}
        {duration(run)} {run.kind === "FULL" && <span className="text-xs text-soft">(histórico completo)</span>}{" "}
        <Pill tone={run.status === "SUCCESS" ? "ok" : run.status === "ERROR" ? "danger" : "warn"}>
          {run.status === "SUCCESS" ? "OK" : run.status === "ERROR" ? "Erro" : "Rodando"}
        </Pill>
      </span>
      {run.status === "ERROR" ? (
        <span className="text-xs text-danger">Parou em {run.step}: {run.error}</span>
      ) : (
        <span className="text-xs text-soft">{what}</span>
      )}
    </li>
  );
}

/** Integrações → Sincronização: buttons and the last runs (spec 04). */
export async function SyncPanel({ brandId, timeZone }: { brandId: string; timeZone: string }) {
  const runs = await lastSyncRuns(brandId);
  return (
    <div className="mt-4 rounded-xl border border-line bg-[#0f1a28] p-3 text-sm">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-soft">Sincronização (só leitura)</h3>
      <ul className="mb-3 flex flex-col gap-2">
        <RunLine title="Números" run={runs.metrics} timeZone={timeZone} />
        <RunLine title="Leads" run={runs.leads} timeZone={timeZone} />
      </ul>
      <p className="mb-3 text-[11px] text-soft">Sozinho: números a cada 3 horas e leads a cada 5 minutos. O app só lê da Meta; nada é mudado lá.</p>
      <div className="flex flex-wrap gap-2">
        <ActionForm action={syncMetaNow} className="flex flex-col gap-2">
          <Button type="submit" variant="primary">Sincronizar agora</Button>
        </ActionForm>
        {runs.metricsOk && (
          <ActionForm action={syncMetaFull} className="flex flex-col gap-2">
            <Button type="submit">Recarregar todo o histórico</Button>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
