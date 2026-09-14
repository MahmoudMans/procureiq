import {
  ModulePlaceholder,
} from "@/components/shared/module-placeholder";

export default function RfqsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Strategic sourcing"
      title="RFQs & sourcing events"
      description={
        "Create competitive sourcing events and compare supplier responses."
      }
      features={[
        "RFQ lifecycle and deadlines",
        "Invited supplier management",
        "Quotation collection",
        "Commercial and weighted comparisons",
      ]}
    />
  );
}
