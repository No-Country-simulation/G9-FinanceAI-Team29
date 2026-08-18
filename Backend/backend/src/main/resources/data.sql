-- Categorías usadas por el dataset sintético v16.
-- Deben coincidir exactamente con la columna "categoria" de transacciones.csv.
INSERT INTO categorias (nombre, descripcion, icono, color) VALUES
('Alimentación', 'Gastos en comida, supermercado y gastronomía', 'utensils', '#FF6384'),
('Transporte', 'Gastos en movilidad, combustible y estacionamiento', 'car', '#36A2EB'),
('Salud', 'Gastos en salud, farmacia y atención médica', 'heart', '#FFCE56'),
('Vivienda', 'Gastos de vivienda, alquiler y mantenimiento del hogar', 'home', '#4BC0C0'),
('Educación', 'Gastos educativos, cursos y materiales', 'graduation-cap', '#9966FF'),
('Entretenimiento', 'Gastos de ocio, suscripciones y actividades recreativas', 'film', '#FF9F40'),
('Servicios', 'Servicios básicos, internet, telefonía y similares', 'wifi', '#C9CBCF'),
('Compras', 'Compras generales, tecnología, indumentaria y productos', 'shopping-bag', '#7C8CF8'),
('Deudas', 'Pagos de préstamos, créditos, tarjetas e intereses', 'credit-card', '#E57373'),
('Impuestos', 'Impuestos, tasas y obligaciones fiscales', 'file-text', '#A1887F'),
('Otros', 'Otros gastos no categorizados', 'more-horizontal', '#E7E9ED'),
('Salario', 'Ingresos provenientes de salario o haberes', 'briefcase', '#66BB6A'),
('Transferencia recibida', 'Ingresos recibidos mediante transferencias', 'arrow-down-circle', '#26A69A'),
('Reintegro', 'Reintegros, devoluciones y reembolsos', 'rotate-ccw', '#42A5F5'),
('Venta', 'Ingresos provenientes de ventas', 'tag', '#AB47BC'),
('Otros ingresos', 'Otros ingresos extraordinarios o adicionales', 'plus-circle', '#8BC34A')
ON CONFLICT (nombre) DO NOTHING;

-- Los usuarios y transacciones se cargan desde los CSV v16
-- (resources/data/usuarios.csv y transacciones.csv) mediante DataLoader.
