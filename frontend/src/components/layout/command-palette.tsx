"use client";

/**
 * CommandPalette  (⌘K / Ctrl+K)
 *
 * - Jump to any module (searches labels, groups and keywords).
 * - Quick actions: create a request, RFQ, PO, budget...
 * - Live search of suppliers and purchase requests (debounced, via your API).
 * - Remembers the 5 most recent modules you opened.
 * - Keyboard: ↑ ↓ to move, ↵ to open, Esc to close.
 *
 * It is mounted only while open, so its state resets on every open.
 */
import {
  Building2,
  Plus,
  Search,
  ShoppingCart,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { allNavigationItems } from "@/components/layout/navigation";
import { getPurchaseRequests, getSuppliers } from "@/lib/api";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
}

interface PaletteSection {
  title: string;
  items: PaletteItem[];
}

interface RemoteResults {
  query: string;
  suppliers: PaletteItem[];
  requests: PaletteItem[];
}

const RECENT_KEY = "procureiq.recent-modules";
const MAX_RECENT = 5;
const MIN_REMOTE_QUERY = 2;
const REMOTE_LIMIT = 5;
const REMOTE_DEBOUNCE_MS = 250;

const moduleItems: PaletteItem[] = allNavigationItems.map((item) => ({
  id: `module:${item.href}`,
  label: item.label,
  hint: item.groupLabel,
  href: item.href,
  icon: item.icon,
  keywords: item.keywords,
}));

const moduleByHref = new Map(
  moduleItems.map((item) => [item.href, item] as const),
);

/** Shown under "Jump to" when the search box is empty. */
const featuredHrefs = [
  "/command-center",
  "/suppliers",
  "/purchase-requests",
  "/rfqs",
  "/purchase-orders",
  "/approvals",
  "/budgets",
  "/risks",
];

const quickActions: PaletteItem[] = [
  { id: "action:pr", label: "New purchase request", hint: "Create", href: "/purchase-requests/new", icon: Plus, keywords: "buy requisition demand" },
  { id: "action:rfq", label: "New RFQ", hint: "Create", href: "/rfqs/new", icon: Plus, keywords: "sourcing tender quotation" },
  { id: "action:po", label: "New purchase order", hint: "Create", href: "/purchase-orders/new", icon: Plus, keywords: "order" },
  { id: "action:budget", label: "New budget", hint: "Create", href: "/budgets/new", icon: Plus, keywords: "allocation" },
  { id: "action:saving", label: "New savings initiative", hint: "Create", href: "/savings/new", icon: Plus, keywords: "value" },
  { id: "action:risk", label: "New risk case", hint: "Create", href: "/risks/new", icon: Plus, keywords: "register" },
  { id: "action:invoice", label: "New invoice", hint: "Create", href: "/invoice-control/new", icon: Plus, keywords: "payable matching" },
  { id: "action:onboarding", label: "New supplier onboarding case", hint: "Create", href: "/supplier-onboarding/new", icon: Plus, keywords: "vendor qualification" },
];

function readRecent(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(RECENT_KEY) ?? "[]",
    );

    return Array.isArray(parsed)
      ? parsed
          .filter((value): value is string => typeof value === "string")
          .slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function rememberRecent(href: string): void {
  try {
    const next = [href, ...readRecent().filter((entry) => entry !== href)].slice(
      0,
      MAX_RECENT,
    );

    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Recents are a convenience only.
  }
}

/** Every token must appear somewhere; earlier/label matches rank higher. */
function scoreItem(item: PaletteItem, tokens: string[]): number {
  const label = item.label.toLowerCase();
  const haystack = `${label} ${(item.hint ?? "").toLowerCase()} ${(item.keywords ?? "").toLowerCase()}`;

  let total = 0;

  for (const token of tokens) {
    if (!haystack.includes(token)) {
      return -1;
    }

    total += label.startsWith(token) ? 3 : label.includes(token) ? 2 : 1;
  }

  return total;
}

