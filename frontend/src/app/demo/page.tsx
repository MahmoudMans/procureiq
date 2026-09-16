import Link from "next/link";

import styles from "./demo.module.css";


const qualityProof = [
  {
    value: "83",
    label: "Flyway migrations",
  },
  {
    value: "501",
    label: "Backend tests",
  },
  {
    value: "0",
    label: "Backend failures",
  },
  {
    value: "JWT",
    label: "Authentication",
  },
  {
    value: "RBAC",
    label: "Authorization",
  },
  {
    value: "V83",
    label: "PostgreSQL schema",
  },
] as const;


const modules = [
    {
        "title": "Supplier Collaboration",
        "href": "/supplier-collaboration"
    },
    {
        "title": "Supplier Document Vault",
        "href": "/supplier-document-vault"
    },
    {
        "title": "Supplier Onboarding",
        "href": "/supplier-onboarding"
    },
    {
        "title": "Supplier Performance",
        "href": "/supplier-performance"
    },
    {
        "title": "Supplier Portal Admin",
        "href": "/supplier-portal-admin"
    },
    {
        "title": "Supplier Resilience",
        "href": "/supplier-resilience"
    },
    {
        "title": "Supplier Risk Monitoring",
        "href": "/supplier-risk-monitoring"
    },
    {
        "title": "Suppliers",
        "href": "/suppliers"
    },
    {
        "title": "Purchase Requests",
        "href": "/purchase-requests"
    },
    {
        "title": "Supplier Collaboration / New",
        "href": "/supplier-collaboration/new"
    },
    {
        "title": "Supplier Onboarding / New",
        "href": "/supplier-onboarding/new"
    },
    {
        "title": "Supplier Performance / New",
        "href": "/supplier-performance/new"
    },
    {
        "title": "Supplier Portal / Activate",
        "href": "/supplier-portal/activate"
    },
    {
        "title": "Supplier Portal / Documents",
        "href": "/supplier-portal/documents"
    },
    {
        "title": "Supplier Portal / Home",
        "href": "/supplier-portal/home"
    },
    {
        "title": "Approvals",
        "href": "/approvals"
    }
] as const;


const journey = [
    {
        "number": "01",
        "title": "Demand",
        "description": "Capture the business need and start a governed procurement request.",
        "href": "/purchase-requests",
        "routeTitle": "Purchase Requests"
    },
    {
        "number": "02",
        "title": "Approval",
        "description": "Route the request through controlled approval and authorization.",
        "href": "/approvals",
        "routeTitle": "Approvals"
    },
    {
        "number": "03",
        "title": "Source",
        "description": "Launch sourcing, compare quotations and evaluate supplier options.",
        "href": "/rfqs",
        "routeTitle": "Rfqs"
    },
    {
        "number": "04",
        "title": "Order",
        "description": "Convert the approved sourcing outcome into controlled purchasing execution.",
        "href": "/purchase-orders",
        "routeTitle": "Purchase Orders"
    },
    {
        "number": "05",
        "title": "Receive",
        "description": "Track delivery and receipt evidence against purchasing commitments.",
        "href": "/supplier-portal-admin",
        "routeTitle": "Supplier Portal Admin"
    },
    {
        "number": "06",
        "title": "Control",
        "description": "Review invoice, contract, compliance and commercial-control signals.",
        "href": "/invoice-control",
        "routeTitle": "Invoice Control"
    },
    {
        "number": "07",
        "title": "Govern",
        "description": "Follow risk, performance and strategic residual governance through closure.",
        "href": "/supplier-risk-monitoring",
        "routeTitle": "Supplier Risk Monitoring"
    }
] as const;


