import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Registrarse | FinSightAI"
        description="Iniciá sesión en FinSightAI y tomá el control de tu salud financiera."
      />
      <AuthLayout showSideBranding={false}>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