function rank(
  items: PaletteItem[],
  tokens: string[],
  limit: number,
): PaletteItem[] {
  return items
    .map((item) => ({ item, score: scoreItem(item, tokens) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<RemoteResults | null>(null);
  const [recentHrefs] = useState<string[]>(readRecent);

  const term = query.trim();
  const remoteEnabled = term.length >= MIN_REMOTE_QUERY;
  const visibleRemote = remoteEnabled ? remote : null;
  const searching = remoteEnabled && remote?.query !== term;

  // Focus the search box and lock page scroll while the palette is open.
  useEffect(() => {
    inputRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Debounced live search of suppliers and purchase requests.
  useEffect(() => {
    if (term.length < MIN_REMOTE_QUERY) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      const [supplierResult, requestResult] = await Promise.allSettled([
        getSuppliers({ query: term }),
        getPurchaseRequests({ query: term }),
      ]);

      if (cancelled) {
        return;
      }

      // allSettled: a role without access to one of them (403) must not break the other.
      setRemote({
        query: term,
        suppliers:
          supplierResult.status === "fulfilled"
            ? supplierResult.value.slice(0, REMOTE_LIMIT).map((supplier) => ({
                id: `supplier:${supplier.id}`,
                label: supplier.legalName,
                hint: `${supplier.supplierCode} · ${supplier.category}`,
                href: `/suppliers/${supplier.id}`,
                icon: Building2,
              }))
            : [],
        requests:
          requestResult.status === "fulfilled"
            ? requestResult.value.slice(0, REMOTE_LIMIT).map((request) => ({
                id: `request:${request.id}`,
                label: `${request.requestNumber} · ${request.title}`,
                hint: request.status.replaceAll("_", " "),
                href: `/purchase-requests/${request.id}`,
                icon: ShoppingCart,
              }))
            : [],
      });
    }, REMOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  const sections = useMemo<PaletteSection[]>(() => {
    const result: PaletteSection[] = [];
    const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);

    // Empty box → recents, quick actions, featured modules.
    if (tokens.length === 0) {
      const recent = recentHrefs
        .map((href) => moduleByHref.get(href))
        .filter((item): item is PaletteItem => item !== undefined);

      if (recent.length > 0) {
        result.push({ title: "Recent", items: recent });
      }

      result.push({ title: "Quick actions", items: quickActions });

      const featured = featuredHrefs
        .filter((href) => !recentHrefs.includes(href))
        .map((href) => moduleByHref.get(href))
        .filter((item): item is PaletteItem => item !== undefined);

      result.push({ title: "Jump to", items: featured });

      return result;
    }

    const actions = rank(quickActions, tokens, 4);
    const modules = rank(moduleItems, tokens, 8);

    if (actions.length > 0) {
      result.push({ title: "Quick actions", items: actions });
    }

    if (modules.length > 0) {
      result.push({ title: "Modules", items: modules });
    }

    if (visibleRemote && visibleRemote.suppliers.length > 0) {
      result.push({ title: "Suppliers", items: visibleRemote.suppliers });
    }

    if (visibleRemote && visibleRemote.requests.length > 0) {
      result.push({
        title: "Purchase requests",
        items: visibleRemote.requests,
      });
    }

    return result;
  }, [term, recentHrefs, visibleRemote]);

  const flat = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  );

  // Clamp so a shrinking result list can never leave the highlight out of range.
  const safeActive = Math.min(active, Math.max(flat.length - 1, 0));

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    document
      .getElementById(`palette-item-${safeActive}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [safeActive]);

  function choose(item: PaletteItem) {
    if (item.id.startsWith("module:")) {
      rememberRecent(item.href);
    }

    onClose();
    router.push(item.href);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (flat.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(safeActive + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(safeActive - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();

      const item = flat[safeActive];

      if (item) {
        choose(item);
      }
    }
  }

  // Start index of each section inside the flat list (pure, no mutation).
  const offsets = sections.map((_, sectionIndex) =>
    sections
      .slice(0, sectionIndex)
      .reduce((count, section) => count + section.items.length, 0),
  );

  return (
    <div
      className="palette-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
      >
        <div className="palette__input">
          <Search size={18} />

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search modules, suppliers, requests — or run an action..."
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={
              flat.length > 0 ? `palette-item-${safeActive}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
          />

          <button
            type="button"
            className="palette__close"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        <div className="palette__list" id="palette-list" role="listbox">
          {sections.map((section, sectionIndex) => (
            <div key={section.title}>
              <div className="palette__section-title">{section.title}</div>

              {section.items.map((item, itemIndex) => {
                const index = offsets[sectionIndex] + itemIndex;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    id={`palette-item-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === safeActive}
                    className={`palette__item${
                      index === safeActive ? " palette__item--active" : ""
                    }`}
                    onMouseMove={() => {
                      if (active !== index) {
                        setActive(index);
                      }
                    }}
                    onClick={() => choose(item)}
                  >
                    <span className="palette__item-icon">
                      <Icon size={15} />
                    </span>

                    <span className="palette__item-label">{item.label}</span>

                    {item.hint ? (
                      <span className="palette__item-hint">{item.hint}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}

          {searching ? (
            <div className="palette__status">
              Searching suppliers and purchase requests…
            </div>
          ) : null}

          {sections.length === 0 && !searching ? (
            <div className="palette__empty">
              No matches for “{term}”. Try a module name, supplier or request
              number.
            </div>
          ) : null}
        </div>

        <div className="palette__footer">
          <span>
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            navigate
          </span>

          <span>
            <kbd className="kbd">↵</kbd>
            open
          </span>

          <span>
            <kbd className="kbd">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
