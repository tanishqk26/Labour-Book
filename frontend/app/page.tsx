import { redirect } from "next/navigation";

/**
 * Root page — redirects to the main dashboard.
 * The dashboard is the app's home screen for authenticated users.
 */
export default function RootPage() {
  redirect("/dashboard");
}
