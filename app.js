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

    const rol = usuario.rol || "paciente";

const token = jwt.sign(
  { id: usuario.id, email: usuario.email, rol },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

res.json({ token, rol });




    res.json({ token, rol });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error en el proceso de login"
    });
  }
});
