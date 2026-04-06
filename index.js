require("dotenv").config();

const app = require("./app");
const { initializeDatabase } = require("./consultas");

const PORT = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error al inicializar la base de datos:", error);
    process.exit(1);
  });