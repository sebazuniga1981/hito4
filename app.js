const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();

const {
  getNow,
  getUsuarioByEmail,
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
} = require("./consultas");
const { verificarToken } = require("./middlewares");
const {
  sendReservaPendientePacienteEmail,
  sendReservaPendienteAdminEmail,
  sendReservaEstadoPacienteEmail,
  sendReservaCanceladaPacienteEmail,
  sendReservaCanceladaAdminEmail,
  sendReservaReprogramadaPacienteEmail
} = require("./mailer");

const app = express();

app.use(cors());
app.use(express.json());

const esAdmin = (req, res, next) => {
  if ((req.usuario?.rol || req.usuario?.role) !== "admin") {
    return res.status(403).json({ error: "Acceso solo para administradores" });
  }
  next();
};

app.get("/", async (req, res) => {
  try {
    const fecha = await getNow();

    res.json({
      mensaje: "Conexion a PostgreSQL OK",
      fecha_bd: fecha.now
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "No se pudo conectar a PostgreSQL"
    });
  }
});

app.post(["/register", "/api/register"], async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Debes enviar email y password"
      });
    }

    const usuarioExiste = await getUsuarioByEmail(email);

    if (usuarioExiste) {
      return res.status(400).json({
        error: "El usuario ya existe"
      });
    }

    const passwordEncriptada = await bcrypt.hash(password, 10);
    const nuevoUsuario = await crearUsuario(email, passwordEncriptada);

    res.status(201).json({
      mensaje: "Usuario creado correctamente",
      usuario: {
        id: nuevoUsuario.id,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error al registrar usuario"
    });
  }
});

app.post(["/login", "/api/login"], async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Debes enviar email y password"
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: "Falta JWT_SECRET en el servidor"
      });
    }

    const usuario = await getUsuarioByEmail(email);

    if (!usuario) {
      return res.status(401).json({
        error: "Usuario no existe"
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({
        error: "Credenciales incorrectas"
      });
    }

    const rol = usuario.rol || "paciente";

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, rol });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error en el proceso de login"
    });
  }
});

app.get(["/perfil", "/api/profile"], verificarToken, (req, res) => {
  res.json({
    mensaje: "Acceso autorizado",
    usuario: req.usuario
  });
});

app.post("/api/reservas", verificarToken, async (req, res) => {
  try {
    const { nombre, apellido, email, fecha, hora, modalidad, tipoSesion } = req.body || {};

    const nombreLimpio = String(nombre || "").trim();
    const apellidoLimpio = String(apellido || "").trim();
    const emailLimpio = String(email || "").trim().toLowerCase();

    if (!nombreLimpio || !apellidoLimpio || !emailLimpio || !fecha || !hora || !modalidad || !tipoSesion) {
      return res.status(400).json({ error: "Faltan campos obligatorios de reserva" });
    }

    const nombreCompleto = `${nombreLimpio} ${apellidoLimpio}`.trim();

    const nuevaReserva = await crearReserva({
      usuario_id: req.usuario.id,
      paciente: emailLimpio,
      fecha,
      hora,
      modalidad,
      tipoSesion
    });

    Promise.allSettled([
      sendReservaPendientePacienteEmail({
        to: emailLimpio,
        nombreCompleto,
        fecha,
        hora,
        modalidad,
        tipoSesion
      }),
      sendReservaPendienteAdminEmail({
        nombreCompleto,
        emailPaciente: emailLimpio,
        fecha,
        hora,
        modalidad,
        tipoSesion
      })
    ]).catch(() => {});

    res.status(201).json(nuevaReserva);
  } catch (error) {
    if (error.code === "SLOT_NOT_AVAILABLE") {
      return res.status(409).json({ error: "El horario seleccionado ya no esta disponible" });
    }

    console.error(error);
    res.status(500).json({ error: "No se pudo guardar la reserva" });
  }
});

