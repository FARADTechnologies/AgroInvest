import { redirect } from "next/navigation";

// The map is the front door of the portal.
export default function Home() {
  redirect("/map");
}
