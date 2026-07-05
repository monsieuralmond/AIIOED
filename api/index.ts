import { createVercelApiJsonHandler } from "../src/server/vercel-api-router.js";
import { nodeJsonRoute } from "../src/server/research/http.js";

export default nodeJsonRoute(createVercelApiJsonHandler());
