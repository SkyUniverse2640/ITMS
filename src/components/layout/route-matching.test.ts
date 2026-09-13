import assert from "node:assert/strict";
import test from "node:test";
import { isRouteActive } from "./route-matching.ts";

test("matches only complete route segments", () => {
  assert.equal(isRouteActive("/", "/"), true);
  assert.equal(isRouteActive("/tickets/123", "/tickets"), true);
  assert.equal(isRouteActive("/tickets-archive", "/tickets"), false);
  assert.equal(isRouteActive("/preferences", "/"), false);
});
