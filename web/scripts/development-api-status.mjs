import { captureDevelopmentApiBaseline } from "./development-api-lifecycle.mjs";

const port = Number(process.env.PORT || 3001);
const status = await captureDevelopmentApiBaseline({ port });
console.log(JSON.stringify(status, null, 2));

if (status.listening && !status.compatible) process.exitCode = 2;
