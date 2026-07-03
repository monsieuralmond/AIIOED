import { nodeJsonRoute } from "../src/server/research/http";
import { createResearchApiHandlers } from "../src/server/research/handlers";

export default nodeJsonRoute(createResearchApiHandlers().chat);
