import { Link } from "react-router-dom";
import { useScene } from "../state/SceneProvider";

export function NotFoundPage() {
  useScene({ kind: "none" });
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Page not found</h1>
        <p className="muted">This address does not match any screen.</p>
        <Link to="/" className="btn btn-primary" style={{ justifySelf: "start" }}>Go to factories</Link>
      </div>
    </div>
  );
}
