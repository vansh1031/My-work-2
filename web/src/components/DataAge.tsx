// How old a factory's statuses are. Statuses come from the daily Excel upload, so they can be days old;
// this makes that visible instead of letting old numbers look current (idea from Edge Watch, D-044).
// The warning starts after config/app.json dataAgeWarningDays days (0 switches it off).
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import type { FactorySummary } from "@fa/shared";
import { useConfig } from "../config/ConfigProvider";
import { useAuth } from "../auth/AuthProvider";
import { formatDate, formatShortDate, todayIso } from "../lib/format";
import { Notice } from "./Notice";

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export interface DataAge {
  /** Whole days between the newest status and today. null if there is no status yet. */
  days: number | null;
  /** True when the warning should show: no data, or older than the configured number of days. */
  old: boolean;
}

export function useDataAge(latestWorkDate: string | null): DataAge {
  const { config } = useConfig();
  const limit = config.app.dataAgeWarningDays;
  if (!latestWorkDate) return { days: null, old: limit > 0 };
  const days = Math.max(0, dayNumber(todayIso()) - dayNumber(latestWorkDate));
  return { days, old: limit > 0 && days > limit };
}

function ageWords(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "1 day old";
  return `${days} days old`;
}

/** One short line for the factory list on the home page. */
export function DataAgeText({ factory }: { factory: FactorySummary }) {
  const age = useDataAge(factory.latestWorkDate);
  if (!factory.latestWorkDate) {
    return <span className={age.old ? "data-age old" : "data-age"}>No status data yet</span>;
  }
  return (
    <span className={age.old ? "data-age old" : "data-age"} title={`Newest status: ${formatDate(factory.latestWorkDate)}`}>
      {age.old && <AlertTriangle aria-hidden />}
      Data from {formatShortDate(factory.latestWorkDate)}
      {age.old && age.days !== null && <> ({ageWords(age.days)})</>}
    </span>
  );
}

/** Banner on the factory pages when the statuses are old or missing. Shows nothing when they are recent. */
export function DataAgeNotice({ factory }: { factory: FactorySummary }) {
  const { config } = useConfig();
  const { user } = useAuth();
  const age = useDataAge(factory.latestWorkDate);
  if (!age.old || factory.machineCount === 0) return null;
  const canUpload = Boolean(user?.canUpdateStatus && config.app.features.excelUpload);
  const action = canUpload ? (
    <Link to={`/factories/${factory.id}/upload`}>Upload the latest sheet</Link>
  ) : (
    <span>Ask someone who uploads the daily sheet to bring it up to date.</span>
  );
  return (
    <div data-testid="data-age-notice">
      <Notice kind="warn">
        {factory.latestWorkDate ? (
          <>
            The newest status is from {formatDate(factory.latestWorkDate)}, {ageWords(age.days ?? 0)}. The statuses below may not match the machines today.{" "}
          </>
        ) : (
          <>No statuses have been uploaded for this factory yet. </>
        )}
        {action}
      </Notice>
    </div>
  );
}
