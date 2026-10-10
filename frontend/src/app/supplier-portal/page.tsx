import { redirect } from "next/navigation";

/**
 * /supplier-portal has no page of its own. Send suppliers to the portal home,
 * which sends signed-out suppliers on to the portal sign-in.
 */
export default function SupplierPortalIndexPage() {
  redirect("/supplier-portal/home");
}
