import LoginForm from "./LoginForm";
import { loginAction } from "./actions";

/**
 * ログインページ（Server Component）
 * Server Action は actions.ts に分離し、フォーム描画は LoginForm（Client Component）に委譲する
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <LoginForm action={loginAction} redirect={redirect} />;
}