const capabilities = [
  {
    title: "Source-to-Pay",
    copy:
      "Demand, requests, approvals, sourcing, quotations, purchase orders, delivery and invoice controls.",
  },
  {
    title: "Supplier Governance",
    copy:
      "Supplier onboarding, performance, compliance, resilience, sustainability, collaboration and risk.",
  },
  {
    title: "Commercial Control",
    copy:
      "Contracts, budgets, savings, leakage controls, invoice governance and procurement policy enforcement.",
  },
  {
    title: "Executive Analytics",
    copy:
      "Control-tower views, operating rhythm, strategic alignment, scenario planning and management evidence.",
  },
  {
    title: "Capital Governance",
    copy:
      "Investment performance, intervention, recycling, redeployment and multi-cycle capital-governance workflows.",
  },
  {
    title: "Residual Assurance",
    copy:
      "Remediation, continuation, rollover, evidence cycles, immutable snapshots and recursive residual governance.",
  },
] as const;


const architecture = [
  {
    role: "Experience",
    tech: "Next.js · TypeScript",
    copy: "Responsive enterprise interface and workflow navigation.",
  },
  {
    role: "Application",
    tech: "Spring Boot · Java",
    copy: "Domain services, REST boundaries, validation, security and transactional workflows.",
  },
  {
    role: "Data",
    tech: "PostgreSQL · Flyway",
    copy: "Relational persistence, integrity constraints and versioned schema evolution.",
  },
] as const;


