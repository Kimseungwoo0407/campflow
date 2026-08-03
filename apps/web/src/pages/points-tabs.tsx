import { Award, Coins } from "lucide-react";
import { NavLink } from "react-router-dom";

export function PointsTabs({ tripId }: { tripId: string }) {
  return (
    <nav className="points-tabs" aria-label="포인트 메뉴">
      <NavLink end to={`/trips/${tripId}/points`}>
        <Coins size={17} />
        포인트 홈
      </NavLink>
      <NavLink to={`/trips/${tripId}/achievements`}>
        <Award size={17} />
        업적
      </NavLink>
    </nav>
  );
}
