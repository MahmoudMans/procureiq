import {
  ModulePlaceholder,
} from "@/components/shared/module-placeholder";

export default function PurchaseRequestsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Procure-to-request"
      title="Purchase requests"
      description={
        "Capture purchasing demand before sourcing and approval."
      }
      features={[
        "Request creation and line items",
        "Cost centers and categories",
        "Budget context",
        "Approval routing",
      ]}
    />
  );
}
