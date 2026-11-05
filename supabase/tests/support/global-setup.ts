import { startPostgres } from "./postgres";

export default async function setup() {
  const pg = await startPostgres("pg-test", 54329);
  process.env.TEST_DATABASE_URL = pg.url;
  return async () => {
    await pg.stop();
  };
}
