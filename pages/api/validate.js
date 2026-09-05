export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({ error: "This endpoint has been retired" });
}
