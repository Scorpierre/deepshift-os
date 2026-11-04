"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

// ─── Helpers date (tout en local, jamais toISOString : décalage de fuseau) ────

function toISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fromISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

/** ISO → "jj/mm/aaaa" pour l'affichage dans le champ. */
function isoToText(iso: string) {
  const d = fromISO(iso);
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Masque de saisie : on ne garde que les chiffres et on regroupe jj/mm/aaaa. */
function maskTyping(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  return parts.filter((p) => p.length > 0).join("/");
}

/**
 * Texte saisi → ISO. Retourne "" pour un champ vidé, null si illisible.
 * Accepte 8 chiffres (jjmmaaaa), 6 (jjmmaa), 4 (jjmm) et 1-2 (jour du mois courant).
 */
function parseTyped(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const today = new Date();
  let day: number, month: number, year: number;

  if (digits.length === 8) {
    day = +digits.slice(0, 2); month = +digits.slice(2, 4); year = +digits.slice(4, 8);
  } else if (digits.length === 6) {
    day = +digits.slice(0, 2); month = +digits.slice(2, 4); year = 2000 + +digits.slice(4, 6);
  } else if (digits.length === 4) {
    day = +digits.slice(0, 2); month = +digits.slice(2, 4); year = today.getFullYear();
  } else if (digits.length <= 2) {
    day = +digits; month = today.getMonth() + 1; year = today.getFullYear();
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1) return null;
  const d = new Date(year, month - 1, day);
  // Rejette les dates qui débordent (31/02 deviendrait le 03/03).
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toISO(d);
}

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** 42 cases (6 semaines) commençant un lundi, comme la grille de l'Agenda. */
function monthGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // lundi = 0
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  );
}

// ─── DateField ────────────────────────────────────────────────────────────────

type DateFieldProps = {
  /** Date au format ISO "aaaa-mm-jj", ou "" si vide. */
  value: string;
  /** Reçoit une date ISO valide, ou "" quand le champ est vidé. */
  onChange: (iso: string) => void;
  placeholder?: string;
  /** Appliqué au conteneur — sert surtout à fixer la largeur. */
  className?: string;
  autoFocus?: boolean;
};

export function DateField({
  value,
  onChange,
  placeholder = "jj/mm/aaaa",
  className,
  autoFocus,
}: DateFieldProps) {
  // `draft` ne vit que pendant la saisie. À null, l'affichage dérive de `value`,
  // ce qui resynchronise gratuitement le champ quand la valeur change côté serveur.
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => fromISO(value) ?? new Date());

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const text = draft ?? isoToText(value);

  function openPicker() {
    setCursor(fromISO(value) ?? new Date());
    setOpen(true);
  }

  // Fermeture au clic extérieur — pas d'overlay plein écran, le champ doit
  // rester cliquable pendant que le calendrier est ouvert.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  /** Valide ce qui est tapé ; revient à la dernière valeur connue si illisible. */
  function commitText() {
    if (draft === null) return;
    const iso = parseTyped(draft);
    setDraft(null); // l'affichage repart de `value` — annule une saisie illisible
    if (iso !== null && iso !== value) onChange(iso);
  }

  function pick(d: Date) {
    const iso = toISO(d);
    setDraft(null);
    setOpen(false);
    if (iso !== value) onChange(iso);
  }

  const selected = fromISO(value);
  const todayISO = toISO(new Date());
  const days = monthGrid(cursor);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="flex items-center gap-1 w-full bg-muted/30 border border-border rounded-xl pl-3 pr-1 transition-colors focus-within:border-primary/40">
        <input
          ref={inputRef}
          value={text}
          autoFocus={autoFocus}
          inputMode="numeric"
          placeholder={placeholder}
          onChange={(e) => {
            const next = maskTyping(e.target.value);
            setDraft(next);
            // Le calendrier suit ce qu'on tape dès que la date devient lisible.
            const iso = parseTyped(next);
            const d = iso ? fromISO(iso) : null;
            if (d) setCursor(d);
          }}
          onFocus={openPicker}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitText(); setOpen(false); }
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          }}
          className="w-full min-w-0 text-sm bg-transparent py-2 outline-none placeholder:text-muted-foreground/35"
        />
        <button
          type="button"
          aria-label="Ouvrir le calendrier"
          // mousedown plutôt que click : évite que le blur de l'input referme
          // le calendrier juste avant que le clic soit traité.
          onMouseDown={(e) => {
            e.preventDefault();
            if (open) setOpen(false); else openPicker();
            inputRef.current?.focus();
          }}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Calendar size={13} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              aria-label="Mois précédent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium capitalize">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Mois suivant"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-[9px] text-muted-foreground/60 text-center uppercase tracking-wide py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const iso = toISO(d);
              const isCurrentMonth = d.getMonth() === cursor.getMonth();
              const isSelected = selected != null && iso === toISO(selected);
              const isToday = iso === todayISO;
              return (
                <button
                  key={iso}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(d)}
                  className={cn(
                    "h-7 text-xs rounded-lg transition-colors",
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground/30",
                    !isSelected && "hover:bg-muted",
                    isToday && !isSelected && "text-primary font-medium",
                    isSelected && "bg-primary text-primary-foreground font-medium"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(new Date())}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setDraft(null); setOpen(false); if (value !== "") onChange(""); }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Effacer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
