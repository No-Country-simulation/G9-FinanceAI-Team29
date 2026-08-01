-- Categorías de gastos
INSERT INTO categorias (nombre, descripcion, icono, color) VALUES
('Alimentación', 'Gastos en comida, supermercado, restaurantes', 'utensils', '#FF6384'),
('Transporte', 'Gastos en transporte, gasolina, estacionamiento', 'car', '#36A2EB'),
('Salud', 'Gastos en salud, farmacia, consultas médicas', 'heart', '#FFCE56'),
('Vivienda', 'Gastos en vivienda, alquiler, hipoteca, servicios del hogar', 'home', '#4BC0C0'),
('Educación', 'Gastos en educación, cursos, libros, material', 'graduation-cap', '#9966FF'),
('Ocio', 'Gastos en entretenimiento, suscripciones, hobbies', 'film', '#FF9F40'),
('Servicios', 'Gastos en servicios básicos, internet, teléfono', 'wifi', '#C9CBCF'),
('Compras', 'Gastos en compras generales, tecnología, ropa', 'shopping-bag', '#7C8CF8'),
('Otros', 'Otros gastos no categorizados', 'more-horizontal', '#E7E9ED')
ON CONFLICT (nombre) DO NOTHING;

-- Los 100 usuarios y 4.500 transacciones se cargan desde los CSV
-- (resources/data/usuarios.csv y transacciones.csv) mediante DataLoader.
