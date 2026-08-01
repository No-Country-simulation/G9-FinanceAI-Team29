import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";

export default function ResetPassword() {
  return (
    <>
      <PageMeta
        title="Restablecer contraseña | FinanceAI - FinSightAI"
        description="Define una nueva contraseña para tu cuenta de FinSightAI"
      />
      <AuthLayout showSideBranding={false}>
        <ResetPasswordForm />
      </AuthLayout>
    </>
  );
}
