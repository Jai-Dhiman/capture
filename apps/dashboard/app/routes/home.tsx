import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const { results } = await context.cloudflare.env.DB.prepare("SELECT 1 as ok").all();
    return { dbOk: results.length > 0 };
  } catch (error) {
    return { dbOk: false, error: (error as Error).message };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <h1>DB {loaderData.dbOk ? "Connected" : "Error"}</h1>
      {loaderData.error && <p>{loaderData.error}</p>}
    </main>
  );
}
