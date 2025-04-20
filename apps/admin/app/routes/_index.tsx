import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader: LoaderFunction = () =>
  json({ status: "OK" });

export default function Index() {
  const data = useLoaderData<{ status: string }>();
  return (
    <>
      <h1>Hello</h1>
      <pre>{JSON.stringify(data)}</pre>
    </>
  );
}