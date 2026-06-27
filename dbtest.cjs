const { Client } = require("pg");

const variants = [
  { label: "postgres / john.99 / postgres", user: "postgres", password: "john.99", database: "postgres" },
  { label: "postgres / 'john.99'(quoted literal) / postgres", user: "postgres", password: "'john.99'", database: "postgres" },
  { label: "john / john.99 / postgres", user: "john", password: "john.99", database: "postgres" },
];

(async () => {
  for (const v of variants) {
    const c = new Client({
      host: "192.168.1.12",
      port: 5432,
      user: v.user,
      password: v.password,
      database: v.database,
      connectionTimeoutMillis: 6000,
    });
    try {
      await c.connect();
      const r = await c.query("SELECT count(*)::int AS n FROM public.asteroides");
      console.log("OK   |", v.label, "| asteroides =", r.rows[0].n);
      await c.end();
    } catch (e) {
      console.log("FAIL |", v.label, "|", e.message);
      try { await c.end(); } catch {}
    }
  }
})();
