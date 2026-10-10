"use client";

import { AlertTriangle, Ban, CheckCircle2, CircleAlert, Info, Undo2 } from "lucide-react";
import { useState } from "react";

import "@/components/supplier-portal/portal-rfqs.css";
import {
  declineSupplierPortalInvitation,
  reconsiderSupplierPortalInvitation,
} from "@/lib/supplier-portal-rfqs";
import { getSupplierPortalToken } from "@/lib/supplier-portal-session";
import type { PortalRfqDetail } from "@/types/supplier-portal-rfq";

interface InvitationResponseProps {
  detail: PortalRfqDetail;
  onUpdated: (detail: PortalRfqDetail) => void;
  onSessionExpired: () => void;
}

/**
 * Lets a supplier tell procurement it will not respond to an RFQ, and change its mind
 * while the RFQ is still open. Renders nothing when neither action applies.
 */
export function InvitationResponse({
  detail,
  onUpdated,
  onSessionExpired,
}: InvitationResponseProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"decline" | "reconsider" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const declined = detail.invitationStatus === "DECLINED";
  const canDecline = detail.open && detail.invitationStatus === "INVITED";
  const hasDraft = detail.quotation?.status === "DRAFT";

  async function run(kind: "decline" | "reconsider") {
    if (busy !== null) {
      return;
    }

    const token = getSupplierPortalToken();

    if (!token) {
      onSessionExpired();

      return;
    }

    setBusy(kind);
    setError(null);
    setNotice(null);
    setConfirming(false);

    try {
      const updated =
        kind === "decline"
          ? await declineSupplierPortalInvitation(token, detail.id)
          : await reconsiderSupplierPortalInvitation(token, detail.id);

      onUpdated(updated);

      if (kind === "reconsider") {
        setNotice("Your response is open again. You can prepare and submit a quotation.");
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to update your invitation.";

      if (/session/i.test(message)) {
        onSessionExpired();

        return;
      }

      setError(message);
    } finally {
      setBusy(null);
    }
  }

  const feedback = (
    <>
      {notice ? (
        <div className="portal-notice" role="status">
          <CheckCircle2 size={17} />

          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="portal-auth-error" role="alert">
          <CircleAlert size={17} />

          {error}
        </div>
      ) : null}
    </>
  );

  if (declined) {
    return (
      <>
        {feedback}

        <div className="portal-rfq-callout portal-rfq-callout--info" role="status">
          <Info size={17} />

          <div>
            <strong>You declined this invitation</strong>

            <p>
              {detail.open
                ? "Procurement has been told you will not respond. You can change your mind until the deadline."
                : "Procurement was told you would not respond to this RFQ."}
            </p>

            {detail.open ? (
              <div className="portal-rfq-actions portal-rfq-actions--start">
                <button
                  type="button"
                  className="button"
                  onClick={() => void run("reconsider")}
                  disabled={busy !== null}
                >
                  <Undo2 size={15} />
                  {busy === "reconsider" ? "Reopening..." : "Reconsider and respond"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  if (!canDecline) {
    return <>{feedback}</>;
  }

  return (
    <>
      {feedback}

      <section className="supplier-portal-panel">
        <div className="supplier-portal-panel-heading">
          <div>
            <span>Your invitation</span>

            <h2>Not able to quote?</h2>
          </div>
        </div>

        <p style={{ margin: "0 0 12px" }}>
          If you cannot or do not want to quote on this RFQ, tell procurement so they can plan
          around it. You can change your mind until the deadline.
        </p>

        {confirming ? (
          <div className="portal-rfq-callout portal-rfq-callout--warning" role="status">
            <AlertTriangle size={17} />

            <div>
              <strong>Decline this invitation?</strong>

              <p>
                Procurement will be told you will not respond.
                {hasDraft ? " Your saved draft stays private and is not sent." : ""} You can
                reconsider until the deadline.
              </p>

              <div className="portal-rfq-actions portal-rfq-actions--start">
                <button
                  type="button"
                  className="button"
                  onClick={() => void run("decline")}
                  disabled={busy !== null}
                >
                  <Ban size={15} />
                  {busy === "decline" ? "Declining..." : "Confirm decline"}
                </button>

                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setConfirming(false)}
                  disabled={busy !== null}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="portal-rfq-actions portal-rfq-actions--start">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setError(null);
                setNotice(null);
                setConfirming(true);
              }}
              disabled={busy !== null}
            >
              <Ban size={15} />
              Decline this invitation
            </button>
          </div>
        )}
      </section>
    </>
  );
}
