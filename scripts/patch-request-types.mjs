import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/nexusdesk";
const c = new MongoClient(uri);
await c.connect();
const db = c.db();
const value = [
  {
    id: "rt-incident",
    name: "Incident",
    description: "Unplanned interruption or reduction in quality",
    ticketCode: "INC",
  },
  {
    id: "rt-request",
    name: "Request",
    description: "Formal request for something to be provided",
    ticketCode: "REQ",
  },
];
await db.collection("settings").updateOne({ key: "requestTypes" }, { $set: { value } }, { upsert: true });
const r = await db.collection("settings").findOne({ key: "requestTypes" });
console.log(JSON.stringify(r?.value, null, 2));
await c.close();
