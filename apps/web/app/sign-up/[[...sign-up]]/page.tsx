import { SignUp } from '@clerk/nextjs';
import { colors } from '@counter/tokens';

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <SignUp appearance={{ variables: { colorPrimary: colors.ink.hex } }} />
    </main>
  );
}
