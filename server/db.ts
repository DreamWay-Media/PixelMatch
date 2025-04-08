import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// Create a PostgreSQL connection pool using the provided environment variables
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a Drizzle ORM instance with the PostgreSQL connection pool
export const db = drizzle(pool);

// Export the pool to be used directly if needed
export { pool };