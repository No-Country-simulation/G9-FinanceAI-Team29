import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Crear Cuenta | FinSightAI"
        description="Creá tu cuenta en FinSightAI y empezá a organizar tus finanzas."
      />
      <AuthLayout showSideBranding={false}>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
