const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const {
  getNow,
  getUsuarioByEmail,
  crearUsuario,
  getServicios,
  getServicioById,
  crearServicio,
  actualizarServicio,
  eliminarServicio
} = require("./consultas");
const { verificarToken } = require("./middlewares");
const secretKey = require("./secretKey");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const fecha = await getNow();

    res.json({
      mensaje: "Conexión a PostgreSQL OK",
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
        email: nuevoUsuario.email
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

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email
      },
      secretKey,
      { expiresIn: "1h" }
    );

    res.json({ token });
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
    const {
      titulo,
      descripcion,
      precio,
      modalidad,
      duracion,
      imagen,
      categoria_id
    } = req.body || {};

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
