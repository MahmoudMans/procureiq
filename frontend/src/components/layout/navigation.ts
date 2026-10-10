/**
 * navigation.ts
 *
 * Single source of truth for the ProcureIQ module map.
 * Used by:
 *   - sidebar.tsx          (grouped, collapsible navigation)
 *   - command-palette.tsx  (⌘K search across every module)
 *   - breadcrumbs.tsx      (readable labels for the current URL)
 *
 * To add a page to the menu, add ONE entry below — all three update.
 */
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bell,
  BrainCircuit,
  Building2,
  CalendarRange,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Files,
  GaugeCircle,
  Goal,
  Handshake,
  KeyRound,
  Landmark,
  Layers3,
  LayoutDashboard,
  Leaf,
  MessageSquareText,
  PackageOpen,
  PanelsTopLeft,
  Radar,
  ReceiptText,
  Route,
  ScanSearch,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  UserCheck,
  Users,
  UsersRound,
  WalletCards,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra search terms for the command palette (never displayed). */
  keywords?: string;
}

export interface NavigationGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavigationItem[];
}

export interface FlatNavigationItem extends NavigationItem {
  groupId: string;
  groupLabel: string;
}

export const navigationGroups: NavigationGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: LayoutDashboard,
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, keywords: "home dashboard" },
      { href: "/command-center", label: "Command center", icon: PanelsTopLeft, keywords: "actions priorities tasks todo" },
      { href: "/executive-cockpit", label: "Executive cockpit", icon: Radar, keywords: "early warning executive" },
      { href: "/control-tower", label: "Control tower", icon: Activity, keywords: "exceptions monitoring" },
      { href: "/approvals", label: "Approvals", icon: ClipboardCheck, keywords: "approve pending workflow inbox" },
      { href: "/activity", label: "Activity feed", icon: Bell, keywords: "notifications audit log history" },
    ],
  },
  {
    id: "sourcing",
    label: "Sourcing & buying",
    icon: ShoppingCart,
    items: [
      { href: "/guided-buying", label: "Guided buying", icon: Route, keywords: "catalog intake route" },
      { href: "/purchase-requests", label: "Purchase requests", icon: ShoppingCart, keywords: "pr requisition demand" },
      { href: "/rfqs", label: "RFQs & sourcing", icon: FileText, keywords: "rfq tender quotation bids" },
      { href: "/negotiations", label: "Negotiations", icon: Handshake, keywords: "negotiate counter offer" },
      { href: "/purchase-orders", label: "Purchase orders", icon: PackageOpen, keywords: "po order" },
      { href: "/deliveries", label: "Deliveries", icon: Truck, keywords: "goods receipt shipment" },
      { href: "/invoice-control", label: "Invoice control", icon: ReceiptText, keywords: "invoice matching three-way payable" },
      { href: "/demand-consolidation", label: "Demand consolidation", icon: Layers3, keywords: "bundle aggregate" },
    ],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    icon: Building2,
    items: [
      { href: "/suppliers", label: "Suppliers", icon: Building2, keywords: "vendor portfolio master data" },
      { href: "/supplier-onboarding", label: "Supplier onboarding", icon: UserCheck, keywords: "qualification vendor intake" },
      { href: "/supplier-collaboration", label: "Collaboration", icon: MessageSquareText, keywords: "workspace messages supplier" },
      { href: "/supplier-portal-admin", label: "Portal access", icon: KeyRound, keywords: "supplier portal invite account" },
      { href: "/supplier-document-vault", label: "Document vault", icon: Files, keywords: "certificates documents files" },
      { href: "/supplier-performance", label: "Performance", icon: ClipboardCheck, keywords: "scorecard review kpi" },
      { href: "/supplier-resilience", label: "Resilience", icon: ShieldCheck, keywords: "dependency alternative concentration" },
      { href: "/supplier-risk-monitoring", label: "Continuous risk", icon: Activity, keywords: "watchlist alerts monitoring" },
      { href: "/sustainability", label: "Sustainability", icon: Leaf, keywords: "esg carbon green" },
    ],
  },
  {
    id: "governance",
    label: "Governance & risk",
    icon: ShieldCheck,
    items: [
      { href: "/compliance", label: "Policy & compliance", icon: ShieldCheck, keywords: "policy violation waiver" },
      { href: "/contracts", label: "Contracts & compliance", icon: FileCheck2, keywords: "contract expiry renewal" },
      { href: "/commercial-governance", label: "Commercial governance", icon: ScrollText, keywords: "leakage obligation renewal" },
      { href: "/risks", label: "Risk register", icon: ShieldAlert, keywords: "risk mitigation" },
      { href: "/anomaly-control", label: "Anomaly control", icon: ScanSearch, keywords: "fraud investigation unusual" },
      { href: "/data-quality", label: "Data quality", icon: Database, keywords: "duplicates missing master data" },
      { href: "/governance-reviews", label: "Executive reviews", icon: Landmark, keywords: "board review decisions" },
      { href: "/benefits-governance", label: "Benefits governance", icon: BadgeDollarSign, keywords: "benefit realization leakage" },
    ],
  },
  {
    id: "finance",
    label: "Finance & insight",
    icon: WalletCards,
    items: [
      { href: "/budgets", label: "Budget control", icon: WalletCards, keywords: "budget allocation spend limit" },
      { href: "/planning", label: "Procurement planning", icon: CalendarRange, keywords: "forecast plan demand" },
      { href: "/savings", label: "Savings & value", icon: BadgeDollarSign, keywords: "savings initiative realization" },
      { href: "/category-management", label: "Category management", icon: Layers3, keywords: "category strategy kraljic" },
      { href: "/portfolio-optimization", label: "Portfolio optimization", icon: SlidersHorizontal, keywords: "scenario optimize" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, keywords: "spend charts trends" },
      { href: "/reports", label: "Reports", icon: FileSpreadsheet, keywords: "export snapshot executive report" },
      { href: "/process-mining", label: "Process mining", icon: Workflow, keywords: "bottleneck cycle time deviation" },
    ],
  },
  {
    id: "strategy",
    label: "Strategy",
    icon: Goal,
    items: [
      { href: "/strategic-objectives", label: "Strategic objectives", icon: Goal, keywords: "okr objectives key results" },
      { href: "/strategic-alignment", label: "Strategic alignment", icon: Goal },
      { href: "/strategy-cockpit", label: "Strategy cockpit", icon: Radar, keywords: "board scorecard" },
      { href: "/strategy-scenarios", label: "Strategy scenarios", icon: SlidersHorizontal },
      { href: "/strategy-roadmaps", label: "Strategy roadmaps", icon: Route },
      { href: "/strategy-execution", label: "Strategy execution", icon: ClipboardCheck },
      { href: "/strategy-recovery", label: "Execution recovery", icon: ShieldAlert },
      { href: "/outcome-persistence", label: "Outcome persistence", icon: ShieldCheck },
      { href: "/strategic-value", label: "Strategic value", icon: BadgeDollarSign },
      { href: "/operating-rhythm", label: "Operating rhythm", icon: GaugeCircle, keywords: "cadence snapshot" },
      { href: "/continuous-improvement", label: "Continuous improvement", icon: Wrench, keywords: "kaizen initiative" },
    ],
  },
  {
    id: "organization",
    label: "People & capability",
    icon: UsersRound,
    items: [
      { href: "/capacity-planning", label: "Capacity planning", icon: UsersRound, keywords: "workload team utilization" },
      { href: "/capability-planning", label: "Capability planning", icon: BrainCircuit, keywords: "skills gaps" },
      { href: "/succession-planning", label: "Succession planning", icon: UsersRound, keywords: "successor critical roles" },
      { href: "/team", label: "Team", icon: Users, keywords: "users members directory" },
    ],
  },
  {
    id: "capital",
    label: "Capital programme",
    icon: Landmark,
    items: [
      { href: "/capital-allocation", label: "Capital allocation", icon: BadgeDollarSign },
      { href: "/funding-execution", label: "Funding execution", icon: WalletCards, keywords: "tranche release" },
      { href: "/investment-performance", label: "Investment performance", icon: BarChart3 },
      { href: "/investment-interventions", label: "Investment intervention", icon: Wrench },
      { href: "/intervention-execution", label: "Intervention execution", icon: ClipboardCheck },
      { href: "/capital-recycling", label: "Capital recycling", icon: Workflow },
      { href: "/capital-redeployment", label: "Capital redeployment", icon: Route },
      { href: "/reinvestment-performance", label: "Reinvestment performance", icon: GaugeCircle },
      { href: "/reinvestment-persistence", label: "Reinvestment persistence", icon: ShieldCheck },
    ],
  },
  {
    id: "flywheel",
    label: "Capital flywheel",
    icon: Radar,
    items: [
      { href: "/capital-flywheel", label: "Capital flywheel", icon: Radar },
      { href: "/flywheel-strategy", label: "Flywheel strategy", icon: Goal },
      { href: "/flywheel-allocation", label: "Capital mandates", icon: ScrollText, keywords: "allocation mandate" },
      { href: "/flywheel-release", label: "Capital release", icon: PackageOpen },
      { href: "/flywheel-settlement", label: "Settlement evidence", icon: FileCheck2, keywords: "reconciliation" },
      { href: "/flywheel-variance", label: "Variance resolution", icon: SlidersHorizontal },
      { href: "/flywheel-variance-execution", label: "Treatment execution", icon: Wrench },
      { href: "/flywheel-remediation", label: "Residual remediation", icon: ShieldAlert },
      { href: "/flywheel-remediation-outcomes", label: "Remediation outcomes", icon: ClipboardCheck },
      { href: "/flywheel-remediation-continuations", label: "Residual continuations", icon: Layers3 },
      { href: "/flywheel-continuation-outcomes", label: "Continuation outcomes", icon: GaugeCircle },
      { href: "/flywheel-continuation-rollovers", label: "Residual cycle rollovers", icon: Workflow },
      { href: "/flywheel-rollover-outcomes", label: "Rollover outcomes", icon: BarChart3 },
    ],
  },
];

/** Every module as a flat list, tagged with its group. */
export const allNavigationItems: FlatNavigationItem[] = navigationGroups.flatMap(
  (group) =>
    group.items.map((item) => ({
      ...item,
      groupId: group.id,
      groupLabel: group.label,
    })),
);

/** href → label lookup (used by breadcrumbs). */
export const labelByHref: ReadonlyMap<string, string> = new Map(
  allNavigationItems.map((item) => [item.href, item.label] as const),
);

/** True when `pathname` is the module page itself or any page beneath it. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Group id that owns the current page (so the sidebar can auto-expand it). */
export function findGroupIdForPath(pathname: string): string | null {
  const match = allNavigationItems.find((item) =>
    isActivePath(pathname, item.href),
  );

  return match ? match.groupId : null;
}
