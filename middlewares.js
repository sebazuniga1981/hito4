const jwt = require("jsonwebtoken");
require("dotenv").config();

const verificarToken = (req, res, next) => {
  try {
    const authorization = req.header("Authorization");

    if (!authorization) {
      return res.status(401).json({
        error: "Token no enviado"
      });
    }

    const token = authorization.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Formato de token invalido"
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: "Falta JWT_SECRET en el servidor"
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);


    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token invalido o expirado"
    });
  }
};

module.exports = {
  verificarToken
};
