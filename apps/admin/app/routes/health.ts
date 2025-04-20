import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader: LoaderFunction = () => {
  return json({ status: "OK" });
};

// No UI needed for health check
export default function Health() {
  return null;
}
