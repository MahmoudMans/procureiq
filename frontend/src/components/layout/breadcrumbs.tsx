"use client";

/**
 * Breadcrumbs
 * Built from the URL, with friendly labels from navigation.ts.
 * - UUIDs / numeric ids are shown as "Details".
 * - A crumb is only a link when it is a real module page (never a 404).
 */
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { labelByHref } from "@/components/layout/navigation";

const IDENTIFIER_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

interface Crumb {
  href: string;
  label: string;
  linkable: boolean;
}

function humanize(segment: string): string {
  let decoded = segment;

  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Malformed escape sequence — fall back to the raw segment.
  }

  return decoded
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);

  // Each crumb's href is derived from the segments before it (no mutable accumulator).
  const crumbs: Crumb[] = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const known = labelByHref.get(href);

    return {
      href,
      label:
        known ??
        (IDENTIFIER_PATTERN.test(segment) ? "Details" : humanize(segment)),
      linkable: known !== undefined,
    };
  });

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link href="/">Home</Link>

      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;

        return (
          <span className="breadcrumbs__step" key={crumb.href}>
            <ChevronRight size={13} aria-hidden="true" />

            {last ? (
              <span className="breadcrumbs__current" aria-current="page">
                {crumb.label}
              </span>
            ) : crumb.linkable ? (
              <Link href={crumb.href}>{crumb.label}</Link>
            ) : (
              <span>{crumb.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
