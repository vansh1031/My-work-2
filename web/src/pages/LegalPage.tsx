import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../lib/api";
import { AppShell, PublicShell } from "../components/AppShell";
import { Markdown } from "../components/Markdown";
import { ErrorNotice } from "../components/Notice";

/** Privacy policy and terms. The text comes from config/legal/*.md, so each client can have its own. */
export function LegalPage({ page }: { page: "privacy" | "terms" }) {
  const { user } = useAuth();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api.get<{ markdown: string }>(`/api/legal/${page}`).then((r) => setText(r.markdown), setError);
  }, [page]);
  const Shell = user ? AppShell : PublicShell;
  return (
    <Shell>
      <div className="page">
<section className="page-panel">
        <div className="panel-body">
          <ErrorNotice error={error} />
          {text !== null && <Markdown text={text} />}
        </div>
      </section>
      </div>
    </Shell>
  );
}
