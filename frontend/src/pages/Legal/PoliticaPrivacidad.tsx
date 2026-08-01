import LegalPageLayout from "./LegalPageLayout";

export default function PoliticaPrivacidad() {
  return (
    <LegalPageLayout
      title="Política de Privacidad"
      description="Cómo FinSightAI recopila, usa y protege tus datos."
      ultimaActualizacion="31 de julio de 2026"
    >
      <section>
        <h2>1. Introducción</h2>
        <p>En FinSightAI respetamos la privacidad de nuestros usuarios.</p>
        <p>
          Esta Política explica qué información recopilamos, cómo la
          utilizamos y cómo protegemos los datos.
        </p>
      </section>

      <section>
        <h2>2. Datos recopilados</h2>
        <p>Podemos recopilar:</p>
        <p>
          <strong>Datos de registro</strong>
        </p>
        <ul>
          <li>correo electrónico;</li>
          <li>identificador de usuario.</li>
        </ul>
        <p>
          <strong>Datos financieros</strong>
        </p>
        <p>
          El usuario puede cargar información mediante archivos CSV,
          incluyendo:
        </p>
        <ul>
          <li>ingresos;</li>
          <li>gastos;</li>
          <li>categorías;</li>
          <li>fechas;</li>
          <li>montos;</li>
          <li>transacciones.</li>
        </ul>
      </section>

      <section>
        <h2>3. Finalidad del tratamiento</h2>
        <p>La información recopilada se utiliza para:</p>
        <ul>
          <li>generar análisis financieros;</li>
          <li>mostrar estadísticas;</li>
          <li>elaborar gráficos;</li>
          <li>generar recomendaciones mediante inteligencia artificial;</li>
          <li>mejorar la experiencia del usuario.</li>
        </ul>
      </section>

      <section>
        <h2>4. Inteligencia Artificial</h2>
        <p>
          Al utilizar el asistente financiero, determinadas consultas podrán
          ser procesadas mediante servicios de inteligencia artificial.
        </p>
        <p>
          La información enviada se utiliza exclusivamente para generar
          respuestas dentro de FinSightAI.
        </p>
      </section>

      <section>
        <h2>5. Almacenamiento</h2>
        <p>
          Los datos son almacenados únicamente para permitir el
          funcionamiento de la plataforma.
        </p>
        <p>No comercializamos información personal.</p>
      </section>

      <section>
        <h2>6. Compartición de información</h2>
        <p>FinSightAI no vende ni comercializa información personal.</p>
        <p>
          Los datos podrán ser tratados únicamente por los servicios
          tecnológicos necesarios para el funcionamiento de la plataforma,
          como:
        </p>
        <ul>
          <li>Supabase (autenticación);</li>
          <li>servicios de inteligencia artificial;</li>
          <li>infraestructura utilizada durante el desarrollo.</li>
        </ul>
      </section>

      <section>
        <h2>7. Seguridad</h2>
        <p>
          Se implementan medidas razonables para proteger la información
          almacenada.
        </p>
        <p>Sin embargo, ningún sistema puede garantizar seguridad absoluta.</p>
      </section>

      <section>
        <h2>8. Conservación de datos</h2>
        <p>
          La información permanecerá almacenada mientras la cuenta
          permanezca activa o hasta que el usuario solicite su eliminación.
        </p>
      </section>

      <section>
        <h2>9. Derechos del usuario</h2>
        <p>El usuario podrá solicitar:</p>
        <ul>
          <li>acceso a sus datos;</li>
          <li>actualización de información;</li>
          <li>eliminación de su cuenta;</li>
          <li>eliminación de sus datos personales.</li>
        </ul>
      </section>

      <section>
        <h2>10. Cookies</h2>
        <p>
          La plataforma puede utilizar almacenamiento local del navegador y
          cookies técnicas para mantener la sesión iniciada y mejorar la
          experiencia del usuario.
        </p>
        <p>No se utilizan cookies con fines publicitarios.</p>
      </section>

      <section>
        <h2>11. Menores de edad</h2>
        <p>FinSightAI no está dirigido específicamente a menores de edad.</p>
      </section>

      <section>
        <h2>12. Cambios en esta política</h2>
        <p>
          La presente política podrá actualizarse para reflejar mejoras del
          proyecto o cambios tecnológicos.
        </p>
      </section>

      <section>
        <h2>13. Contacto</h2>
        <ul>
          <li>TwentyNineDevs</li>
          <li>Grupo 9 – Team29</li>
          <li>Hackathon ONE Next Education</li>
          <li>Oracle · Alura · No Country</li>
        </ul>
      </section>
    </LegalPageLayout>
  );
}
