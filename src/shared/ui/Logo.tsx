import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/library"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="StudyMark home"
    >
      <span className="brand-icon">
        <BookOpen size={23} strokeWidth={1.8} />
      </span>
      <span>
        Study<span className="brand-accent">Mark</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
