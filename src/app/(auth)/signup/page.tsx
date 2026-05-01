import SignupForm from "./SignupForm";
import { signupAction } from "./actions";

/**
 * サインアップページ（Server Component）
 * Server Action は actions.ts に分離し、フォーム描画は SignupForm（Client Component）に委譲する
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <SignupForm action={signupAction} redirect={redirect} />;
}
