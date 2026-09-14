import {
  ArrowRight,
  Construction,
} from "lucide-react";

interface ModulePlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
}

export function ModulePlaceholder({
  eyebrow,
  title,
  description,
  features,
}: ModulePlaceholderProps) {

  return (
    <div className="page-stack">

      <section className="page-heading">

        <div>
          <span className="eyebrow">
            {eyebrow}
          </span>

          <h1>{title}</h1>

          <p>
            {description}
          </p>
        </div>

      </section>

      <section className="module-placeholder">

        <div className="module-placeholder__icon">
          <Construction size={28} />
        </div>

        <div>

          <span className="eyebrow">
            ProcureIQ roadmap
          </span>

          <h2>
            Module foundation reserved
          </h2>

          <p>
            This procurement capability is part of the
            ProcureIQ platform roadmap and will be
            implemented as a complete end-to-end
            workflow in the next development stages.
          </p>

        </div>

        <div className="module-placeholder__features">

          {features.map((feature) => (
            <div key={feature}>
              <ArrowRight size={16} />
              <span>{feature}</span>
            </div>
          ))}

        </div>

      </section>

    </div>
  );
}
