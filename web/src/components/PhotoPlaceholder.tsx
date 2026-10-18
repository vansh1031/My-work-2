import { useState } from "react";
import { apiUrl } from "../lib/api";

/** Factory photo, or a plain "Photo pending" drawing until the admin uploads a real one. */
export function FactoryPhoto({ url, name, className = "card-thumb" }: { url: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img className={className} src={apiUrl(url)} alt={`Photo of ${name}`} loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <svg className={className} viewBox="0 0 120 90" role="img" aria-label="Photo pending">
      <rect width="120" height="90" fill="var(--bg)" />
      <path d="M14 66V44l16 9v-9l16 9v-9l16 9V30h10v36z" fill="none" stroke="var(--border)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M8 66h104" stroke="var(--border)" strokeWidth="2.5" />
      <text x="60" y="81" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="inherit">Photo pending</text>
    </svg>
  );
}
