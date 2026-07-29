import { WifiOff } from "lucide-react";
import { copy } from "../lib/copy";

export function ServerStatusBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <aside className="offline-banner" role="status" aria-live="polite">
      <WifiOff size={18} aria-hidden="true" />
      <span>{copy.serverOffline}</span>
    </aside>
  );
}