app.get("/api/reservas/mias", verificarToken, async (req, res) => {
  try {
    const reservas = await getReservasByUsuarioId(req.usuario.id);
    res.json({ reservas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudieron cargar tus reservas" });
  }
});

app.get("/api/reservas/disponibilidad", verificarToken, async (req, res) => {
  try {
    const { fecha } = req.query;

    if (!fecha) {
      return res.status(400).json({ error: "Debes enviar fecha" });
    }

    const horasNoDisponibles = await getHorariosNoDisponiblesPorFecha(fecha);
    res.json({ fecha, horasNoDisponibles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo cargar disponibilidad" });
  }
});

app.patch("/api/reservas/:id/cancelar", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const reserva = await cancelarReservaByPaciente(id, req.usuario.id);

    if (!reserva) {
      return res.status(404).json({ error: "No se encontro la reserva o no es cancelable" });
    }

    const emailPaciente = String(reserva.paciente || "").trim();

    Promise.allSettled([
      emailPaciente.includes("@")
        ? sendReservaCanceladaPacienteEmail({
            to: emailPaciente,
            fecha: reserva.fecha,
            hora: reserva.hora,
            modalidad: reserva.modalidad,
            tipoSesion: reserva.tipoSesion
          })
        : Promise.resolve(false),
      sendReservaCanceladaAdminEmail({
        emailPaciente,
        fecha: reserva.fecha,
        hora: reserva.hora,
        modalidad: reserva.modalidad,
        tipoSesion: reserva.tipoSesion
      })
    ]).catch(() => {});

    res.json(reserva);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo cancelar la reserva" });
  }
});

app.patch("/api/reservas/:id/reprogramar", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, hora } = req.body || {};

    if (!fecha || !hora) {
      return res.status(400).json({ error: "Debes enviar fecha y hora para reprogramar" });
    }

    const reserva = await reprogramarReservaByPaciente(id, req.usuario.id, fecha, hora);

    if (!reserva) {
      return res.status(404).json({ error: "No se encontro la reserva o no es reprogramable" });
    }

    res.json(reserva);
  } catch (error) {
    if (error.code === "SLOT_NOT_AVAILABLE") {
      return res.status(409).json({ error: "Ese horario ya esta ocupado o bloqueado" });
    }

    console.error(error);
    res.status(500).json({ error: "No se pudo reprogramar la reserva" });
  }
});

app.get("/api/admin/reservas", verificarToken, esAdmin, async (req, res) => {
  try {
    const { weekStart, weekEnd } = req.query;

    if (!weekStart || !weekEnd) {
      return res.status(400).json({ error: "Debes enviar weekStart y weekEnd" });
    }

    const [reservas, bloqueos] = await Promise.all([
      getReservasAdminByWeek(weekStart, weekEnd),
      getBloqueosByWeek(weekStart, weekEnd)
    ]);

    res.json({ reservas, bloqueos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo cargar calendario admin" });
  }
});

app.patch("/api/admin/reservas/:id/estado", verificarToken, esAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado) {
      return res.status(400).json({ error: "Debes enviar estado" });
    }

    const reserva = await actualizarEstadoReserva(id, estado);

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    if (["confirmada", "rechazada", "cancelada"].includes(estado)) {
      const emailPaciente = String(reserva.paciente || "").trim();

      if (emailPaciente.includes("@")) {
        sendReservaEstadoPacienteEmail({
          to: emailPaciente,
          estado,
          fecha: reserva.fecha,
          hora: reserva.hora,
          modalidad: reserva.modalidad,
          tipoSesion: reserva.tipoSesion
        }).catch(() => {});
      }
    }

    res.json(reserva);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo actualizar estado de reserva" });
  }
});

