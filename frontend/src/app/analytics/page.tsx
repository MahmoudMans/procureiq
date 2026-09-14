import {
  ModulePlaceholder,
} from "@/components/shared/module-placeholder";

export default function AnalyticsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Procurement intelligence"
      title="Spend & category analytics"
      description={
        "Transform procurement records into executive decision intelligence."
      }
      features={[
        "Spend by supplier and category",
        "Supplier concentration analysis",
        "Savings opportunities",
        "Delivery and risk trends",
      ]}
    />
  );
}
