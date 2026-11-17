import { downtimeSetup } from "@a-novel-kit/nodelib-test/playwright";

/** Publishes each state's downtime document, as the infra repository serves the real one. */
export default downtimeSetup();
