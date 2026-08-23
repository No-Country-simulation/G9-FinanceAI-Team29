import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import ConfirmarCuentaForm from "../../components/auth/ConfirmarCuentaForm";

export default function ConfirmarCuenta() {
  return (
    <>
      <PageMeta
        title="Confirmar cuenta | FinanceAI - FinSightAI"
        description="Confirmá tu cuenta de FinSightAI para poder iniciar sesión"
      />
      <AuthLayout showSideBranding={false}>
        <ConfirmarCuentaForm />
      </AuthLayout>
    </>
  );
}
