import {
  ModulePlaceholder,
} from "@/components/shared/module-placeholder";

export default function ApprovalsPage() {
  return (
    <ModulePlaceholder
      eyebrow="Procurement governance"
      title="Approval center"
      description={
        "Give procurement teams one queue for controlled business approvals."
      }
      features={[
        "Configurable approval policies",
        "Approval inboxes",
        "Decision history",
        "Escalation and audit trail",
      ]}
    />
  );
}
