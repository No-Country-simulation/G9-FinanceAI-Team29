import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";
import FoxyJumpscare from "../../components/jumpscare/FoxyJumpscare"; // [JUMPSCARE]

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Registrarse | FinanceAI - FinSightAI"
        description="This is React.js SignIn Tables Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <FoxyJumpscare /> {/* [JUMPSCARE] */}
      <AuthLayout showSideBranding={false}>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
