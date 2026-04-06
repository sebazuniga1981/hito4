const { Pool } = require("pg");
const bcrypt = require("bcrypt");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  allowExitOnIdle: true
});

const getNow = async () => {
  const result = await pool.query("SELECT NOW()");
  return result.rows[0];
};

const initializeDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) UNIQUE NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS servicios (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descripcion TEXT NOT NULL,
      precio NUMERIC(10, 2) NOT NULL,
      modalidad VARCHAR(60) NOT NULL,
      duracion VARCHAR(60),
      imagen TEXT,
      estado VARCHAR(20) NOT NULL DEFAULT 'activo',
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL
    )
  `);

  // Migracion de datos heredados desde la tabla antigua "publicaciones".
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.publicaciones') IS NOT NULL THEN
        INSERT INTO servicios (
          id, titulo, descripcion, precio, modalidad, duracion, imagen, estado, usuario_id, categoria_id
        )
        SELECT
          p.id, p.titulo, p.descripcion, p.precio, p.modalidad, p.duracion, p.imagen, p.estado, p.usuario_id, p.categoria_id
        FROM publicaciones p
        ON CONFLICT (id) DO NOTHING;
      END IF;
    END $$;
  `);

  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('servicios', 'id'),
      COALESCE((SELECT MAX(id) FROM servicios), 1)
    )
  `);

  const adminEmail = process.env.ADMIN_EMAIL || "admin@correo.cl";
  const adminPassword = process.env.ADMIN_PASSWORD || "1234";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  await pool.query(
    `
      INSERT INTO usuarios (email, password)
      VALUES ($1, $2)
      ON CONFLICT (email) DO UPDATE
      SET password = EXCLUDED.password
    `,
    [adminEmail, adminPasswordHash]
  );

  await pool.query(`
    INSERT INTO categorias (nombre)
    VALUES
      ('Ansiedad'),
      ('Depresion'),
      ('Terapia de pareja'),
      ('Terapia adolescente')
    ON CONFLICT (nombre) DO NOTHING
  `);
};

const getUsuarioByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM usuarios WHERE email = $1", [email]);
  return result.rows[0];
};

const crearUsuario = async (email, password) => {
  const result = await pool.query(
    "INSERT INTO usuarios (email, password) VALUES ($1, $2) RETURNING *",
    [email, password]
  );
  return result.rows[0];
};

const getServicios = async () => {
  const consulta = `
    SELECT s.*, c.nombre AS categoria
    FROM servicios s
    LEFT JOIN categorias c ON s.categoria_id = c.id
    ORDER BY s.id DESC
  `;
  const result = await pool.query(consulta);
  return result.rows;
};

const getServicioById = async (id) => {
  const consulta = `
    SELECT s.*, c.nombre AS categoria
    FROM servicios s
    LEFT JOIN categorias c ON s.categoria_id = c.id
    WHERE s.id = $1
  `;
  const result = await pool.query(consulta, [id]);
  return result.rows[0];
};

const crearServicio = async ({
  titulo,
  descripcion,
  precio,
  modalidad,
  duracion,
  imagen,
  usuario_id,
  categoria_id
}) => {
  const consulta = `
    INSERT INTO servicios
    (titulo, descripcion, precio, modalidad, duracion, imagen, usuario_id, categoria_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [titulo, descripcion, precio, modalidad, duracion, imagen, usuario_id, categoria_id];
  const result = await pool.query(consulta, values);
  return result.rows[0];
};

const actualizarServicio = async (
  id,
  { titulo, descripcion, precio, modalidad, duracion, imagen, estado, categoria_id }
) => {
  const consulta = `
    UPDATE servicios
    SET titulo = $1,
        descripcion = $2,
        precio = $3,
        modalidad = $4,
        duracion = $5,
        imagen = $6,
        estado = $7,
        categoria_id = $8
    WHERE id = $9
    RETURNING *
  `;
  const values = [titulo, descripcion, precio, modalidad, duracion, imagen, estado, categoria_id, id];
  const result = await pool.query(consulta, values);
  return result.rows[0];
};

const eliminarServicio = async (id) => {
  const result = await pool.query("DELETE FROM servicios WHERE id = $1 RETURNING *", [id]);
  return result.rows[0];
};

module.exports = {
  pool,
  getNow,
  initializeDatabase,
  getUsuarioByEmail,
  crearUsuario,
  getServicios,
  getServicioById,
  crearServicio,
  actualizarServicio,
  eliminarServicio
};
