const { Pool } = require("pg");
const bcrypt = require("bcrypt");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  allowExitOnIdle: true,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
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
      password VARCHAR(255) NOT NULL,
      rol VARCHAR(20) NOT NULL DEFAULT 'paciente'
    )
  `);

  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'paciente'");
  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre VARCHAR(120)");
  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS apellido VARCHAR(120)");
  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS edad INTEGER");
  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sexo VARCHAR(30)");
  await pool.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(40)");

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservas (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      paciente VARCHAR(255) NOT NULL,
      fecha DATE NOT NULL,
      hora VARCHAR(5) NOT NULL,
      modalidad VARCHAR(50),
      tipo_sesion VARCHAR(120),
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bloqueos (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL,
      hora VARCHAR(5) NOT NULL,
      motivo VARCHAR(255),
      creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(fecha, hora)
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
      INSERT INTO usuarios (email, password, rol)
      VALUES ($1, $2, 'admin')
      ON CONFLICT (email) DO UPDATE
      SET rol = 'admin'
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
  const result = await pool.query(
    "SELECT id, email, password, rol, nombre, apellido, edad, sexo, telefono FROM usuarios WHERE email = $1",
    [email]
  );
  return result.rows[0];
};

const crearUsuario = async (email, password) => {
  const result = await pool.query(
    "INSERT INTO usuarios (email, password, rol) VALUES ($1, $2, 'paciente') RETURNING id, email, rol",
    [email, password]
  );
  return result.rows[0];
};

const getUsuarioById = async (id) => {
  const result = await pool.query(
    `
      SELECT id, email, rol, nombre, apellido, edad, sexo, telefono
      FROM usuarios
      WHERE id = $1
    `,
    [id]
  );
  return result.rows[0];
};

const actualizarPerfilUsuario = async (id, { email, nombre, apellido, edad, sexo, telefono }) => {
  const result = await pool.query(
    `
      UPDATE usuarios
      SET email = $1,
          nombre = $2,
          apellido = $3,
          edad = $4,
          sexo = $5,
          telefono = $6
      WHERE id = $7
      RETURNING id, email, rol, nombre, apellido, edad, sexo, telefono
    `,
    [email || null, nombre || null, apellido || null, edad || null, sexo || null, telefono || null, id]
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

const getReservasByUsuarioId = async (usuarioId) => {
  const result = await pool.query(
    `
      SELECT id, usuario_id, paciente, fecha::text AS fecha, hora, modalidad, tipo_sesion AS "tipoSesion", estado
      FROM reservas
      WHERE usuario_id = $1
      ORDER BY fecha, hora
    `,
    [usuarioId]
  );
  return result.rows;
};

const getHorariosNoDisponiblesPorFecha = async (fecha) => {
  const result = await pool.query(
    `
      SELECT hora
      FROM reservas
      WHERE fecha = $1
        AND estado IN ('pendiente', 'confirmada')
      UNION
      SELECT hora
      FROM bloqueos
      WHERE fecha = $1
      ORDER BY hora
    `,
    [fecha]
  );

  return result.rows.map((row) => row.hora);
};

const asegurarSlotDisponible = async ({ fecha, hora, reservaExcluidaId = null }) => {
  const params = [fecha, hora];
  let queryReserva = `
    SELECT 1
    FROM reservas
    WHERE fecha = $1
      AND hora = $2
      AND estado IN ('pendiente', 'confirmada')
  `;

  if (reservaExcluidaId) {
    params.push(reservaExcluidaId);
    queryReserva += " AND id <> $3";
  }

  const [reservaActiva, bloqueo] = await Promise.all([
    pool.query(queryReserva, params),
    pool.query("SELECT 1 FROM bloqueos WHERE fecha = $1 AND hora = $2", [fecha, hora])
  ]);

  if (reservaActiva.rowCount > 0 || bloqueo.rowCount > 0) {
    const err = new Error("Horario no disponible");
    err.code = "SLOT_NOT_AVAILABLE";
    throw err;
  }
};

const crearReserva = async ({ usuario_id, paciente, fecha, hora, modalidad, tipoSesion }) => {
  await asegurarSlotDisponible({ fecha, hora });

  const result = await pool.query(
    `
      INSERT INTO reservas (usuario_id, paciente, fecha, hora, modalidad, tipo_sesion, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
      RETURNING id, usuario_id, paciente, fecha::text AS fecha, hora, modalidad, tipo_sesion AS "tipoSesion", estado
    `,
    [usuario_id, paciente, fecha, hora, modalidad, tipoSesion]
  );

  return result.rows[0];
};

const cancelarReservaByPaciente = async (reservaId, usuarioId) => {
  const result = await pool.query(
    `
      UPDATE reservas
      SET estado = 'cancelada'
      WHERE id = $1
        AND usuario_id = $2
        AND estado IN ('pendiente', 'confirmada')
      RETURNING id, usuario_id, paciente, fecha::text AS fecha, hora, modalidad, tipo_sesion AS "tipoSesion", estado
    `,
    [reservaId, usuarioId]
  );

  return result.rows[0];
};

const reprogramarReservaByPaciente = async (reservaId, usuarioId, fecha, hora) => {
  await asegurarSlotDisponible({ fecha, hora, reservaExcluidaId: reservaId });

  const result = await pool.query(
    `
      UPDATE reservas
      SET fecha = $1,
          hora = $2,
          estado = 'pendiente'
      WHERE id = $3
        AND usuario_id = $4
        AND estado IN ('pendiente', 'confirmada')
      RETURNING id, usuario_id, paciente, fecha::text AS fecha, hora, modalidad, tipo_sesion AS "tipoSesion", estado
    `,
    [fecha, hora, reservaId, usuarioId]
  );

  return result.rows[0];
};

const getReservasAdminByWeek = async (weekStart, weekEnd) => {
  const result = await pool.query(
    `
      SELECT id, usuario_id, paciente, fecha::text AS fecha, hora, modalidad, tipo_sesion AS "tipoSesion", estado
      FROM reservas
      WHERE fecha BETWEEN $1 AND $2
      ORDER BY fecha, hora
    `,
    [weekStart, weekEnd]
  );
  return result.rows;
};

const actualizarEstadoReserva = async (id, estado) => {
  const result = await pool.query(
    `
      UPDATE reservas
      SET estado = $1
      WHERE id = $2
      RETURNING id, usuario_id, paciente, fecha::text AS fecha, hora, modalidad, tipo_sesion AS "tipoSesion", estado
    `,
    [estado, id]
  );
  return result.rows[0];
};

const moverReserva = async (id, fecha, hora) => {
  await asegurarSlotDisponible({ fecha, hora, reservaExcluidaId: id });

  const result = await pool.query(
    `
      UPDATE reservas
      SET fecha = $1,
          hora = $2
      WHERE id = $3
      RETURNING id, usuario_id, paciente, fecha::text AS fecha, hora, modalidad, tipo_sesion AS "tipoSesion", estado
    `,
    [fecha, hora, id]
  );
  return result.rows[0];
};

const getBloqueosByWeek = async (weekStart, weekEnd) => {
  const result = await pool.query(
    `
      SELECT id, fecha::text AS fecha, hora, motivo
      FROM bloqueos
      WHERE fecha BETWEEN $1 AND $2
      ORDER BY fecha, hora
    `,
    [weekStart, weekEnd]
  );
  return result.rows;
};

const crearBloqueo = async ({ fecha, hora, motivo, creado_por }) => {
  await asegurarSlotDisponible({ fecha, hora });

  const result = await pool.query(
    `
      INSERT INTO bloqueos (fecha, hora, motivo, creado_por)
      VALUES ($1, $2, $3, $4)
      RETURNING id, fecha::text AS fecha, hora, motivo
    `,
    [fecha, hora, motivo || "Bloqueo manual", creado_por]
  );
  return result.rows[0];
};

const eliminarBloqueo = async (id) => {
  const result = await pool.query(
    "DELETE FROM bloqueos WHERE id = $1 RETURNING id, fecha::text AS fecha, hora, motivo",
    [id]
  );
  return result.rows[0];
};

module.exports = {
  pool,
  getNow,
  initializeDatabase,
  getUsuarioByEmail,
  getUsuarioById,
  actualizarPerfilUsuario,
  crearUsuario,
  getServicios,
  getServicioById,
  crearServicio,
  actualizarServicio,
  eliminarServicio,
  getReservasByUsuarioId,
  getHorariosNoDisponiblesPorFecha,
  crearReserva,
  cancelarReservaByPaciente,
  reprogramarReservaByPaciente,
  getReservasAdminByWeek,
  actualizarEstadoReserva,
  moverReserva,
  getBloqueosByWeek,
  crearBloqueo,
  eliminarBloqueo
};
