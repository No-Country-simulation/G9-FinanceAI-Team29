import { PerfilUsuario } from '../../types/finance';

interface ProfileCardProps {
  perfil: PerfilUsuario | null;
  loading: boolean;
}

export default function ProfileCard({ perfil, loading }: ProfileCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const getPerfilColor = (perfil: string) => {
    switch (perfil) {
      case 'Saludable': return 'text-success-600 bg-success-50 dark:bg-success-500/10';
      case 'En observación': return 'text-warning-600 bg-warning-50 dark:bg-warning-500/10';
      case 'En riesgo': return 'text-error-600 bg-error-50 dark:bg-error-500/10';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-500/10';
    }
  };

  const ingreso = perfil?.ingresoMensual ?? 0;
  const ahorro = perfil?.ahorroEstimado ?? 0;
  const ratioAhorro = ingreso > 0 ? Math.max(0, Math.min(100, (ahorro / ingreso) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Perfil Financiero
      </h3>

      <div className="mb-4">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPerfilColor(perfil?.perfilFinanciero || '')}`}>
          {perfil?.perfilFinanciero || 'Sin clasificar'}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">ID Usuario</span>
          <span className="font-medium text-gray-800 dark:text-white/90">{perfil?.usuarioId}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">Ingreso Mensual</span>
          <span className="font-medium text-gray-800 dark:text-white/90">
            ${perfil?.ingresoMensual?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">Nivel Endeudamiento</span>
          <span className={`font-medium ${(perfil?.nivelEndeudamiento ?? 0) > 30 ? 'text-error-600' : 'text-success-600'}`}>
            {perfil?.nivelEndeudamiento ?? 0}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">Frecuencia Ahorro</span>
          <span className="font-medium text-gray-800 dark:text-white/90">{perfil?.frecuenciaAhorro}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">Ahorro Estimado</span>
          <span className="font-medium text-success-600">
            ${perfil?.ahorroEstimado?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex-1 flex flex-col justify-end">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span>Ahorro sobre ingreso</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{ratioAhorro.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full dark:bg-gray-700">
          <div
            className="h-2 rounded-full bg-brand-500"
            style={{ width: `${ratioAhorro}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
