import { Redirect } from "expo-router";

// Launch into the branded PulaCash splash, which then routes to welcome.
export default function Index() {
  return <Redirect href="/splash" />;
}
