import { createInterface } from "node:readline";
import { createAiRuntimeDispatcher } from "./dispatcher.js";

interface UtilityParentPort {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { readonly data: unknown }) => void): void;
}

interface UtilityProcess extends NodeJS.Process {
  readonly parentPort?: UtilityParentPort;
}

const auth = process.env.BUBU_RPC_TOKEN;
if (!auth || auth.length < 32) {
  console.error("BUBU_RPC_TOKEN must be set by the Electron supervisor");
  process.exitCode = 78;
} else {
  const dispatcher = createAiRuntimeDispatcher(auth);
  const parentPort = (process as UtilityProcess).parentPort;
  if (parentPort) {
    parentPort.on("message", (event) => {
      void dispatcher.dispatch(event.data).then((response) => parentPort.postMessage(response));
    });
  } else {
    const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    lines.on("line", (line) => {
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        value = undefined;
      }
      void dispatcher.dispatch(value).then((response) => {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      });
    });
  }
}
