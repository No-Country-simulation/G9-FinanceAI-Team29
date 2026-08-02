import { evaluarReglas } from '../components/auth/PasswordStrengthMeter';

const NIVELES = [
  { texto: 'Muy débil', color: '#f04438' },
  { texto: 'Débil', color: '#f04438' },
  { texto: 'Media', color: '#f79009' },
  { texto: 'Fuerte', color: '#12b76a' },
  { texto: 'Muy fuerte', color: '#12b76a' },
];

export function crearHtmlFuerzaPassword(idContenedor: string): string {
  return `<div id="${idContenedor}" style="margin-top:8px;"></div>`;
}

export function actualizarFuerzaPassword(idContenedor: string, password: string): void {
  const contenedor = document.getElementById(idContenedor);
  if (!contenedor) return;

  if (!password) {
    contenedor.innerHTML = '';
    return;
  }

  const reglas = evaluarReglas(password);
  const cumplidas = reglas.filter((r) => r.cumple).length;
  const nivel = NIVELES[Math.min(cumplidas, NIVELES.length - 1)];

  const barras = reglas
    .map((_, index) => `
      <span style="
        height:6px;
        flex:1;
        border-radius:9999px;
        background:${index < cumplidas ? nivel.color : '#e4e7ec'};
      "></span>
    `)
    .join('');

  const items = reglas
    .map((regla) => `
      <li style="
        display:flex;
        align-items:center;
        gap:6px;
        color:${regla.cumple ? '#12b76a' : '#98a2b3'};
      ">
        <span>${regla.cumple ? '✓' : '✕'}</span>
        <span>${regla.etiqueta}</span>
      </li>
    `)
    .join('');

  contenedor.innerHTML = `
    <div style="display:flex; gap:4px;">${barras}</div>
    <p style="margin:6px 0 4px; font-size:12px; font-weight:600; color:${nivel.color};">
      Seguridad: ${nivel.texto}
    </p>
    <ul style="
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:4px;
      list-style:none;
      padding:0;
      margin:0;
      font-size:11px;
      text-align:left;
    ">
      ${items}
    </ul>
  `;
}

export function crearHtmlCoincidenciaPassword(idMensaje: string): string {
  return `<p id="${idMensaje}" style="margin-top:6px; font-size:12px; text-align:left;"></p>`;
}

export function actualizarCoincidenciaPassword(idMensaje: string, nueva: string, confirmar: string): void {
  const mensaje = document.getElementById(idMensaje);
  if (!mensaje) return;

  if (!confirmar) {
    mensaje.innerHTML = '';
    return;
  }

  const coinciden = nueva === confirmar;
  mensaje.style.color = coinciden ? '#12b76a' : '#f04438';
  mensaje.textContent = coinciden ? '✓ Las contraseñas coinciden' : '✕ Las contraseñas no coinciden';
}
