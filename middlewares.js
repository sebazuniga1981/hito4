const jwt = require("jsonwebtoken");
const secretKey = require("./secretKey");

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
        error: "Formato de token inválido"
      });
    }

    const payload = jwt.verify(token, secretKey);
    req.usuario = payload;

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token inválido o expirado"
    });
  }
};

module.exports = {
  verificarToken
};