export type PortalRfqUpdateKind =
  | "AWARDED_TO_YOU"
  | "DECISION_MADE"
  | "RFQ_CLOSED"
  | "RFQ_CANCELLED";

export interface PortalRfqUpdate {
  rfqId: string;
  rfqNumber: string;
  title: string;
  kind: PortalRfqUpdateKind;
  headline: string;
  message: string;
  occurredAt: string;
}
