const request = require("supertest");
const app = require("../app");
const { initializeDatabase, pool } = require("../consultas");

beforeAll(async () => {
  await initializeDatabase();
});

afterAll(async () => {
  await pool.end();
});

describe("Pruebas API REST Hito 3", () => {
  test("GET / responde con status 200", async () => {
    const response = await request(app).get("/");
    expect(response.statusCode).toBe(200);
  });

  test("POST /api/register sin email ni password responde con status 400", async () => {
    const response = await request(app).post("/api/register").send({});
    expect(response.statusCode).toBe(400);
  });

  test("POST /api/login sin email ni password responde con status 400", async () => {
    const response = await request(app).post("/api/login").send({});
    expect(response.statusCode).toBe(400);
  });

  test("GET /api/profile sin token responde con status 401", async () => {
    const response = await request(app).get("/api/profile");
    expect(response.statusCode).toBe(401);
  });

  test("POST /api/servicios sin token responde con status 401", async () => {
    const response = await request(app).post("/api/servicios").send({
      titulo: "Sesion inicial",
      descripcion: "Evaluacion clinica",
      precio: 25000,
      modalidad: "online"
    });
    expect(response.statusCode).toBe(401);
  });
});

test("POST /api/login con credenciales incorrectas responde con status 401", async () => {
  const response = await request(app).post("/api/login").send({
    email: "noexiste@correo.cl",
    password: "1234"
  });

  expect(response.statusCode).toBe(401);
});
