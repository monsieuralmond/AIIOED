import { nodeJsonRoute } from "../../src/server/research/http.js";
import { createResearchApiHandlers } from "../../src/server/research/handlers.js";

export default nodeJsonRoute(createResearchApiHandlers().updateStage);
