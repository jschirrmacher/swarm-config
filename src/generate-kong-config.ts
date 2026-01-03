import "dotenv/config"
import { generateKongConfig } from "../server/utils/kongConfig.js"

await generateKongConfig()