app.patch("/api/admin/reservas/:id/mover", verificarToken, esAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, hora } = req.body || {};

    if (!fecha || !hora) {
      return res.status(400).json({ error: "Debes enviar fecha y hora destino" });
    }

    const reserva = await moverReserva(id, fecha, hora);

    if (!reserva) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const emailPaciente = String(reserva.paciente || "").trim();
    if (emailPaciente.includes("@")) {
      sendReservaReprogramadaPacienteEmail({
        to: emailPaciente,
        fecha: reserva.fecha,
        hora: reserva.hora,
        modalidad: reserva.modalidad,
        tipoSesion: reserva.tipoSesion
      }).catch(() => {});
    }

    res.json(reserva);
  } catch (error) {
    if (error.code === "SLOT_NOT_AVAILABLE") {
      return res.status(409).json({ error: "El horario destino no esta disponible" });
    }

    console.error(error);
    res.status(500).json({ error: "No se pudo mover la reserva" });
  }
});

app.post("/api/admin/bloqueos", verificarToken, esAdmin, async (req, res) => {
  try {
    const { fecha, hora, motivo } = req.body || {};

    if (!fecha || !hora) {
      return res.status(400).json({ error: "Debes enviar fecha y hora" });
    }

    const bloqueo = await crearBloqueo({
      fecha,
      hora,
      motivo,
      creado_por: req.usuario.id
    });

    res.status(201).json(bloqueo);
  } catch (error) {
    if (error.code === "SLOT_NOT_AVAILABLE") {
      return res.status(409).json({ error: "No se puede bloquear un horario ocupado" });
    }

    console.error(error);
    res.status(500).json({ error: "No se pudo crear bloqueo" });
  }
});

app.delete("/api/admin/bloqueos/:id", verificarToken, esAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const bloqueo = await eliminarBloqueo(id);

    if (!bloqueo) {
      return res.status(404).json({ error: "Bloqueo no encontrado" });
    }

    res.json({ mensaje: "Bloqueo eliminado", bloqueo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No se pudo eliminar bloqueo" });
  }
});

app.get("/api/servicios", async (req, res) => {
  try {
    const servicios = await getServicios();
    res.json(servicios);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error al obtener servicios"
    });
  }
});

app.get("/api/servicios/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const servicio = await getServicioById(id);

    if (!servicio) {
      return res.status(404).json({
        error: "Servicio no encontrado"
      });
    }

    res.json(servicio);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error al obtener el servicio"
    });
  }
});

app.post("/api/servicios", verificarToken, async (req, res) => {
  try {
    const { titulo, descripcion, precio, modalidad, duracion, imagen, categoria_id } = req.body || {};

    if (!titulo || !descripcion || !precio || !modalidad) {
      return res.status(400).json({
        error: "Faltan campos obligatorios"
      });
    }

    const nuevoServicio = await crearServicio({
      titulo,
      descripcion,
      precio,
      modalidad,
      duracion,
      imagen,
      usuario_id: req.usuario.id,
      categoria_id
    });

    res.status(201).json(nuevoServicio);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error al crear el servicio"
    });
  }
});

app.put("/api/servicios/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const servicioActual = await getServicioById(id);

    if (!servicioActual) {
      return res.status(404).json({
        error: "Servicio no encontrado"
      });
    }

    const servicioActualizado = await actualizarServicio(id, {
      titulo: req.body.titulo ?? servicioActual.titulo,
      descripcion: req.body.descripcion ?? servicioActual.descripcion,
      precio: req.body.precio ?? servicioActual.precio,
      modalidad: req.body.modalidad ?? servicioActual.modalidad,
      duracion: req.body.duracion ?? servicioActual.duracion,
      imagen: req.body.imagen ?? servicioActual.imagen,
      estado: req.body.estado ?? servicioActual.estado,
      categoria_id: req.body.categoria_id ?? servicioActual.categoria_id
    });

    res.json(servicioActualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error al actualizar el servicio"
    });
  }
});

app.delete("/api/servicios/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const servicioEliminado = await eliminarServicio(id);

    if (!servicioEliminado) {
      return res.status(404).json({
        error: "Servicio no encontrado"
      });
    }

    res.json({
      mensaje: "Servicio eliminado correctamente",
      servicio: servicioEliminado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error al eliminar el servicio"
    });
  }
});

module.exports = app;
