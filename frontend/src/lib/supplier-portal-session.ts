const TOKEN_KEY =
  "procureiq_supplier_portal_token";

export function getSupplierPortalToken():
  | string
  | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return window.localStorage.getItem(
    TOKEN_KEY,
  );
}

export function setSupplierPortalToken(
  token: string,
): void {
  window.localStorage.setItem(
    TOKEN_KEY,
    token,
  );
}

export function clearSupplierPortalToken(): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.localStorage.removeItem(
    TOKEN_KEY,
  );
}
