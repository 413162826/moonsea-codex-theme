import { redirect } from "next/navigation";

type ThemePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ThemePage({ params }: ThemePageProps) {
  const { id } = await params;
  redirect(`/themes/${encodeURIComponent(id)}?client=workbuddy`);
}
