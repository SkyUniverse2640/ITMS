/**
 * Self-check for the `_id` alias serializer.
 *
 * Run: npm test
 *
 * The blocklist is the part worth guarding: adding a Json column to
 * schema.prisma without listing it in JSON_FIELDS would silently rewrite
 * admin-supplied data that happens to use `id` for its own purposes.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { serialize } from "./serialize.ts";

test("adds _id alongside id", () => {
  assert.deepEqual(serialize({ id: "u1", displayName: "Ada" }), {
    id: "u1",
    _id: "u1",
    displayName: "Ada",
  });
});

test("aliases ids on nested relations and arrays", () => {
  assert.deepEqual(
    serialize({
      id: "t1",
      requester: { id: "u1", displayName: "Ada" },
      comments: [{ id: "c1" }, { id: "c2" }],
    }),
    {
      id: "t1",
      _id: "t1",
      requester: { id: "u1", _id: "u1", displayName: "Ada" },
      comments: [
        { id: "c1", _id: "c1" },
        { id: "c2", _id: "c2" },
      ],
    }
  );
});

test("converts Date to ISO string", () => {
  assert.deepEqual(serialize({ createdAt: new Date("2026-09-06T01:02:03.000Z") }), {
    createdAt: "2026-09-06T01:02:03.000Z",
  });
});

test("leaves Json column contents untouched", () => {
  // settings.value for `assetTypes` legitimately contains its own `id` keys.
  assert.deepEqual(
    serialize({ id: "s1", key: "assetTypes", value: [{ id: "at-laptop", name: "Laptop" }] }),
    {
      id: "s1",
      _id: "s1",
      key: "assetTypes",
      value: [{ id: "at-laptop", name: "Laptop" }],
    }
  );
});

test("leaves audit before/after snapshots untouched", () => {
  assert.deepEqual(
    serialize({
      id: "a1",
      before: { id: "arbitrary", status: "Open" },
      after: { id: "arbitrary", status: "Closed" },
    }),
    {
      id: "a1",
      _id: "a1",
      before: { id: "arbitrary", status: "Open" },
      after: { id: "arbitrary", status: "Closed" },
    }
  );
});

test("does not overwrite an existing _id", () => {
  assert.deepEqual(serialize({ id: "new", _id: "kept" }), { id: "new", _id: "kept" });
});

test("passes through null and primitives", () => {
  assert.equal(serialize(null), null);
  assert.deepEqual(serialize([1, "a", null]), [1, "a", null]);
});