export default function DemoPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            ProcureIQ · Portfolio Demo Release
          </p>

          <h1 className={styles.title}>
            Enterprise procurement,
            <span> engineered end to end.</span>
          </h1>

          <p className={styles.lead}>
            ProcureIQ is a full-stack procurement management platform covering
            operational purchasing, supplier governance, commercial control,
            risk, analytics and strategic capital governance.
          </p>

          <div className={styles.heroActions}>
            <a
              className={styles.primaryAction}
              href="#journey"
            >
              Start the demo journey
            </a>

            <a
              className={styles.secondaryAction}
              href="#modules"
            >
              Explore real modules
            </a>
          </div>
        </div>

        <aside className={styles.releaseCard}>
          <p className={styles.releaseLabel}>
            Frozen engineering baseline
          </p>

          <p className={styles.releaseValue}>
            Step 93
          </p>

          <div className={styles.releaseMeta}>
            <span>
              13d7ec6
            </span>

            <span>
              V83
            </span>

            <span>
              501 / 501
            </span>
          </div>

          <p className={styles.releaseCopy}>
            Whole application context, Hibernate metamodel, PostgreSQL migration
            chain and complete backend regression validated before this final
            showcase release.
          </p>
        </aside>
      </section>


      <section
        aria-labelledby="proof-title"
        className={styles.section}
      >
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>
              Engineering proof
            </p>

            <h2
              className={styles.sectionTitle}
              id="proof-title"
            >
              Built beyond the prototype stage.
            </h2>
          </div>

          <p className={styles.sectionCopy}>
            The demo sits on the same tested application used by the real
            procurement workflows rather than on a disconnected marketing
            mock-up.
          </p>
        </div>

        <div className={styles.proofGrid}>
          {qualityProof.map((item) => (
            <article
              className={styles.proofCard}
              key={item.label}
            >
              <strong className={styles.proofValue}>
                {item.value}
              </strong>

              <span className={styles.proofLabel}>
                {item.label}
              </span>
            </article>
          ))}
        </div>
      </section>


      <section
        aria-labelledby="journey-title"
        className={styles.section}
        id="journey"
      >
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>
              Recommended walkthrough
            </p>

            <h2
              className={styles.sectionTitle}
              id="journey-title"
            >
              Tell one complete procurement story.
            </h2>
          </div>

          <p className={styles.sectionCopy}>
            Use this sequence for interviews and portfolio demonstrations.
            Each destination below was discovered from the routes that actually
            exist in this ProcureIQ build.
          </p>
        </div>

        <div className={styles.journey}>
          {journey.map((step) => (
            <article
              className={styles.journeyStep}
              key={step.number}
            >
              <span className={styles.journeyIndex}>
                {step.number}
              </span>

              <div className={styles.journeyBody}>
                <h3 className={styles.journeyTitle}>
                  {step.title}
                </h3>

                <p className={styles.journeyCopy}>
                  {step.description}
                </p>

                <Link
                  className={styles.journeyLink}
                  href={step.href}
                >
                  Open {step.routeTitle}
                  <span aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>


      <section
        aria-labelledby="modules-title"
        className={styles.section}
        id="modules"
      >
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>
              Real application surface
            </p>

            <h2
              className={styles.sectionTitle}
              id="modules-title"
            >
              Explore the platform.
            </h2>
          </div>

          <p className={styles.sectionCopy}>
            A curated subset of existing static ProcureIQ routes is shown here.
            The page does not invent showcase-only business modules.
          </p>
        </div>

        <div className={styles.moduleGrid}>
          {modules.map((module, index) => (
            <Link
              className={styles.moduleCard}
              href={module.href}
              key={module.href}
            >
              <span className={styles.moduleNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className={styles.moduleTitle}>
                {module.title}
              </span>

              <span className={styles.modulePath}>
                {module.href}
              </span>

              <span
                aria-hidden="true"
                className={styles.moduleArrow}
              >
                ↗
              </span>
            </Link>
          ))}
        </div>
      </section>


      <section
        aria-labelledby="architecture-title"
        className={styles.section}
      >
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>
              Architecture
            </p>

            <h2
              className={styles.sectionTitle}
              id="architecture-title"
            >
              A production-oriented full-stack structure.
            </h2>
          </div>

          <p className={styles.sectionCopy}>
            The portfolio story is intentionally simple: typed frontend,
            secured Java application boundary and PostgreSQL-backed domain
            integrity.
          </p>
        </div>

        <div className={styles.architecture}>
          {architecture.map((node, index) => (
            <div
              className={styles.architectureGroup}
              key={node.role}
            >
              <article className={styles.architectureNode}>
                <span className={styles.architectureRole}>
                  {node.role}
                </span>

                <strong className={styles.architectureTech}>
                  {node.tech}
                </strong>

                <p className={styles.architectureCopy}>
                  {node.copy}
                </p>
              </article>

              {index < architecture.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={styles.architectureArrow}
                >
                  ↓
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>


      <section
        aria-labelledby="capabilities-title"
        className={styles.section}
      >
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>
              Platform scope
            </p>

            <h2
              className={styles.sectionTitle}
              id="capabilities-title"
            >
              Six capabilities worth presenting.
            </h2>
          </div>

          <p className={styles.sectionCopy}>
            These groups make the project easier to explain than listing every
            individual implementation step.
          </p>
        </div>

        <div className={styles.capabilityGrid}>
          {capabilities.map((capability) => (
            <article
              className={styles.capabilityCard}
              key={capability.title}
            >
              <h3 className={styles.capabilityTitle}>
                {capability.title}
              </h3>

              <p className={styles.capabilityCopy}>
                {capability.copy}
              </p>
            </article>
          ))}
        </div>
      </section>


      <section className={styles.finalPanel}>
        <div>
          <p className={styles.kicker}>
            Final portfolio release
          </p>

          <h2 className={styles.finalTitle}>
            ProcureIQ is ready to showcase.
          </h2>

          <p className={styles.finalCopy}>
            Use the demo journey for a live walkthrough, then select the
            strongest operational and analytics screens for screenshots in
            your portfolio.
          </p>
        </div>

        <div className={styles.finalMeta}>
          <span className={styles.finalPill}>
            Spring Boot
          </span>

          <span className={styles.finalPill}>
            Next.js
          </span>

          <span className={styles.finalPill}>
            PostgreSQL
          </span>

          <span className={styles.finalPill}>
            JWT + RBAC
          </span>

          <span className={styles.finalPill}>
            501 tests
          </span>

          <span className={styles.finalPill}>
            V83
          </span>
        </div>
      </section>


      <footer className={styles.footer}>
        <span>
          ProcureIQ
        </span>

        <span>
          Enterprise Procurement Management Platform
        </span>
      </footer>
    </main>
  );
}
