import { describe, expect, it } from "vitest";

import { hasAdminPermission } from "@/lib/admin";
import { formatDisplayName, truncateMiddle } from "@/lib/format";

describe("admin permissions", () => {
  it("allows finance scope to execute settlement actions but not user edits", () => {
    expect(hasAdminPermission("FINANCE_OPERATOR", "withdrawals:confirm")).toBe(true);
    expect(hasAdminPermission("FINANCE_OPERATOR", "users:edit")).toBe(false);
  });

  it("allows ops scope to review withdrawals but not create adjustments", () => {
    expect(hasAdminPermission("OPS_REVIEWER", "withdrawals:review")).toBe(true);
    expect(hasAdminPermission("OPS_REVIEWER", "adjustments:create")).toBe(false);
  });
});

describe("format helpers", () => {
  it("prefers full name and falls back to username or telegram id", () => {
    expect(formatDisplayName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
    expect(formatDisplayName({ username: "ada_dev" })).toBe("ada_dev");
    expect(formatDisplayName({ telegramUserId: "12345" })).toBe("12345");
  });

  it("truncates long hashes while preserving ends", () => {
    expect(truncateMiddle("1234567890abcdef", 4, 4)).toBe("1234...cdef");
  });
});
