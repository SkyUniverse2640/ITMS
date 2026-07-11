const m = require("mongoose");
const fs = require("fs");
const path = require("path");

const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const uri = (env.match(/MONGODB_URI=(.+)/) || [])[1]?.trim();
if (!uri) {
  console.error("MONGODB_URI not found");
  process.exit(1);
}

(async () => {
  await m.connect(uri);
  const s = m.connection.collection("settings");
  const catsDoc = await s.findOne({ key: "ticketCategories" });
  const grpsDoc = await s.findOne({ key: "ticketGroups" });
  const groups = (grpsDoc?.value || []).map((g) =>
    typeof g === "string" ? g : g.name
  );
  const defaultG = groups[0] || "Helpdesk & Support";

  const updated = (catsDoc?.value || []).map((c) => {
    if (c.group && String(c.group).trim()) return { ...c, group: String(c.group).trim() };
    const n = (c.name || "").toLowerCase();
    let group = defaultG;
    if (n.includes("network"))
      group = groups.find((g) => /network/i.test(g)) || defaultG;
    else if (n.includes("infra"))
      group = groups.find((g) => /infra/i.test(g)) || defaultG;
    else if (n.includes("app"))
      group = groups.find((g) => /app/i.test(g)) || defaultG;
    else if (n.includes("helpdesk") || n.includes("support") || n.includes("it "))
      group = groups.find((g) => /helpdesk|support/i.test(g)) || defaultG;
    return { ...c, group };
  });

  await s.updateOne(
    { key: "ticketCategories" },
    { $set: { value: updated } },
    { upsert: true }
  );
  console.log("MIGRATED categories:");
  console.log(JSON.stringify(updated, null, 2));
  await m.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
