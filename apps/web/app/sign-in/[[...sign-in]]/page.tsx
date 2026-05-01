import { SignIn } from '@clerk/nextjs';
import { colors } from '@counter/tokens';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <SignIn appearance={{ variables: { colorPrimary: colors.ink.hex } }} />
    </main>
  );
}
