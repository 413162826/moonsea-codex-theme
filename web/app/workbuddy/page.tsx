import { redirect } from "next/navigation";

export default function WorkbuddyPage() {
  redirect("/themes?client=workbuddy");
}
